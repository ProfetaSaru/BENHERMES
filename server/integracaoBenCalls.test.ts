import { describe, expect, it, beforeEach } from 'vitest';
import { AppDatabase } from './db';
import { createApiHandler } from './apiRouter';
import { assinar, conferirAssinatura, criarIntegracaoBenCalls, eventosDaMudanca, type EventoSaida } from './integracaoBenCalls';
import type { MapaWhatsapp } from '../src/types/whatsapp';
import { mapaInicial } from '../src/utils/whatsappBaias';
import { gravarAlteracao } from '../src/utils/whatsappHistorico';
import { aplicarAcao, concluirManutencao, iniciarManutencao } from '../src/utils/whatsappManutencao';

const SEGREDO = 's'.repeat(40);
const T = (hhmm: string) => new Date(`2026-11-06T${hhmm}:00`);

/** Igual ao hook do front: toda mudança passa pelo gravarAlteracao (histórico) */
const gravar = (m: MapaWhatsapp, mudar: (m: MapaWhatsapp) => MapaWhatsapp, quando: Date) => gravarAlteracao(m, mudar(m), quando);

function mapaComBanido() {
  let m = mapaInicial(T('08:00'));
  const sala = m.salas[0];
  const mesa = sala.mesas[0];
  const alvo = { tipo: 'lugar' as const, salaId: sala.id, mesaId: mesa.id, posicao: 'E3' };
  m = gravar(m, (x) => aplicarAcao(x, alvo, 'BANIDO', T('08:10')), T('08:10'));
  m = gravar(m, (x) => aplicarAcao(x, alvo, 'PEDIU_ANALISE', T('08:11')), T('08:11'));
  return { m, alvo };
}

/** Manutenção da manhã: OP1-E3 liberado */
function manutencaoLiberando(antes: MapaWhatsapp, alvo: any) {
  let m = gravar(antes, (x) => iniciarManutencao(x, T('09:10')), T('09:10'));
  m = gravar(m, (x) => aplicarAcao(x, alvo, 'LIBERADO', T('09:15')), T('09:15'));
  m = gravar(m, (x) => concluirManutencao(x, '', T('09:40')).mapa, T('09:40'));
  return m;
}

describe('eventos para o BenCalls', () => {
  it('manutenção que libera a baia vira "whatsapp.situacao" (OK) e "manutencao.concluida"', () => {
    const { m: antes, alvo } = mapaComBanido();
    const depois = manutencaoLiberando(antes, alvo);
    // o front salva a cada mudança; aqui comparamos o antes e o depois de uma vez
    const eventos = eventosDaMudanca(antes, depois);
    const sit = eventos.find((e) => e.tipo === 'whatsapp.situacao')!;
    expect(sit).toMatchObject({
      tipo: 'whatsapp.situacao',
      dados: { codigo: 'OP1-E3', de: 'ANALISE', para: 'OK', acao: 'LIBERADO', estado: { situacao: 'OK' }, manutencao: { janela: 'MANHA' } },
    });
    expect(sit.id).toBe(`wpp:OP1-E3:${T('09:15').toISOString()}:OK`);
    const man = eventos.find((e) => e.tipo === 'manutencao.concluida')!;
    expect(man).toMatchObject({ tipo: 'manutencao.concluida', dados: { janela: 'MANHA', acoes: [{ acao: 'LIBERADO', codigo: 'OP1-E3' }] } });
    expect((man.dados as any).texto).toContain('REGISTRO DE MANUTENÇÃO');
  });

  it('nada no primeiro mapa, nada repetido e nada da importação de histórico antigo', () => {
    const { m } = mapaComBanido();
    expect(eventosDaMudanca(null, m)).toEqual([]);
    expect(eventosDaMudanca(m, m)).toEqual([]);
    const importado = { ...m, atualizadoEm: T('12:00').toISOString(), historico: [] };
    expect(eventosDaMudanca(importado, { ...m, atualizadoEm: T('12:00').toISOString() })).toEqual([]);
  });

  it('restrição leva o prazo junto', () => {
    const { m: base } = mapaComBanido();
    const sala = base.salas[0];
    const alvo = { tipo: 'lugar' as const, salaId: sala.id, mesaId: sala.mesas[0].id, posicao: 'D1' };
    const depois = gravar(base, (x) => aplicarAcao(x, alvo, 'RESTRINGIDO', T('10:00'), { restricao: { quantidade: 2, unidade: 'dias' } }), T('10:00'));
    const [e] = eventosDaMudanca(base, depois) as Extract<EventoSaida, { tipo: 'whatsapp.situacao' }>[];
    expect(e.dados.estado.restritoAte).toBe(new Date(T('10:00').getTime() + 48 * 3_600_000).toISOString());
  });
});

describe('envio com fila', () => {
  let db: AppDatabase;
  beforeEach(() => {
    db = new AppDatabase(':memory:');
  });

  it('manda assinado; se o BenCalls cair, guarda e reenvia depois', async () => {
    const recebidas: { corpo: string; headers: Record<string, string> }[] = [];
    let fora = true;
    const fetchFalso = (async (_url: string, init: any) => {
      if (fora) throw new Error('ECONNREFUSED');
      recebidas.push({ corpo: init.body, headers: init.headers });
      return new Response('{"recebidos":1}', { status: 202 });
    }) as unknown as typeof fetch;
    const integ = criarIntegracaoBenCalls(db, { url: 'http://bencalls', segredo: SEGREDO }, fetchFalso);
    const { m: antes, alvo } = mapaComBanido();
    integ.mapaSalvo(antes, manutencaoLiberando(antes, alvo));
    await integ.esvaziar();
    expect(integ.pendentes()).toBe(2);
    expect(integ.status().ultimoErro).toContain('ECONNREFUSED');

    fora = false;
    await integ.esvaziar();
    expect(integ.pendentes()).toBe(0);
    expect(recebidas).toHaveLength(1);
    const { corpo, headers } = recebidas[0];
    expect(headers['X-Integracao-Origem']).toBe('benhermes');
    expect(conferirAssinatura({ segredo: SEGREDO, corpo, tempo: headers['X-Integracao-Tempo'], assinatura: headers['X-Integracao-Assinatura'] })).toBeNull();
    expect(JSON.parse(corpo).eventos).toHaveLength(2);
  });

  it('sem configuração não envia nada', async () => {
    const integ = criarIntegracaoBenCalls(db, { url: '', segredo: '' });
    const { m: antes, alvo } = mapaComBanido();
    integ.mapaSalvo(antes, manutencaoLiberando(antes, alvo));
    expect(integ.pendentes()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Pela API
// ---------------------------------------------------------------------------

function callApi(handler: ReturnType<typeof createApiHandler>, o: { method: string; url: string; body?: any; token?: string; headers?: Record<string, string> }) {
  return new Promise<{ status: number; data: any }>((resolve) => {
    const req: any = {
      method: o.method,
      url: o.url,
      headers: { ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(o.headers || {}) },
      socket: { remoteAddress: '127.0.0.1' },
      body: o.body,
    };
    const res: any = {
      statusCode: 200,
      setHeader() {},
      end(payload?: string) {
        resolve({ status: this.statusCode, data: payload ? JSON.parse(payload) : null });
      },
    };
    void handler(req, res);
  });
}

const assinado = (eventos: unknown[], segredo = SEGREDO) => {
  const corpo = JSON.stringify({ eventos });
  const tempo = String(Date.now());
  return { body: corpo, headers: { 'x-integracao-tempo': tempo, 'x-integracao-assinatura': assinar(segredo, tempo, corpo) } };
};

const chamado = (id: number, codigo: string, status = 'aberto') => ({
  id: `chamado:${id}:${status}`,
  tipo: 'chamado.whatsapp',
  em: new Date().toISOString(),
  dados: { chamado: { id, numero: `#2026-0${id}` }, codigo, situacao: 'WhatsApp banido', whatsapp: 'BANIDO', status },
});

describe('API da integração no BenHermes', () => {
  let db: AppDatabase;
  let handler: ReturnType<typeof createApiHandler>;
  let enviados: string[];
  let adminToken: string;

  beforeEach(async () => {
    db = new AppDatabase(':memory:');
    enviados = [];
    const fetchFalso = (async (_u: string, init: any) => {
      enviados.push(init.body);
      return new Response('{}', { status: 202 });
    }) as unknown as typeof fetch;
    handler = createApiHandler(db, { enforceIp: false, integracao: criarIntegracaoBenCalls(db, { url: 'http://bencalls', segredo: SEGREDO }, fetchFalso) });
    const login = await callApi(handler, { method: 'POST', url: '/api/auth/login', body: { username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' } });
    adminToken = login.data.token;
  });

  it('salvar o mapa no BenHermes manda o que mudou para o BenCalls', async () => {
    const { m: antes, alvo } = mapaComBanido();
    expect((await callApi(handler, { method: 'PUT', url: '/api/whatsapp', token: adminToken, body: { mapa: antes } })).status).toBe(200);
    expect(enviados).toHaveLength(0); // primeiro mapa: nada
    expect((await callApi(handler, { method: 'PUT', url: '/api/whatsapp', token: adminToken, body: { mapa: manutencaoLiberando(antes, alvo) } })).status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));
    expect(enviados).toHaveLength(1);
    expect(JSON.parse(enviados[0]).eventos.map((e: any) => e.tipo)).toEqual(['whatsapp.situacao', 'manutencao.concluida']);
  });

  it('recebe os chamados de WhatsApp do BenCalls (assinados) e mostra para quem cuida da mesa', async () => {
    const { m } = mapaComBanido();
    await callApi(handler, { method: 'PUT', url: '/api/whatsapp', token: adminToken, body: { mapa: m } });

    const semAssinatura = await callApi(handler, { method: 'POST', url: '/api/integracoes/bencalls/eventos', body: JSON.stringify({ eventos: [chamado(179, 'OP1-E3')] }) });
    expect(semAssinatura.status).toBe(401);
    const errada = await callApi(handler, { method: 'POST', url: '/api/integracoes/bencalls/eventos', ...assinado([chamado(179, 'OP1-E3')], 'x'.repeat(40)) });
    expect(errada.status).toBe(401);
    const invalido = await callApi(handler, { method: 'POST', url: '/api/integracoes/bencalls/eventos', ...assinado([{ ...chamado(179, 'OP1-E3'), tipo: 'outro' }]) });
    expect(invalido.status).toBe(422);

    const ok = await callApi(handler, { method: 'POST', url: '/api/integracoes/bencalls/eventos', ...assinado([chamado(179, 'OP1-E3'), chamado(180, 'OP9-D1')]) });
    expect(ok).toMatchObject({ status: 202, data: { recebidos: 2, duplicados: 0 } });
    const repetido = await callApi(handler, { method: 'POST', url: '/api/integracoes/bencalls/eventos', ...assinado([chamado(179, 'OP1-E3')]) });
    expect(repetido.data).toEqual({ recebidos: 0, duplicados: 1 });

    const lista = await callApi(handler, { method: 'GET', url: '/api/integracoes/bencalls/chamados', token: adminToken });
    expect(lista.data.chamados.map((c: any) => c.numero)).toEqual(['2026-0179', '2026-0180']);

    // supervisor vê só os da própria mesa (OP1 não tem supervisor alocado → nenhum)
    await callApi(handler, { method: 'POST', url: '/api/users', token: adminToken, body: { username: 'sup', displayName: 'Sup', password: '123', role: 'supervisor' } });
    const sup = await callApi(handler, { method: 'POST', url: '/api/auth/login', body: { username: 'sup', password: '123' } });
    expect((await callApi(handler, { method: 'GET', url: '/api/integracoes/bencalls/chamados', token: sup.data.token })).data.chamados).toEqual([]);

    // concluído no BenCalls sai da lista; dispensar também
    await callApi(handler, { method: 'POST', url: '/api/integracoes/bencalls/eventos', ...assinado([chamado(180, 'OP9-D1', 'concluido')]) });
    expect((await callApi(handler, { method: 'POST', url: '/api/integracoes/bencalls/chamados/179/dispensar', token: adminToken })).status).toBe(200);
    expect((await callApi(handler, { method: 'GET', url: '/api/integracoes/bencalls/chamados', token: adminToken })).data.chamados).toEqual([]);
  });

  it('liberar a baia aqui tira o chamado da lista (o BenCalls vai concluir)', async () => {
    const { m: antes, alvo } = mapaComBanido();
    await callApi(handler, { method: 'PUT', url: '/api/whatsapp', token: adminToken, body: { mapa: antes } });
    await callApi(handler, { method: 'POST', url: '/api/integracoes/bencalls/eventos', ...assinado([chamado(179, 'OP1-E3')]) });
    await callApi(handler, { method: 'PUT', url: '/api/whatsapp', token: adminToken, body: { mapa: manutencaoLiberando(antes, alvo) } });
    expect((await callApi(handler, { method: 'GET', url: '/api/integracoes/bencalls/chamados', token: adminToken })).data.chamados).toEqual([]);
  });

  it('status só para o Admin', async () => {
    const st = await callApi(handler, { method: 'GET', url: '/api/integracoes/bencalls/status', token: adminToken });
    expect(st.data).toMatchObject({ saidaAtiva: true, entradaAtiva: true, pendentes: 0 });
  });
});
