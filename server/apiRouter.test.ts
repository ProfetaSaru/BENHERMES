import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from './db';
import { createApiHandler } from './apiRouter';
import { signAuthToken } from './auth';

function callApi(
  handler: ReturnType<typeof createApiHandler>,
  options: {
    method: string;
    url: string;
    body?: any;
    token?: string;
    ip?: string;
  }
): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const req: any = {
      method: options.method,
      url: options.url,
      headers: {
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.ip ? { 'x-forwarded-for': options.ip } : {}),
      },
      socket: {
        remoteAddress: options.ip || '127.0.0.1',
      },
      body: options.body,
    };

    const headers: Record<string, string> = {};
    const res: any = {
      statusCode: 200,
      setHeader(k: string, v: string) {
        headers[k.toLowerCase()] = v;
      },
      end(payload?: string) {
        resolve({
          status: this.statusCode,
          data: payload ? JSON.parse(payload) : null,
        });
      },
    };

    void handler(req, res);
  });
}

describe('API Router, RBAC, Auto-Save e Permissões do WhatsApp Baias', () => {
  let db: AppDatabase;
  let handler: ReturnType<typeof createApiHandler>;

  beforeEach(() => {
    db = new AppDatabase(':memory:');
    handler = createApiHandler(db, { enforceIp: true });
  });

  it('bloqueia IPs fora da whitelist e permite os IPs IPv4 e blocos IPv6 /48 autorizados', async () => {
    const blocked = await callApi(handler, {
      method: 'GET',
      url: '/api/health',
      ip: '189.10.20.30',
    });
    expect(blocked.status).toBe(403);

    const allowedIpv6 = await callApi(handler, {
      method: 'GET',
      url: '/api/health',
      ip: '2804:431:80f7:7700::abcd',
    });
    expect(allowedIpv6.status).toBe(200);
    expect(allowedIpv6.data.ok).toBe(true);

    const allowedIpv4 = await callApi(handler, {
      method: 'GET',
      url: '/api/health',
      ip: '201.93.163.133',
    });
    expect(allowedIpv4.status).toBe(200);
  });

  it('respeita a hierarquia de relatórios entre Admin, Gerente, Supervisor e Operador e suporta auto-save', async () => {
    // 1. Admin faz login
    const adminLogin = await callApi(handler, {
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' },
    });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.data.token as string;

    // 2. Admin cria Gerente, Supervisor A, Supervisor B, Operador A1 (ligado a Sup A) e Operador B1 (ligado a Sup B)
    const gerenteRes = await callApi(handler, {
      method: 'POST',
      url: '/api/users',
      token: adminToken,
      body: { username: 'gerente1', displayName: 'Gerente Geral', password: '123', role: 'gerente' },
    });
    expect(gerenteRes.status).toBe(201);

    const supARes = await callApi(handler, {
      method: 'POST',
      url: '/api/users',
      token: adminToken,
      body: { username: 'supA', displayName: 'Supervisor Alpha', password: '123', role: 'supervisor' },
    });
    expect(supARes.status).toBe(201);
    const supA = supARes.data.user;

    const supBRes = await callApi(handler, {
      method: 'POST',
      url: '/api/users',
      token: adminToken,
      body: { username: 'supB', displayName: 'Supervisor Beta', password: '123', role: 'supervisor' },
    });
    expect(supBRes.status).toBe(201);
    const supB = supBRes.data.user;

    const opA1Res = await callApi(handler, {
      method: 'POST',
      url: '/api/users',
      token: adminToken,
      body: {
        username: 'opA1',
        displayName: 'Operador A1',
        password: '123',
        role: 'operador',
        supervisorId: supA.id,
      },
    });
    expect(opA1Res.status).toBe(201);
    const opA1 = opA1Res.data.user;
    expect(opA1.supervisorName).toBe('Supervisor Alpha');

    const opB1Res = await callApi(handler, {
      method: 'POST',
      url: '/api/users',
      token: adminToken,
      body: {
        username: 'opB1',
        displayName: 'Operador B1',
        password: '123',
        role: 'operador',
        supervisorId: supB.id,
      },
    });
    expect(opB1Res.status).toBe(201);
    const opB1 = opB1Res.data.user;

    const gerenteToken = signAuthToken({ id: gerenteRes.data.user.id, username: 'gerente1', role: 'gerente' });
    const supAToken = signAuthToken({ id: supA.id, username: 'supA', role: 'supervisor' });
    const opA1Token = signAuthToken({ id: opA1.id, username: 'opA1', role: 'operador' });
    const opB1Token = signAuthToken({ id: opB1.id, username: 'opB1', role: 'operador' });

    // 3. Operador A1 faz auto-save de um relatório e depois atualiza o mesmo relatório (sem duplicar)
    const auto1 = await callApi(handler, {
      method: 'POST',
      url: '/api/reports/autosave',
      token: opA1Token,
      body: {
        id: 'rep-op-a1',
        title: 'Relatório Diário A1',
        displayDate: '2026-10-28',
        displayTime: '10:00',
        templateId: 'atividades-padrao',
        templateTitle: 'Relatório de Atividades',
        templateCategory: 'geral',
        isExpandable: true,
        tasks: [{ id: 't1', title: 'ATENDIMENTO', start: '09:00', end: '10:00', category: 'Rotina', description: 'Teste' }],
        reportText: 'Versão 1',
      },
    });
    expect(auto1.status).toBe(200);

    const auto2 = await callApi(handler, {
      method: 'POST',
      url: '/api/reports/autosave',
      token: opA1Token,
      body: {
        id: 'rep-op-a1',
        title: 'Relatório Diário A1',
        displayDate: '2026-10-28',
        displayTime: '10:15',
        templateId: 'atividades-padrao',
        templateTitle: 'Relatório de Atividades',
        templateCategory: 'geral',
        isExpandable: true,
        tasks: [
          { id: 't1', title: 'ATENDIMENTO', start: '09:00', end: '10:00', category: 'Rotina', description: 'Teste' },
          { id: 't2', title: 'FOLLOW UP', start: '10:00', end: '10:15', category: 'Rotina', description: 'Teste 2' },
        ],
        reportText: 'Versão 2 Atualizada Automaticamente',
      },
    });
    expect(auto2.status).toBe(200);
    expect(auto2.data.report.reportText).toBe('Versão 2 Atualizada Automaticamente');
    expect(auto2.data.report.taskCount).toBe(2);

    // 4. Operador B1 e Supervisor A também salvam relatórios
    await callApi(handler, {
      method: 'POST',
      url: '/api/reports/autosave',
      token: opB1Token,
      body: {
        id: 'rep-op-b1',
        title: 'Relatório Diário B1',
        displayDate: '2026-10-28',
        displayTime: '11:00',
        templateId: 'atividades-padrao',
        templateTitle: 'Relatório de Atividades',
        templateCategory: 'geral',
        isExpandable: true,
        tasks: [],
        reportText: 'Relatório do B1',
      },
    });

    await callApi(handler, {
      method: 'POST',
      url: '/api/reports/autosave',
      token: supAToken,
      body: {
        id: 'rep-sup-a',
        title: 'Relatório Supervisor Alpha',
        displayDate: '2026-10-28',
        displayTime: '11:30',
        templateId: 'atividades-padrao',
        templateTitle: 'Relatório de Atividades',
        templateCategory: 'geral',
        isExpandable: true,
        tasks: [],
        reportText: 'Relatório do Sup A',
      },
    });

    // 5. Verificar visibilidade:
    // Operador A1 vê apenas o próprio (1 relatório)
    const listOpA1 = await callApi(handler, { method: 'GET', url: '/api/reports', token: opA1Token });
    expect(listOpA1.data.reports.map((r: any) => r.id)).toEqual(['rep-op-a1']);

    // Supervisor A vê o próprio + o do Operador A1 (não vê o do Operador B1)
    const listSupA = await callApi(handler, { method: 'GET', url: '/api/reports', token: supAToken });
    expect(listSupA.data.reports.map((r: any) => r.id).sort()).toEqual(['rep-op-a1', 'rep-sup-a']);

    // Gerente vê todos os 3 relatórios
    const listGerente = await callApi(handler, { method: 'GET', url: '/api/reports', token: gerenteToken });
    expect(listGerente.data.reports.length).toBe(3);

    // Admin vê todos os 3 relatórios
    const listAdmin = await callApi(handler, { method: 'GET', url: '/api/reports', token: adminToken });
    expect(listAdmin.data.reports.length).toBe(3);

    // Supervisor não pode excluir relatório, mas Admin pode
    const delBySup = await callApi(handler, {
      method: 'DELETE',
      url: '/api/reports/rep-op-a1',
      token: supAToken,
    });
    expect(delBySup.status).toBe(403);

    const delByAdmin = await callApi(handler, {
      method: 'DELETE',
      url: '/api/reports/rep-op-a1',
      token: adminToken,
    });
    expect(delByAdmin.status).toBe(200);
  });

  it('aplica permissões do WhatsApp das Baias (Supervisor pode registrar/alterar mas não manutenção nem excluir)', async () => {
    const adminLogin = await callApi(handler, {
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' },
    });
    const adminToken = adminLogin.data.token as string;

    const supRes = await callApi(handler, {
      method: 'POST',
      url: '/api/users',
      token: adminToken,
      body: { username: 'sup1', displayName: 'Supervisor 1', password: '123', role: 'supervisor' },
    });
    const supToken = signAuthToken({ id: supRes.data.user.id, username: 'sup1', role: 'supervisor' });

    const mapaInicial = {
      versao: 3,
      atualizadoEm: '2026-10-28T12:00:00Z',
      salas: [
        {
          id: 'sala-1',
          nome: 'Comercial 1',
          mesas: [{ id: 'mesa-1', nome: '1º Equipe', sigla: 'OP1', supervisor: 'João', lugares: {} }],
        },
      ],
      celulares: [
        {
          id: 'cel-1',
          cor: 'Azul',
          vagas: [{ id: 'vaga-1', rotulo: 'Messenger 1', whatsapp: { situacao: 'OK' } }],
        },
      ],
      historico: [],
      manutencoes: [],
      manutencaoAtual: null,
    };

    // Admin salva mapa inicial
    const saveInit = await callApi(handler, {
      method: 'PUT',
      url: '/api/whatsapp',
      token: adminToken,
      body: { mapa: mapaInicial },
    });
    expect(saveInit.status).toBe(200);

    // Supervisor altera situação e adiciona um novo celular -> PERMITIDO (200)
    const mapaAlterado = {
      ...mapaInicial,
      celulares: [
        {
          id: 'cel-1',
          cor: 'Azul',
          vagas: [{ id: 'vaga-1', rotulo: 'Messenger 1', whatsapp: { situacao: 'BANIDO' } }],
        },
        {
          id: 'cel-2',
          cor: 'Preto',
          vagas: [],
        },
      ],
    };
    const supAlter = await callApi(handler, {
      method: 'PUT',
      url: '/api/whatsapp',
      token: supToken,
      body: { mapa: mapaAlterado },
    });
    expect(supAlter.status).toBe(200);

    // Supervisor tenta iniciar manutenção -> BLOQUEADO (403)
    const supManut = await callApi(handler, {
      method: 'PUT',
      url: '/api/whatsapp',
      token: supToken,
      body: {
        mapa: {
          ...mapaAlterado,
          manutencaoAtual: { id: 'm1', inicio: '2026-10-28T12:10:00Z', janela: 'MANHA', conferidos: [], acoes: [] },
        },
      },
    });
    expect(supManut.status).toBe(403);

    // Supervisor tenta excluir celular existente -> BLOQUEADO (403)
    const supDeleteCel = await callApi(handler, {
      method: 'PUT',
      url: '/api/whatsapp',
      token: supToken,
      body: {
        mapa: {
          ...mapaAlterado,
          celulares: [mapaAlterado.celulares[0]], // removeu cel-2
        },
      },
    });
    expect(supDeleteCel.status).toBe(403);
  });

  it('isola completamente os rascunhos (/api/drafts) e o relatório em edição de cada conta, sem sincronizar entre contas diferentes', async () => {
    const adminLogin = await callApi(handler, {
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' },
    });
    const adminToken = adminLogin.data.token as string;
    const adminUser = adminLogin.data.user;

    const op1Res = await callApi(handler, {
      method: 'POST',
      url: '/api/users',
      token: adminToken,
      body: { username: 'op1', displayName: 'Operador 1', password: '123', role: 'operador' },
    });
    const op1 = op1Res.data.user;
    const op1Token = signAuthToken({ id: op1.id, username: 'op1', role: 'operador' });

    const op2Res = await callApi(handler, {
      method: 'POST',
      url: '/api/users',
      token: adminToken,
      body: { username: 'op2', displayName: 'Operador 2', password: '123', role: 'operador' },
    });
    const op2 = op2Res.data.user;
    const op2Token = signAuthToken({ id: op2.id, username: 'op2', role: 'operador' });

    // 1. Operador 1 salva rascunho de tarefas e campos na sua conta
    await callApi(handler, {
      method: 'PUT',
      url: '/api/drafts',
      token: op1Token,
      body: {
        activeTemplateId: 'atividades-padrao',
        tasksByTemplate: {
          'atividades-padrao': [{ id: 't-op1', title: 'TAREFA EXCLUSIVA OP1', start: '08:00', end: '09:00' }],
        },
        fieldsByTemplate: {
          'atividades-padrao': { obs: 'Observação do OP1' },
        },
        activeReportIds: {
          'atividades-padrao': 'relatorio-op1',
        },
      },
    });

    // 2. Operador 2 e Admin consultam seus próprios /api/drafts -> devem vir vazios e jamais mostrar os dados do Operador 1
    const op2Drafts = await callApi(handler, {
      method: 'GET',
      url: '/api/drafts',
      token: op2Token,
    });
    expect(op2Drafts.status).toBe(200);
    expect(op2Drafts.data.drafts.tasksByTemplate).toEqual({});
    expect(op2Drafts.data.drafts.fieldsByTemplate).toEqual({});
    expect(op2Drafts.data.drafts.activeReportIds).toEqual({});

    const adminDrafts = await callApi(handler, {
      method: 'GET',
      url: '/api/drafts',
      token: adminToken,
    });
    expect(adminDrafts.status).toBe(200);
    expect(adminDrafts.data.drafts.tasksByTemplate).toEqual({});

    // 3. Operador 1 auto-salva seu relatório 'relatorio-op1'
    const op1Saved = await callApi(handler, {
      method: 'POST',
      url: '/api/reports/autosave',
      token: op1Token,
      body: {
        id: 'relatorio-op1',
        title: 'Relatório do Operador 1',
        displayDate: '2026-10-28',
        displayTime: '09:00',
        templateId: 'atividades-padrao',
        templateTitle: 'Relatório de Atividades',
        templateCategory: 'geral',
        isExpandable: true,
        tasks: [{ id: 't-op1', title: 'TAREFA EXCLUSIVA OP1', start: '08:00', end: '09:00' }],
        reportText: 'Texto exclusivo do Operador 1',
      },
    });
    expect(op1Saved.status).toBe(200);
    expect(op1Saved.data.report.id).toBe('relatorio-op1');
    expect(op1Saved.data.report.userId).toBe(op1.id);

    // 4. Mesmo se o Admin (ou outro usuário) enviar o mesmo ID 'relatorio-op1' no auto-save,
    // o servidor NÃO sobrescreve o relatório do Operador 1: cria um novo relatório próprio para o Admin!
    const adminSaved = await callApi(handler, {
      method: 'POST',
      url: '/api/reports/autosave',
      token: adminToken,
      body: {
        id: 'relatorio-op1',
        title: 'Relatório do Admin',
        displayDate: '2026-10-28',
        displayTime: '09:30',
        templateId: 'atividades-padrao',
        templateTitle: 'Relatório de Atividades',
        templateCategory: 'geral',
        isExpandable: true,
        tasks: [],
        reportText: 'Texto exclusivo do Admin',
      },
    });
    expect(adminSaved.status).toBe(200);
    expect(adminSaved.data.report.id).not.toBe('relatorio-op1');
    expect(adminSaved.data.report.userId).toBe(adminUser.id);

    // 5. O relatório original do Operador 1 permanece intacto
    const op1Reports = await callApi(handler, {
      method: 'GET',
      url: '/api/reports',
      token: op1Token,
    });
    expect(op1Reports.data.reports).toHaveLength(1);
    expect(op1Reports.data.reports[0].id).toBe('relatorio-op1');
    expect(op1Reports.data.reports[0].reportText).toBe('Texto exclusivo do Operador 1');
  });

  it('permite que qualquer usuário autenticado altere sua própria senha via PUT /api/auth/password e salve preferência de tema', async () => {
    // 1. Admin cria um usuário de teste
    const adminLogin = await callApi(handler, {
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' },
    });
    const adminToken = adminLogin.data.token as string;

    const userRes = await callApi(handler, {
      method: 'POST',
      url: '/api/users',
      token: adminToken,
      body: { username: 'user_troca', displayName: 'Usuário Troca Senha', password: 'senhaAntiga123', role: 'operador' },
    });
    expect(userRes.status).toBe(201);

    // 2. Login com a senha antiga
    const login1 = await callApi(handler, {
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'user_troca', password: 'senhaAntiga123' },
    });
    expect(login1.status).toBe(200);
    const userToken = login1.data.token as string;

    // 3. Tentativa de troca com senha atual errada -> Erro 400
    const errTroca = await callApi(handler, {
      method: 'PUT',
      url: '/api/auth/password',
      token: userToken,
      body: { currentPassword: 'senhaErrada', newPassword: 'senhaNova456' },
    });
    expect(errTroca.status).toBe(400);
    expect(errTroca.data.erro).toContain('incorreta');

    // 4. Troca com senha atual correta -> Sucesso 200
    const okTroca = await callApi(handler, {
      method: 'PUT',
      url: '/api/auth/password',
      token: userToken,
      body: { currentPassword: 'senhaAntiga123', newPassword: 'senhaNova456' },
    });
    expect(okTroca.status).toBe(200);
    expect(okTroca.data.ok).toBe(true);

    // 5. Testar login com a nova senha
    const loginNovo = await callApi(handler, {
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'user_troca', password: 'senhaNova456' },
    });
    expect(loginNovo.status).toBe(200);
    const novoToken = loginNovo.data.token as string;

    // 6. Testar persistência de preferência de tema no drafts
    await callApi(handler, {
      method: 'PUT',
      url: '/api/drafts',
      token: novoToken,
      body: {
        activeTemplateId: 'atividades-padrao',
        tasksByTemplate: {},
        fieldsByTemplate: {},
        activeReportIds: {},
        theme: 'dark',
      },
    });

    const getDrafts = await callApi(handler, {
      method: 'GET',
      url: '/api/drafts',
      token: novoToken,
    });
    expect(getDrafts.status).toBe(200);
    expect(getDrafts.data.drafts.theme).toBe('dark');
  });
});

