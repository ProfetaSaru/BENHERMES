import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { AppDatabase, validateWhatsappPermissions, type PublicUser } from './db.ts';
import {
  clearAuthCookie,
  extractTokenFromRequest,
  setAuthCookie,
  signAuthToken,
  verifyAuthToken,
  type UserRole,
} from './auth.ts';
import { atenderArgus } from './argusProxy.ts';
import { enforceIpWhitelist } from './ipFilter.ts';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB (para mapas/relatórios grandes)

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<any> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      return Promise.resolve(req.body ? JSON.parse(req.body) : {});
    }
    return Promise.resolve(req.body || {});
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Payload excede o limite permitido.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON inválido no corpo da requisição.'));
      }
    });
    req.on('error', reject);
  });
}

function getAuthenticatedUser(req: IncomingMessage, appDb: AppDatabase): PublicUser | null {
  const token = extractTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyAuthToken(token);
  if (!payload) return null;
  const user = appDb.getUserById(payload.userId);
  if (!user || !user.active) return null;
  return user;
}

export function createApiHandler(appDb: AppDatabase, options?: { enforceIp?: boolean }) {
  const shouldEnforceIp = options?.enforceIp ?? true;

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
        const user = getAuthenticatedUser(req, appDb);
        if (!user) {
          sendJson(res, 401, { erro: 'Não autenticado.' });
          return true;
        }
        sendJson(res, 200, { user });
        return true;
      }

      // Todas as demais rotas de /api exigem autenticação
      const currentUser = getAuthenticatedUser(req, appDb);
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
        const saved = appDb.upsertReport(currentUser, {
          id: body.id ? String(body.id) : undefined,
          title: String(body.title || 'Relatório sem título'),
          displayDate: String(body.displayDate || new Date().toISOString().slice(0, 10)),
          displayTime: String(body.displayTime || '00:00'),
          templateId: String(body.templateId || 'atividades-padrao'),
          templateTitle: String(body.templateTitle || 'Relatório de Atividades'),
          templateCategory: String(body.templateCategory || 'geral'),
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

      // 9. Mapa do WhatsApp das Baias (/api/whatsapp)
      if (pathname === '/api/whatsapp' && method === 'GET') {
        if (currentUser.role === 'operador') {
          sendJson(res, 403, { erro: 'Operadores não têm acesso à aba WhatsApp das Baias.' });
          return true;
        }
        const mapa = appDb.getAppState<any | null>('whatsapp_mapa', null);
        sendJson(res, 200, { mapa });
        return true;
      }

      if (pathname === '/api/whatsapp' && method === 'PUT') {
        if (currentUser.role === 'operador') {
          sendJson(res, 403, { erro: 'Operadores não têm acesso à aba WhatsApp das Baias.' });
          return true;
        }
        const body = await readJsonBody(req);
        if (!body || !body.mapa) {
          sendJson(res, 400, { erro: 'Mapa inválido.' });
          return true;
        }
        const oldMap = appDb.getAppState<any | null>('whatsapp_mapa', null);
        const check = validateWhatsappPermissions(oldMap, body.mapa, currentUser.role);
        if (!check.ok) {
          sendJson(res, 403, { erro: check.error });
          return true;
        }
        appDb.setAppState('whatsapp_mapa', body.mapa);
        sendJson(res, 200, { mapa: body.mapa });
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
      handler = createApiHandler(db, { enforceIp: true });
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
