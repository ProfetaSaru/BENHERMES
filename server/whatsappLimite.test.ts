import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { AppDatabase } from './db';
import { createApiHandler } from './apiRouter';
import { signAuthToken } from './auth';

/** Pedido de verdade em fluxo (o corpo chega em pedaços, como no servidor), para valer o limite de tamanho */
const pedidoEmFluxo = (handler: ReturnType<typeof createApiHandler>, url: string, token: string, corpo: string) =>
  new Promise<{ status: number; data: any }>((resolve) => {
    const req: any = Readable.from([Buffer.from(corpo)]);
    Object.assign(req, { method: 'PUT', url, headers: { authorization: `Bearer ${token}` }, socket: { remoteAddress: '127.0.0.1' } });
    const res: any = { statusCode: 200, setHeader() {}, end(p?: string) { resolve({ status: this.statusCode, data: p ? JSON.parse(p) : null }); } };
    void handler(req, res);
  });

describe('mapa do WhatsApp grande (12 meses de histórico)', () => {
  it('o servidor aceita um mapa de 6 MB (acima do limite geral de 5 MB)', async () => {
    const db = new AppDatabase(':memory:');
    const handler = createApiHandler(db, { enforceIp: false });
    const admin = db.authenticateUser(process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_PASSWORD || 'admin123')!;
    const token = signAuthToken({ id: admin.id, username: admin.username, role: admin.role });
    const evento = { em: '2026-11-11T12:00:00.000Z', chave: 'x'.repeat(40), tipo: 'SITUACAO', de: 'OK', para: 'BANIDO', codigo: 'OP1-E1', operador: 'NOME '.repeat(10), equipe: '', celular: '', vaga: '' };
    const historico = Array.from({ length: 26000 }, () => evento);
    const corpo = JSON.stringify({ mapa: { versao: 3, salas: [], celulares: [], historico, manutencoes: [], manutencaoAtual: null } });
    expect(corpo.length).toBeGreaterThan(6 * 1024 * 1024);
    const r = await pedidoEmFluxo(handler, '/api/whatsapp', token, corpo);
    expect(r.status).toBe(200);
  });

  it('outras rotas continuam com o limite de 5 MB', async () => {
    const db = new AppDatabase(':memory:');
    const handler = createApiHandler(db, { enforceIp: false });
    const admin = db.authenticateUser(process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_PASSWORD || 'admin123')!;
    const token = signAuthToken({ id: admin.id, username: admin.username, role: admin.role });
    const r = await pedidoEmFluxo(handler, '/api/escala', token, JSON.stringify({ dados: 'x'.repeat(6 * 1024 * 1024) }));
    expect(r.status).not.toBe(200);
  });
});
