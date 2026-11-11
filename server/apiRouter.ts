import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Plugin } from 'vite';
import { AppDatabase, validateWhatsappPermissions, type PublicUser } from './db.ts';
import {
  clearAuthCookie,
  extractTokenFromRequest,
  setAuthCookie,
  signAuthToken,
  verifyAuthToken,
  type UserRole,
  OPERATOR_ALLOWED_TEMPLATE_IDS,
  formatOperatorReportTitle,
} from './auth.ts';
import { atenderArgus } from './argusProxy.ts';
import { enforceIpWhitelist } from './ipFilter.ts';
import { criarIntegracaoBenCalls } from './integracaoBenCalls.ts';
import { validarConfig } from './ranking/config.ts';
import { chavesDoAmbiente, gerarComentarios, limparEntrada, provedoresDoAmbiente, type Provedor } from './ranking/ia.ts';
import type { ConfigRanking } from './ranking/tipos.ts';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB (para mapas/relatórios grandes)
// O mapa do WhatsApp guarda 12 meses de histórico: com ~50 eventos por dia passa de 5 MB
const MAX_WHATSAPP_BODY_BYTES = 30 * 1024 * 1024;
const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024; // 50 MB (para arquivos compartilhados)

const BLOCKED_FILE_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.vbs',
  '.msi',
  '.ps1',
  '.scr',
  '.com',
  '.pif',
  '.reg',
  '.dll',
  '.jar',
  '.hta',
  '.cpl',
]);

function streamUploadToFile(
  req: IncomingMessage,
  targetFilePath: string,
  maxBytes: number
): Promise<{ size: number }> {
  return new Promise((resolve, reject) => {
    let bytesWritten = 0;
    const writeStream = fs.createWriteStream(targetFilePath);

    req.on('data', (chunk: Buffer) => {
      bytesWritten += chunk.length;
      if (bytesWritten > maxBytes) {
        req.destroy();
        writeStream.destroy();
        try {
          if (fs.existsSync(targetFilePath)) fs.unlinkSync(targetFilePath);
        } catch {}
        reject(new Error('Tamanho do arquivo excede o limite permitido de 50 MB.'));
        return;
      }
      writeStream.write(chunk);
    });

    req.on('end', () => {
      writeStream.end(() => {
        resolve({ size: bytesWritten });
      });
    });

    req.on('error', (err) => {
      writeStream.destroy();
      try {
        if (fs.existsSync(targetFilePath)) fs.unlinkSync(targetFilePath);
      } catch {}
      reject(err);
    });

    writeStream.on('error', (err) => {
      try {
        if (fs.existsSync(targetFilePath)) fs.unlinkSync(targetFilePath);
      } catch {}
      reject(err);
    });
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function readJsonBody(req: IncomingMessage & { body?: unknown }, limite = MAX_BODY_BYTES): Promise<any> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      try {
        let parsed = req.body ? JSON.parse(req.body) : {};
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            // mantém como string se não for JSON válido
          }
        }
        return Promise.resolve(parsed);
      } catch {
        return Promise.resolve({});
      }
    }
    return Promise.resolve(req.body || {});
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > limite) {
        reject(new Error('Payload excede o limite permitido.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8').trim();
        let parsed = raw ? JSON.parse(raw) : {};
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            // mantém como string se não for JSON válido
          }
        }
        resolve(parsed);
      } catch {
        reject(new Error('JSON inválido no corpo da requisição.'));
      }
    });
    req.on('error', reject);
  });
}

function getAuthenticatedUser(req: IncomingMessage, appDb: AppDatabase, urlObj?: URL): PublicUser | null {
  let token = extractTokenFromRequest(req);
  if (!token && urlObj) {
    token = urlObj.searchParams.get('token') || null;
  }
  if (!token) return null;
  const payload = verifyAuthToken(token);
  if (!payload) return null;
  const user = appDb.getUserById(payload.userId);
  if (!user || !user.active) return null;
  return user;
}

export function createApiHandler(
  appDb: AppDatabase,
  options?: {
    enforceIp?: boolean;
    integracao?: ReturnType<typeof criarIntegracaoBenCalls>;
    /** Testes trocam as IAs reais por provedores falsos */
    rankingIa?: { provedores?: (ia: ConfigRanking['ia']) => Provedor[] };
  }
) {
  const shouldEnforceIp = options?.enforceIp ?? true;
  // Integração com o BenCalls (server/integracaoBenCalls.ts): desligada sem BENCALLS_SEGREDO
  const integracao = options?.integracao ?? criarIntegracaoBenCalls(appDb);
  const provedoresDoRanking = options?.rankingIa?.provedores ?? ((ia: ConfigRanking['ia']) => provedoresDoAmbiente(ia));

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url || '/', 'http://localhost');
    const pathname = urlObj.pathname;

    if (!pathname.startsWith('/api')) {
      return false;
    }

    if (shouldEnforceIp && !enforceIpWhitelist(req, res)) {
      return true;
    }

    const method = (req.method || 'GET').toUpperCase();

    try {
      // 1. Healthcheck
      if (pathname === '/api/health' && method === 'GET') {
        sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() });
        return true;
      }

      // 1.1 Integração: o BenCalls avisa os chamados de WhatsApp (autenticado pela assinatura, sem login)
      if (pathname === '/api/integracoes/bencalls/eventos' && method === 'POST') {
        await integracao.receber(req, res);
        return true;
      }

      // 2. Auth: Login
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await readJsonBody(req);
        const username = String(body.username || '').trim();
        const password = String(body.password || '');

        if (!username || !password) {
          sendJson(res, 400, { erro: 'Informe o usuário e a senha.' });
          return true;
        }

        const user = appDb.authenticateUser(username, password);
        if (!user) {
          sendJson(res, 401, { erro: 'Usuário ou senha inválidos (ou conta desativada).' });
          return true;
        }

        const token = signAuthToken({ id: user.id, username: user.username, role: user.role });
        setAuthCookie(res, token);
        sendJson(res, 200, { user, token });
        return true;
      }

      // 3. Auth: Logout
      if (pathname === '/api/auth/logout' && method === 'POST') {
        clearAuthCookie(res);
        sendJson(res, 200, { ok: true });
        return true;
      }

      // 4. Auth: Me
      if (pathname === '/api/auth/me' && method === 'GET') {
        const user = getAuthenticatedUser(req, appDb, urlObj);
        if (!user) {
          sendJson(res, 401, { erro: 'Não autenticado.' });
          return true;
        }
        sendJson(res, 200, { user });
        return true;
      }

      // Todas as demais rotas de /api exigem autenticação
      const currentUser = getAuthenticatedUser(req, appDb, urlObj);
      if (!currentUser) {
        sendJson(res, 401, { erro: 'Sessão expirada ou não autenticada. Faça login novamente.' });
        return true;
      }

      // 4.1 Auth: Alteração da Própria Senha
      if (pathname === '/api/auth/password' && method === 'PUT') {
        const body = await readJsonBody(req);
        const currentPassword = String(body.currentPassword || '');
        const newPassword = String(body.newPassword || '');

        if (!currentPassword || !newPassword) {
          sendJson(res, 400, { erro: 'Informe a senha atual e a nova senha.' });
          return true;
        }

        try {
          appDb.changeUserPassword(currentUser.id, currentPassword, newPassword);
          sendJson(res, 200, { ok: true, mensagem: 'Senha alterada com sucesso.' });
        } catch (err: any) {
          sendJson(res, 400, { erro: err.message || 'Erro ao alterar senha.' });
        }
        return true;
      }

      // 5. Proxy do Argus (restrito a Admin)
      if (pathname === '/api/argus') {
        if (currentUser.role !== 'admin') {
          sendJson(res, 403, { erro: 'Apenas o Admin tem acesso ao Relatório URA / API Argus.' });
          return true;
        }
        await atenderArgus(req, res);
        return true;
      }

      // 6. Gestão de Usuários (/api/users)
      if (pathname === '/api/users' && method === 'GET') {
        const allUsers = appDb.listUsers();
        if (currentUser.role === 'admin' || currentUser.role === 'gerente') {
          sendJson(res, 200, { users: allUsers });
          return true;
        }
        if (currentUser.role === 'supervisor') {
          const visible = allUsers.filter(
            (u) => u.id === currentUser.id || u.supervisorId === currentUser.id
          );
          sendJson(res, 200, { users: visible });
          return true;
        }
        sendJson(res, 200, { users: [currentUser] });
        return true;
      }

      if (pathname === '/api/users' && method === 'POST') {
        if (currentUser.role !== 'admin') {
          sendJson(res, 403, { erro: 'Apenas o Admin pode criar contas de usuários.' });
          return true;
        }
        const body = await readJsonBody(req);
        const role = String(body.role || 'operador') as UserRole;
        if (!['admin', 'gerente', 'supervisor', 'operador'].includes(role)) {
          sendJson(res, 400, { erro: 'Tipo de login inválido.' });
          return true;
        }
        try {
          const created = appDb.createUser({
            username: String(body.username || ''),
            displayName: String(body.displayName || ''),
            password: String(body.password || ''),
            role,
            supervisorId: body.supervisorId || null,
          });
          sendJson(res, 201, { user: created });
        } catch (err: any) {
          sendJson(res, 400, { erro: err.message || 'Erro ao criar usuário.' });
        }
        return true;
      }

      if (pathname.startsWith('/api/users/')) {
        if (currentUser.role !== 'admin') {
          sendJson(res, 403, { erro: 'Apenas o Admin pode alterar ou remover contas.' });
          return true;
        }
        const targetUserId = decodeURIComponent(pathname.slice('/api/users/'.length));

        if (method === 'PUT') {
          const body = await readJsonBody(req);
          if (targetUserId === currentUser.id && body.active === false) {
            sendJson(res, 400, { erro: 'Você não pode desativar sua própria conta de Admin.' });
            return true;
          }
          try {
            const updated = appDb.updateUser(targetUserId, {
              displayName: body.displayName,
              role: body.role,
              supervisorId: body.supervisorId,
              active: body.active,
              password: body.password,
            });
            sendJson(res, 200, { user: updated });
          } catch (err: any) {
            sendJson(res, 400, { erro: err.message || 'Erro ao atualizar conta.' });
          }
          return true;
        }

        if (method === 'DELETE') {
          if (targetUserId === currentUser.id) {
            sendJson(res, 400, { erro: 'Você não pode excluir sua própria conta logada.' });
            return true;
          }
          appDb.deleteUser(targetUserId);
          sendJson(res, 200, { ok: true });
          return true;
        }
      }

      // 7. Relatórios (/api/reports e /api/reports/autosave)
      if (pathname === '/api/reports' && method === 'GET') {
        const reports = appDb.listReportsForUser(currentUser);
        sendJson(res, 200, { reports });
        return true;
      }

      if ((pathname === '/api/reports' || pathname === '/api/reports/autosave') && method === 'POST') {
        const body = await readJsonBody(req);

        let finalTemplateId = String(body.templateId || 'atividades-padrao');
        let finalTemplateTitle = String(body.templateTitle || 'Relatório de Atividades');
        let finalTemplateCategory = String(body.templateCategory || 'geral');
        let finalTitle = String(body.title || 'Relatório sem título');

        const displayDate = String(body.displayDate || new Date().toISOString().slice(0, 10));
        const displayTime = String(body.displayTime || '00:00');

        if (currentUser.role === 'operador') {
          // Força template permitido: atividades-padrao ou produtividade-atendimento
          if (!OPERATOR_ALLOWED_TEMPLATE_IDS.includes(finalTemplateId as any)) {
            finalTemplateId = 'atividades-padrao';
            finalTemplateTitle = 'Relatório de Atividades Padrão';
            finalTemplateCategory = 'atividades';
          }
          // Força título no formato: Primeiro e Último Nome - Data - Hora
          finalTitle = formatOperatorReportTitle(currentUser, displayDate, displayTime);
        }

        const saved = appDb.upsertReport(currentUser, {
          id: body.id ? String(body.id) : undefined,
          title: finalTitle,
          displayDate,
          displayTime,
          templateId: finalTemplateId,
          templateTitle: finalTemplateTitle,
          templateCategory: finalTemplateCategory,
          isExpandable: Boolean(body.isExpandable ?? true),
          fieldValues: body.fieldValues && typeof body.fieldValues === 'object' ? body.fieldValues : {},
          tasks: Array.isArray(body.tasks) ? body.tasks : [],
          reportText: String(body.reportText || ''),
          taskCount: Number(body.taskCount ?? (Array.isArray(body.tasks) ? body.tasks.length : 0)),
          periodSummary: String(body.periodSummary || 'Sem tarefas'),
          note: body.note ? String(body.note) : undefined,
        });
        sendJson(res, 200, { report: saved });
        return true;
      }

      if (pathname === '/api/reports' && method === 'DELETE') {
        if (currentUser.role !== 'admin') {
          sendJson(res, 403, { erro: 'Apenas o Admin pode limpar o histórico de relatórios.' });
          return true;
        }
        appDb.clearAllReports();
        sendJson(res, 200, { ok: true });
        return true;
      }

      if (pathname.startsWith('/api/reports/')) {
        const reportId = decodeURIComponent(pathname.slice('/api/reports/'.length));

        if (method === 'PUT') {
          if (currentUser.role === 'operador') {
            sendJson(res, 403, { erro: 'Operadores não podem alterar o título padronizado de relatórios.' });
            return true;
          }
          const body = await readJsonBody(req);
          try {
            const updated = appDb.renameReport(reportId, String(body.title || ''), currentUser);
            sendJson(res, 200, { report: updated });
          } catch (err: any) {
            sendJson(res, 403, { erro: err.message || 'Erro ao renomear relatório.' });
          }
          return true;
        }

        if (method === 'DELETE') {
          if (currentUser.role !== 'admin') {
            sendJson(res, 403, { erro: 'Apenas o Admin pode excluir relatórios do histórico.' });
            return true;
          }
          appDb.deleteReport(reportId);
          sendJson(res, 200, { ok: true });
          return true;
        }
      }

      // 8. Rascunhos do Gerador (/api/drafts)
      if (pathname === '/api/drafts' && method === 'GET') {
        const drafts = appDb.getUserDrafts(currentUser.id);
        sendJson(res, 200, { drafts });
        return true;
      }

      if (pathname === '/api/drafts' && method === 'PUT') {
        const body = await readJsonBody(req);
        const drafts = appDb.saveUserDrafts(currentUser.id, body);
        sendJson(res, 200, { drafts });
        return true;
      }

      // 9. Mapa do Controle de WhatsApps (/api/whatsapp)
      if (pathname === '/api/whatsapp' && method === 'GET') {
        if (currentUser.role === 'operador') {
          sendJson(res, 403, { erro: 'Operadores não têm acesso à aba Controle de WhatsApps.' });
          return true;
        }
        const mapa = appDb.getAppState<any | null>('whatsapp_mapa', null);
        sendJson(res, 200, { mapa });
        return true;
      }

      if (pathname === '/api/whatsapp' && method === 'PUT') {
        if (currentUser.role === 'operador') {
          sendJson(res, 403, { erro: 'Operadores não têm acesso à aba Controle de WhatsApps.' });
          return true;
        }
        const body = await readJsonBody(req, MAX_WHATSAPP_BODY_BYTES);
        if (!body || !body.mapa) {
          sendJson(res, 400, { erro: 'Mapa inválido.' });
          return true;
        }
        const oldMap = appDb.getAppState<any | null>('whatsapp_mapa', null);
        const check = validateWhatsappPermissions(oldMap, body.mapa, currentUser);
        if (!check.ok) {
          sendJson(res, 403, { erro: check.error });
          return true;
        }
        appDb.setAppState('whatsapp_mapa', body.mapa);
        // O que mudou vai para o BenCalls (ex.: baia liberada na manutenção fecha o chamado lá)
        integracao.mapaSalvo(oldMap, body.mapa);
        sendJson(res, 200, { mapa: body.mapa });
        return true;
      }

      // 9.1 Integração com o BenCalls: chamados de WhatsApp abertos lá
      if (pathname === '/api/integracoes/bencalls/chamados' && method === 'GET') {
        if (currentUser.role === 'operador') {
          sendJson(res, 403, { erro: 'Operadores não têm acesso à aba Controle de WhatsApps.' });
          return true;
        }
        sendJson(res, 200, { ativa: integracao.entradaAtiva, chamados: integracao.listarChamados(currentUser) });
        return true;
      }

      const dispensar = /^\/api\/integracoes\/bencalls\/chamados\/([A-Za-z0-9_-]{1,40})\/dispensar$/.exec(pathname);
      if (dispensar && method === 'POST') {
        if (currentUser.role === 'operador') {
          sendJson(res, 403, { erro: 'Operadores não têm acesso à aba Controle de WhatsApps.' });
          return true;
        }
        const visivel = integracao.listarChamados(currentUser).some((c) => c.id === dispensar[1]);
        if (!visivel || !integracao.dispensarChamado(dispensar[1])) {
          sendJson(res, 404, { erro: 'Chamado não encontrado.' });
          return true;
        }
        sendJson(res, 200, { ok: true });
        return true;
      }

      if (pathname === '/api/integracoes/bencalls/status' && method === 'GET') {
        if (currentUser.role !== 'admin') {
          sendJson(res, 403, { erro: 'Apenas o Admin vê o status da integração.' });
          return true;
        }
        sendJson(res, 200, {
          saidaAtiva: integracao.saidaAtiva,
          entradaAtiva: integracao.entradaAtiva,
          pendentes: integracao.pendentes(),
          ...integracao.status(),
        });
        return true;
      }

      // 10. Feriados Locais (/api/feriados)
      if (pathname === '/api/feriados' && method === 'GET') {
        const feriados = appDb.getAppState<any[]>('feriados_locais', []);
        sendJson(res, 200, { feriados });
        return true;
      }

      if (pathname === '/api/feriados' && method === 'PUT') {
        if (currentUser.role !== 'admin') {
          sendJson(res, 403, { erro: 'Apenas o Admin pode alterar os feriados locais.' });
          return true;
        }
        const body = await readJsonBody(req);
        const feriados = Array.isArray(body.feriados) ? body.feriados : [];
        appDb.setAppState('feriados_locais', feriados);
        sendJson(res, 200, { feriados });
        return true;
      }

      // 11. Escala de Bases (/api/escala)
      if (pathname === '/api/escala' && method === 'GET') {
        if (currentUser.role !== 'admin') {
          sendJson(res, 403, { erro: 'Apenas o Admin tem acesso à Escala de Bases.' });
          return true;
        }
        const dados = appDb.getAppState<any | null>('escala_bases', null);
        sendJson(res, 200, { dados });
        return true;
      }

      if (pathname === '/api/escala' && method === 'PUT') {
        if (currentUser.role !== 'admin') {
          sendJson(res, 403, { erro: 'Apenas o Admin pode alterar a Escala de Bases.' });
          return true;
        }
        const body = await readJsonBody(req);
        appDb.setAppState('escala_bases', body.dados ?? null);
        sendJson(res, 200, { dados: body.dados ?? null });
        return true;
      }

      // 11b. Ranking de contratos pagos (/api/ranking/*): só o Admin
      if (pathname.startsWith('/api/ranking/')) {
        if (currentUser.role !== 'admin') {
          sendJson(res, 403, { erro: 'Apenas o Admin tem acesso ao Ranking de contratos pagos.' });
          return true;
        }
        if (pathname === '/api/ranking/ia' && method === 'GET') {
          sendJson(res, 200, chavesDoAmbiente());
          return true;
        }
        if (pathname === '/api/ranking/config' && method === 'GET') {
          sendJson(res, 200, { config: appDb.getAppState<ConfigRanking | null>('ranking_config', null) });
          return true;
        }
        if (pathname === '/api/ranking/config' && method === 'PUT') {
          const body = await readJsonBody(req);
          const r = validarConfig(body?.config);
          if ('erro' in r) {
            sendJson(res, 400, { erro: r.erro });
            return true;
          }
          appDb.setAppState('ranking_config', r.config);
          sendJson(res, 200, { config: r.config });
          return true;
        }
        if (pathname === '/api/ranking/historico' && method === 'GET') {
          sendJson(res, 200, { historico: appDb.getAppState<any[]>('ranking_historico', []) });
          return true;
        }
        if (pathname === '/api/ranking/historico' && method === 'PUT') {
          const body = await readJsonBody(req);
          const lista = body?.historico;
          if (!Array.isArray(lista) || !lista.every((h: any) => h && typeof h === 'object' && typeof h.id === 'string' && typeof h.geradoEm === 'string')) {
            sendJson(res, 400, { erro: 'O histórico precisa ser uma lista de relatórios.' });
            return true;
          }
          const historico = [...lista].sort((a: any, b: any) => b.geradoEm.localeCompare(a.geradoEm)).slice(0, 120);
          appDb.setAppState('ranking_historico', historico);
          sendJson(res, 200, { historico });
          return true;
        }
        if (pathname === '/api/ranking/comentarios' && method === 'POST') {
          const entrada = limparEntrada(await readJsonBody(req));
          if (!entrada) {
            sendJson(res, 400, { erro: 'Pedido de comentários inválido.' });
            return true;
          }
          const ia = appDb.getAppState<ConfigRanking | null>('ranking_config', null)?.ia ?? { usar_chatgpt: true, usar_claude: true };
          sendJson(res, 200, await gerarComentarios(entrada, provedoresDoRanking(ia)));
          return true;
        }
        sendJson(res, 404, { erro: 'Rota do ranking não encontrada.' });
        return true;
      }

      // 12. Relatório da URA (/api/relatorio-ura)
      if (pathname === '/api/relatorio-ura' && method === 'GET') {
        if (currentUser.role !== 'admin') {
          sendJson(res, 403, { erro: 'Apenas o Admin tem acesso ao Relatório da URA.' });
          return true;
        }
        const dados = appDb.getAppState<any | null>('relatorio_ura', null);
        const argus = appDb.getAppState<any | null>('argus_config', null);
        sendJson(res, 200, { dados, argus });
        return true;
      }

      if (pathname === '/api/relatorio-ura' && method === 'PUT') {
        if (currentUser.role !== 'admin') {
          sendJson(res, 403, { erro: 'Apenas o Admin pode alterar o Relatório da URA.' });
          return true;
        }
        const body = await readJsonBody(req);
        if (body.dados !== undefined) {
          appDb.setAppState('relatorio_ura', body.dados);
        }
        if (body.argus !== undefined) {
          appDb.setAppState('argus_config', body.argus);
        }
        sendJson(res, 200, { ok: true });
        return true;
      }

      // 13. Anotações (/api/notes)
      if (pathname === '/api/notes' && method === 'GET') {
        const filterUserId = urlObj.searchParams.get('userId') || undefined;
        const notes = appDb.listNotesForUser(currentUser, filterUserId);
        sendJson(res, 200, { notes });
        return true;
      }

      if (pathname === '/api/notes/unread-count' && method === 'GET') {
        const unreadCount = appDb.getUnreadNotesCountForUser(currentUser);
        sendJson(res, 200, { unreadCount });
        return true;
      }

      if (pathname === '/api/notes' && method === 'POST') {
        const body = await readJsonBody(req);
        try {
          const note = appDb.createNote(currentUser, {
            title: String(body.title || ''),
            content: String(body.content || ''),
            category: body.category ? String(body.category) : undefined,
            color: body.color ? String(body.color) : undefined,
          });
          sendJson(res, 201, { note });
        } catch (err: any) {
          sendJson(res, 400, { erro: err.message || 'Erro ao criar anotação.' });
        }
        return true;
      }

      if (pathname.startsWith('/api/notes/')) {
        const rest = pathname.slice('/api/notes/'.length);

        // Sub-rota: /api/notes/:id/comments
        if (rest.endsWith('/comments')) {
          const noteId = decodeURIComponent(rest.slice(0, -'/comments'.length));

          if (method === 'GET') {
            try {
              const comments = appDb.listNoteComments(noteId, currentUser);
              sendJson(res, 200, { comments });
            } catch (err: any) {
              sendJson(res, 403, { erro: err.message || 'Erro ao listar comentários.' });
            }
            return true;
          }

          if (method === 'POST') {
            const body = await readJsonBody(req);
            try {
              const textContent =
                typeof body === 'object' && body !== null && 'content' in body
                  ? (body as any).content
                  : typeof body === 'string'
                  ? body
                  : '';
              const comment = appDb.addNoteComment(noteId, currentUser, String(textContent || ''));
              sendJson(res, 201, { comment });
            } catch (err: any) {
              sendJson(res, 400, { erro: err.message || 'Erro ao adicionar comentário.' });
            }
            return true;
          }
        }

        // Sub-rota: /api/notes/:id/read
        if (rest.endsWith('/read') && method === 'POST') {
          const noteId = decodeURIComponent(rest.slice(0, -'/read'.length));
          appDb.markNoteAsRead(noteId, currentUser);
          sendJson(res, 200, { ok: true });
          return true;
        }

        // Operações em /api/notes/:id
        const noteId = decodeURIComponent(rest);

        if (method === 'GET') {
          const note = appDb.getNoteById(noteId, currentUser);
          if (!note) {
            sendJson(res, 404, { erro: 'Anotação não encontrada ou acesso não autorizado.' });
            return true;
          }
          const comments = appDb.listNoteComments(noteId, currentUser);
          sendJson(res, 200, { note, comments });
          return true;
        }

        if (method === 'PUT') {
          const body = await readJsonBody(req);
          try {
            const updated = appDb.updateNote(noteId, currentUser, {
              title: body.title !== undefined ? String(body.title) : undefined,
              content: body.content !== undefined ? String(body.content) : undefined,
              category: body.category !== undefined ? String(body.category) : undefined,
              color: body.color !== undefined ? String(body.color) : undefined,
            });
            sendJson(res, 200, { note: updated });
          } catch (err: any) {
            sendJson(res, 403, { erro: err.message || 'Erro ao atualizar anotação.' });
          }
          return true;
        }

        if (method === 'DELETE') {
          try {
            appDb.deleteNote(noteId, currentUser);
            sendJson(res, 200, { ok: true });
          } catch (err: any) {
            sendJson(res, 403, { erro: err.message || 'Erro ao excluir anotação.' });
          }
          return true;
        }
      }

      // 14. Compartilhamento de Arquivos (/api/files)
      if (pathname.startsWith('/api/files')) {
        // RBAC: restrito a Admin, Gerente e Supervisor
        if (currentUser.role === 'operador') {
          sendJson(res, 403, { erro: 'Acesso restrito à equipe de gestão.' });
          return true;
        }

        // Listar itens e breadcrumbs: GET /api/files/items?folderId=...&search=...
        if (pathname === '/api/files/items' && method === 'GET') {
          const folderId = urlObj.searchParams.get('folderId') || undefined;
          const search = urlObj.searchParams.get('search') || undefined;
          const result = appDb.listSharedItems(currentUser, folderId, search);
          sendJson(res, 200, result);
          return true;
        }

        // Criar pasta: POST /api/files/folders
        if (pathname === '/api/files/folders' && method === 'POST') {
          const body = await readJsonBody(req);
          try {
            const folder = appDb.createSharedFolder(currentUser, {
              name: String(body.name || ''),
              parentId: body.parentId ? String(body.parentId) : undefined,
            });
            sendJson(res, 201, { folder });
          } catch (err: any) {
            sendJson(res, 400, { erro: err.message || 'Erro ao criar pasta.' });
          }
          return true;
        }

        // Sub-rotas de pastas: /api/files/folders/:id e /api/files/folders/:id/stats
        if (pathname.startsWith('/api/files/folders/')) {
          const rest = pathname.slice('/api/files/folders/'.length);

          // GET /api/files/folders/:id/stats
          if (rest.endsWith('/stats') && method === 'GET') {
            const folderId = decodeURIComponent(rest.slice(0, -'/stats'.length));
            try {
              const stats = appDb.getFolderStats(folderId);
              sendJson(res, 200, { stats });
            } catch (err: any) {
              sendJson(res, 400, { erro: err.message || 'Erro ao obter estatísticas da pasta.' });
            }
            return true;
          }

          const folderId = decodeURIComponent(rest);

          // Renomear pasta: PUT /api/files/folders/:id
          if (method === 'PUT') {
            const body = await readJsonBody(req);
            try {
              const updated = appDb.renameSharedFolder(currentUser, folderId, String(body.name || ''));
              sendJson(res, 200, { folder: updated });
            } catch (err: any) {
              sendJson(res, 403, { erro: err.message || 'Erro ao renomear pasta.' });
            }
            return true;
          }

          // Excluir pasta: DELETE /api/files/folders/:id
          if (method === 'DELETE') {
            try {
              appDb.deleteSharedFolder(currentUser, folderId);
              sendJson(res, 200, { ok: true });
            } catch (err: any) {
              sendJson(res, 403, { erro: err.message || 'Erro ao excluir pasta.' });
            }
            return true;
          }
        }

        // Upload de arquivo: POST /api/files/upload
        if (pathname === '/api/files/upload' && method === 'POST') {
          const rawHeaderName = req.headers['x-file-name'];
          let originalName = 'arquivo';
          if (typeof rawHeaderName === 'string') {
            try {
              originalName = decodeURIComponent(rawHeaderName);
            } catch {
              originalName = rawHeaderName;
            }
          } else {
            const queryName = urlObj.searchParams.get('name');
            if (queryName) originalName = queryName;
          }

          const rawFolderId = req.headers['x-folder-id'] || urlObj.searchParams.get('folderId');
          const folderId = typeof rawFolderId === 'string' && rawFolderId.trim() ? rawFolderId.trim() : null;

          const ext = path.extname(originalName).toLowerCase();
          if (BLOCKED_FILE_EXTENSIONS.has(ext)) {
            sendJson(res, 400, {
              erro: `Arquivos com extensão "${ext}" não são permitidos por motivos de segurança.`,
            });
            return true;
          }

          const fileUuid = crypto.randomUUID();
          const storageFilename = `${fileUuid}${ext || ''}`;
          const targetFilePath = path.join(appDb.uploadsDir, storageFilename);

          try {
            const { size } = await streamUploadToFile(req, targetFilePath, MAX_UPLOAD_FILE_BYTES);
            if (size === 0) {
              try {
                if (fs.existsSync(targetFilePath)) fs.unlinkSync(targetFilePath);
              } catch {}
              sendJson(res, 400, { erro: 'O arquivo enviado está vazio.' });
              return true;
            }

            const contentTypeHeader = (req.headers['content-type'] as string) || 'application/octet-stream';
            const file = appDb.createSharedFile(currentUser, {
              folderId,
              name: originalName,
              originalName,
              storagePath: storageFilename,
              mimeType: contentTypeHeader,
              sizeBytes: size,
            });

            sendJson(res, 201, { file });
          } catch (err: any) {
            try {
              if (fs.existsSync(targetFilePath)) fs.unlinkSync(targetFilePath);
            } catch {}
            sendJson(res, 400, { erro: err.message || 'Erro durante o envio do arquivo.' });
          }
          return true;
        }

        // Operações em arquivos: /api/files/:id, /api/files/:id/download, /api/files/:id/view
        const rest = pathname.slice('/api/files/'.length);

        if (rest.endsWith('/download') && method === 'GET') {
          const fileId = decodeURIComponent(rest.slice(0, -'/download'.length));
          const file = appDb.getSharedFileById(fileId, currentUser);
          if (!file) {
            sendJson(res, 404, { erro: 'Arquivo não encontrado.' });
            return true;
          }

          const filePath = path.join(appDb.uploadsDir, file.storagePath);
          if (!fs.existsSync(filePath)) {
            sendJson(res, 404, { erro: 'Arquivo físico não encontrado no servidor.' });
            return true;
          }

          const safeFilename = encodeURIComponent(file.name || file.originalName);
          res.statusCode = 200;
          res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
          res.setHeader('Content-Length', String(file.sizeBytes));
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${(file.name || file.originalName).replace(/["\\]/g, '_')}"; filename*=UTF-8''${safeFilename}`
          );
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
          return true;
        }

        if (rest.endsWith('/view') && method === 'GET') {
          const fileId = decodeURIComponent(rest.slice(0, -'/view'.length));
          const file = appDb.getSharedFileById(fileId, currentUser);
          if (!file) {
            sendJson(res, 404, { erro: 'Arquivo não encontrado.' });
            return true;
          }

          const filePath = path.join(appDb.uploadsDir, file.storagePath);
          if (!fs.existsSync(filePath)) {
            sendJson(res, 404, { erro: 'Arquivo físico não encontrado no servidor.' });
            return true;
          }

          const safeFilename = encodeURIComponent(file.name || file.originalName);
          res.statusCode = 200;
          res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
          res.setHeader('Content-Length', String(file.sizeBytes));
          res.setHeader(
            'Content-Disposition',
            `inline; filename="${(file.name || file.originalName).replace(/["\\]/g, '_')}"; filename*=UTF-8''${safeFilename}`
          );
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
          return true;
        }

        const fileId = decodeURIComponent(rest);

        // Renomear arquivo: PUT /api/files/:id
        if (method === 'PUT') {
          const body = await readJsonBody(req);
          try {
            const updated = appDb.renameSharedFile(currentUser, fileId, String(body.name || ''));
            sendJson(res, 200, { file: updated });
          } catch (err: any) {
            sendJson(res, 403, { erro: err.message || 'Erro ao renomear arquivo.' });
          }
          return true;
        }

        // Excluir arquivo: DELETE /api/files/:id
        if (method === 'DELETE') {
          try {
            appDb.deleteSharedFile(currentUser, fileId);
            sendJson(res, 200, { ok: true });
          } catch (err: any) {
            sendJson(res, 403, { erro: err.message || 'Erro ao excluir arquivo.' });
          }
          return true;
        }
      }

      sendJson(res, 404, { erro: `Rota de API não encontrada: ${method} ${pathname}` });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { erro: err.message || 'Erro interno no servidor.' });
      return true;
    }
  };
}

/**
 * Plugin do Vite para atender todas as rotas /api durante npm run dev / npm run preview.
 */
export function benhermesApiPlugin(customDb?: AppDatabase): Plugin {
  let handler: ReturnType<typeof createApiHandler> | null = null;
  const getHandler = () => {
    if (!handler) {
      const db = customDb || new AppDatabase();
      handler = createApiHandler(db, { enforceIp: process.env.ENFORCE_IP !== 'false' });
    }
    return handler;
  };

  return {
    name: 'benhermes-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await getHandler()(req, res);
        if (!handled) next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await getHandler()(req, res);
        if (!handled) next();
      });
    },
  };
}
