import { beforeEach, describe, expect, it } from 'vitest';
import { AppDatabase } from './db';
import { createApiHandler } from './apiRouter';
import { signAuthToken } from './auth';
import type { Provedor } from './ranking/ia';

function chamar(handler: ReturnType<typeof createApiHandler>, o: { method: string; url: string; body?: any; token?: string }): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const req: any = { method: o.method, url: o.url, headers: o.token ? { authorization: `Bearer ${o.token}` } : {}, socket: { remoteAddress: '127.0.0.1' }, body: o.body === undefined ? undefined : JSON.stringify(o.body) };
    const res: any = { statusCode: 200, setHeader() {}, end(p?: string) { resolve({ status: this.statusCode, data: p ? JSON.parse(p) : null }); } };
    void handler(req, res);
  });
}

const CONFIG = {
  metas: {
    clt: { meta_vendedor: 450000, meta_bonus_vendedor: 350000, meta_supervisor: 2800000, meta_bonus_supervisor: 2000000, meta_cartao: 5 },
    estagio: { meta_vendedor: 350000, meta_bonus_vendedor: 250000, meta_supervisor: 2400000, meta_bonus_supervisor: 1600000, meta_cartao: 5 },
    meta_geral: 7600000,
  },
  emoji_destaque: '🏆', feriados: [], vendedores_clt: [], supervisores_clt: [], renomear_supervisores: {}, funcionarios_ativos: ['ANA'],
};

describe('rotas do ranking', () => {
  let db: AppDatabase;
  let handler: ReturnType<typeof createApiHandler>;
  let recebido: any = null;
  const tokens: Record<string, string> = {};

  beforeEach(() => {
    db = new AppDatabase(':memory:');
    recebido = null;
    const falso: Provedor = {
      nome: 'chatgpt',
      gerar: async (e) => {
        recebido = e;
        return { vendedores: e.vendedores.map((d) => `${d.nome}, firme.`), supervisores: e.supervisores.map((d) => `${d.nome}, equipe firme.`) };
      },
    };
    handler = createApiHandler(db, { enforceIp: false, rankingIa: { provedores: () => [falso] } });
    const admin = db.authenticateUser(process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_PASSWORD || 'admin123')!;
    tokens.admin = signAuthToken({ id: admin.id, username: admin.username, role: admin.role });
    for (const role of ['gerente', 'supervisor', 'operador'] as const) {
      const u = db.createUser({ username: `u_${role}`, displayName: role, password: 'senha-123456', role, supervisorId: null } as any);
      tokens[role] = signAuthToken({ id: u.id, username: u.username, role });
    }
  });

  it('só o admin acessa', async () => {
    for (const role of ['gerente', 'supervisor', 'operador']) {
      for (const [method, url] of [['GET', '/api/ranking/ia'], ['POST', '/api/ranking/comentarios'], ['GET', '/api/ranking/config'], ['PUT', '/api/ranking/config'], ['GET', '/api/ranking/historico'], ['PUT', '/api/ranking/historico']]) {
        expect((await chamar(handler, { method, url, token: tokens[role], body: {} })).status, `${role} ${method} ${url}`).toBe(403);
      }
    }
  });

  it('configuração: começa vazia, recusa inválida e guarda a válida com as IAs ligadas', async () => {
    expect((await chamar(handler, { method: 'GET', url: '/api/ranking/config', token: tokens.admin })).data).toEqual({ config: null });
    const ruim = await chamar(handler, { method: 'PUT', url: '/api/ranking/config', token: tokens.admin, body: { config: { ...CONFIG, feriados: ['ontem'] } } });
    expect(ruim.status).toBe(400);
    expect(ruim.data.erro).toMatch(/feriados/);
    const bom = await chamar(handler, { method: 'PUT', url: '/api/ranking/config', token: tokens.admin, body: { config: CONFIG } });
    expect(bom.status).toBe(200);
    expect(bom.data.config.ia).toEqual({ usar_chatgpt: true, usar_claude: true });
    expect((await chamar(handler, { method: 'GET', url: '/api/ranking/config', token: tokens.admin })).data.config.funcionarios_ativos).toEqual(['ANA']);
  });

  it('histórico guarda no máximo 120, os mais recentes', async () => {
    const historico = Array.from({ length: 121 }, (_, i) => ({ id: `r${i}`, dia: '2026-11-11', geradoEm: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(), geradoPor: 'admin', provedor: 'frases', relatorio: {}, legenda: '' }));
    const r = await chamar(handler, { method: 'PUT', url: '/api/ranking/historico', token: tokens.admin, body: { historico } });
    expect(r.status).toBe(200);
    expect(r.data.historico).toHaveLength(120);
    expect(r.data.historico.some((h: any) => h.id === 'r0')).toBe(false);
    expect((await chamar(handler, { method: 'PUT', url: '/api/ranking/historico', token: tokens.admin, body: { historico: 'x' } })).status).toBe(400);
  });

  it('comentários: devolve as frases da IA e o pedido não leva CPF, sobrenome nem R$', async () => {
    const corpo = {
      vendedores: [{ nome: 'Ana', posicao: '1º de 1', projetando: 1.2, situacao: 'batendo a meta', esteira: 'esteira vazia', vendeu_cartao_ou_margem: false }],
      supervisores: [{ nome: 'Equipe', posicao: '1º de 1', projetando: 1.2, situacao: 'batendo a meta', esteira: 'esteira vazia', vendeu_cartao_ou_margem: false }],
    };
    const r = await chamar(handler, { method: 'POST', url: '/api/ranking/comentarios', token: tokens.admin, body: corpo });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ provedor: 'chatgpt', vendedores: ['Ana, firme.'], supervisores: ['Equipe, equipe firme.'] });
    const texto = JSON.stringify(recebido);
    expect(texto).not.toMatch(/\d{11}|R\$/);
    expect(recebido.vendedores[0].nome).toBe('Ana');
  });

  it('comentários: sobrenome e campos extras do navegador não chegam à IA', async () => {
    const d = { nome: 'Ana Souza', posicao: '1º de 1', projetando: 1.2345, situacao: 'batendo a meta', esteira: 'esteira vazia', vendeu_cartao_ou_margem: false, cpf: '12345678901', portabilidade: 'R$ 1.000' };
    await chamar(handler, { method: 'POST', url: '/api/ranking/comentarios', token: tokens.admin, body: { vendedores: [d], supervisores: [] } });
    expect(recebido.vendedores[0]).toEqual({ nome: 'Ana', posicao: '1º de 1', projetando: 1.23, situacao: 'batendo a meta', esteira: 'esteira vazia', vendeu_cartao_ou_margem: false });
  });

  it('comentários: pedido malformado é recusado', async () => {
    expect((await chamar(handler, { method: 'POST', url: '/api/ranking/comentarios', token: tokens.admin, body: { vendedores: 'x' } })).status).toBe(400);
  });

  it('IA: diz só se cada chave existe', async () => {
    const r = await chamar(handler, { method: 'GET', url: '/api/ranking/ia', token: tokens.admin });
    expect(Object.keys(r.data)).toEqual(['chatgpt', 'claude']);
    expect(typeof r.data.chatgpt.chave).toBe('boolean');
  });
});
