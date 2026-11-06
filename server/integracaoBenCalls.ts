import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppDatabase, PublicUser } from './db.ts';

/**
 * API de integração BenHermes ⇄ BenCalls (versão 1). Mesmo contrato dos dois lados
 * (docs/API-INTEGRACAO.md no BenCalls):
 *
 * - Saída: quando o mapa do WhatsApp é salvo, o que mudou vira eventos e vai para o BenCalls
 *   (POST {BENCALLS_URL}/api/integracoes/benhermes/eventos). Ex.: "OP1-E3 liberado na manutenção"
 *   → lá o WhatsApp da baia fica OK e o chamado de WhatsApp daquela baia é concluído.
 *   Se o BenCalls estiver fora do ar, os eventos ficam guardados e são reenviados depois.
 * - Entrada: o BenCalls avisa os chamados de WhatsApp abertos (POST /api/integracoes/bencalls/eventos),
 *   que aparecem no Controle de WhatsApps para quem cuida daquela mesa.
 *
 * As mensagens são assinadas com HMAC-SHA256 e um segredo combinado (BENCALLS_SEGREDO, o mesmo
 * BENHERMES_SEGREDO do BenCalls). Este arquivo não depende de src/: roda direto no Node.
 */

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

export interface ConfigIntegracao {
  url: string;
  segredo: string;
}

export const TAMANHO_MINIMO_SEGREDO = 32;

export function configDoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfigIntegracao {
  let segredo = (env.BENCALLS_SEGREDO || '').trim();
  if (!segredo && env.BENCALLS_SEGREDO_ARQUIVO) {
    try {
      segredo = readFileSync(env.BENCALLS_SEGREDO_ARQUIVO, 'utf8').trim();
    } catch {
      segredo = '';
    }
  }
  if (segredo && segredo.length < TAMANHO_MINIMO_SEGREDO) {
    console.warn(`[BENHERMES] Integração com o BenCalls desligada: o segredo precisa de ${TAMANHO_MINIMO_SEGREDO}+ caracteres.`);
    segredo = '';
  }
  return { url: (env.BENCALLS_URL || '').trim().replace(/\/+$/, ''), segredo };
}

// ---------------------------------------------------------------------------
// Assinatura
// ---------------------------------------------------------------------------

export const JANELA_MS = 5 * 60_000;

export function assinar(segredo: string, tempo: string, corpo: string): string {
  return 'sha256=' + createHmac('sha256', segredo).update(`${tempo}.${corpo}`).digest('hex');
}

/** null = assinatura certa; senão, o motivo da recusa */
export function conferirAssinatura(p: { segredo: string; tempo: unknown; assinatura: unknown; corpo: string; agora?: number }): string | null {
  const tempo = String(p.tempo ?? '');
  if (!/^\d{10,16}$/.test(tempo)) return 'tempo ausente ou inválido';
  if (Math.abs((p.agora ?? Date.now()) - Number(tempo)) > JANELA_MS) return 'mensagem fora da janela de 5 minutos';
  if (typeof p.assinatura !== 'string' || !/^sha256=[0-9a-f]{64}$/.test(p.assinatura)) return 'assinatura ausente ou mal formada';
  const esperada = Buffer.from(assinar(p.segredo, tempo, p.corpo));
  const recebida = Buffer.from(p.assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return 'assinatura não confere';
  return null;
}

// ---------------------------------------------------------------------------
// Eventos de saída (o que mudou no mapa)
// ---------------------------------------------------------------------------

type Situacao = 'OK' | 'BANIDO' | 'ANALISE' | 'PERMANENTE' | 'RESTRINGIDO' | 'NAO_TEM';
type Acao = 'BANIDO' | 'RESTRINGIDO' | 'PEDIU_ANALISE' | 'LIBERADO' | 'PERDIDO' | 'TROCOU_CHIP' | 'VOLTOU';

export interface EstadoNoEvento {
  situacao: Situacao;
  mudouEm: string;
  analisePedidaEm?: string;
  restritoAte?: string;
}

export type EventoSaida =
  | {
      id: string;
      tipo: 'whatsapp.situacao';
      em: string;
      dados: {
        codigo: string;
        de: Situacao;
        para: Situacao;
        acao?: Acao;
        estado: EstadoNoEvento;
        operador?: string;
        numeroNovo?: string;
        manutencao?: { id: string; janela: string };
      };
    }
  | {
      id: string;
      tipo: 'manutencao.concluida';
      em: string;
      dados: { id: string; inicio: string; fim: string; janela: string; conferidos: number; acoes: { acao: Acao; codigo: string }[]; texto?: string };
    };

const CODIGO = /^[A-Za-z0-9]{1,8}(-[A-Za-z0-9]{1,8}){0,2}-(E\d{1,2}|D\d{1,2}|SUP)$/;
const SITUACOES: Situacao[] = ['OK', 'BANIDO', 'ANALISE', 'PERMANENTE', 'RESTRINGIDO', 'NAO_TEM'];
/** Eventos do histórico mais antigos que isto, em relação à última gravação, são de importação (não reenvia) */
const TOLERANCIA_IMPORTACAO_MS = 10 * 60_000;
const MAX_EVENTOS_POR_MUDANCA = 500;

/** Mesma regra do texto da manutenção: que ação gerou a mudança */
export function acaoDaMudanca(de: string, para: string): Acao | undefined {
  if (para === 'BANIDO') return 'BANIDO';
  if (para === 'RESTRINGIDO') return 'RESTRINGIDO';
  if (para === 'ANALISE') return 'PEDIU_ANALISE';
  if (para === 'PERMANENTE') return 'PERDIDO';
  if (para !== 'OK') return undefined;
  return de === 'PERMANENTE' ? 'TROCOU_CHIP' : de === 'RESTRINGIDO' ? 'VOLTOU' : 'LIBERADO';
}

const lugarPorCodigo = (mapa: any, codigo: string): any | null => {
  for (const sala of mapa?.salas ?? []) {
    for (const mesa of sala.mesas ?? []) {
      for (const [posicao, lugar] of Object.entries(mesa.lugares ?? {})) {
        if (`${mesa.sigla}-${posicao}` === codigo) return lugar;
      }
    }
  }
  return null;
};

const chaveDoHistorico = (e: any) => `${e.em}|${e.chave}|${e.tipo}|${e.de}|${e.para}`;

/**
 * Compara o mapa antes e depois de salvar e devolve os eventos para o BenCalls: cada mudança de
 * situação de uma baia (pelo histórico que o próprio BenHermes grava) e cada manutenção concluída.
 * O id é fixo para a mesma mudança, então reenviar não duplica nada do outro lado.
 */
export function eventosDaMudanca(antes: any | null, depois: any): EventoSaida[] {
  if (!antes || !depois) return []; // primeiro mapa (ou importação inicial): nada a avisar
  const vistos = new Set((antes.historico ?? []).map(chaveDoHistorico));
  const limite = Date.parse(antes.atualizadoEm ?? '') - TOLERANCIA_IMPORTACAO_MS;
  const manutencoes = [...(depois.manutencoes ?? []), ...(depois.manutencaoAtual ? [depois.manutencaoAtual] : [])];
  const out: EventoSaida[] = [];

  for (const e of depois.historico ?? []) {
    if (vistos.has(chaveDoHistorico(e))) continue;
    if (e.tipo !== 'SITUACAO' || typeof e.codigo !== 'string' || !CODIGO.test(e.codigo)) continue;
    if (!SITUACOES.includes(e.de) || !SITUACOES.includes(e.para)) continue;
    if (Number.isFinite(limite) && Date.parse(e.em) < limite) continue;
    const lugar = lugarPorCodigo(depois, e.codigo);
    const atual = lugar?.whatsapp;
    const estado: EstadoNoEvento =
      atual && atual.situacao === e.para && atual.mudouEm
        ? {
            situacao: atual.situacao,
            mudouEm: new Date(atual.mudouEm).toISOString(),
            ...(atual.analisePedidaEm ? { analisePedidaEm: new Date(atual.analisePedidaEm).toISOString() } : {}),
            ...(atual.restritoAte ? { restritoAte: new Date(atual.restritoAte).toISOString() } : {}),
          }
        : { situacao: e.para, mudouEm: new Date(e.em).toISOString(), ...(e.para === 'ANALISE' ? { analisePedidaEm: new Date(e.em).toISOString() } : {}) };
    const acao = acaoDaMudanca(e.de, e.para);
    const manut = e.manutencaoId ? manutencoes.find((m: any) => m.id === e.manutencaoId) : null;
    const chip = acao === 'TROCOU_CHIP' && manut ? (manut.acoes ?? []).find((a: any) => a.chave === e.chave && a.acao === 'TROCOU_CHIP' && a.numeroNovo) : null;
    out.push({
      id: `wpp:${e.codigo}:${new Date(e.em).toISOString()}:${e.para}`,
      tipo: 'whatsapp.situacao',
      em: new Date(e.em).toISOString(),
      dados: {
        codigo: e.codigo,
        de: e.de,
        para: e.para,
        ...(acao ? { acao } : {}),
        estado,
        ...(e.operador ? { operador: String(e.operador).slice(0, 120) } : {}),
        ...(chip ? { numeroNovo: String(chip.numeroNovo).slice(0, 40) } : {}),
        ...(manut ? { manutencao: { id: String(manut.id), janela: manut.janela } } : {}),
      },
    });
  }

  const jaConcluidas = new Set((antes.manutencoes ?? []).map((m: any) => m.id));
  for (const m of depois.manutencoes ?? []) {
    if (jaConcluidas.has(m.id) || !m.fim) continue;
    out.push({
      id: `manut:${m.id}`,
      tipo: 'manutencao.concluida',
      em: new Date(m.fim).toISOString(),
      dados: {
        id: String(m.id),
        inicio: new Date(m.inicio).toISOString(),
        fim: new Date(m.fim).toISOString(),
        janela: m.janela,
        conferidos: Array.isArray(m.conferidos) ? m.conferidos.length : 0,
        acoes: (m.acoes ?? []).map((a: any) => ({ acao: a.acao, codigo: CODIGO.test(a.codigo ?? '') ? a.codigo : '' })),
        ...(m.texto ? { texto: String(m.texto).slice(0, 8000) } : {}),
      },
    });
  }
  return out.slice(0, MAX_EVENTOS_POR_MUDANCA);
}

// ---------------------------------------------------------------------------
// Envio com fila (o BenCalls pode estar fora do ar)
// ---------------------------------------------------------------------------

const CHAVE_SAIDA = 'bencalls_saida';
const CHAVE_STATUS = 'bencalls_status';
const MAX_PENDENTES = 2000;
const LOTE = 100;

export interface StatusIntegracao {
  ultimoEnvio: string | null;
  ultimoErro: string | null;
}

export function criarIntegracaoBenCalls(appDb: AppDatabase, config: ConfigIntegracao = configDoAmbiente(), fetchImpl: typeof fetch = fetch) {
  const saidaAtiva = !!(config.url && config.segredo);
  const entradaAtiva = !!config.segredo;
  let enviando: Promise<void> | null = null;

  const pendentes = (): EventoSaida[] => appDb.getAppState<EventoSaida[]>(CHAVE_SAIDA, []);
  const status = (): StatusIntegracao => appDb.getAppState<StatusIntegracao>(CHAVE_STATUS, { ultimoEnvio: null, ultimoErro: null });

  async function enviarLote(eventos: EventoSaida[]): Promise<string | null> {
    const corpo = JSON.stringify({ eventos });
    const tempo = String(Date.now());
    try {
      const r = await fetchImpl(`${config.url}/api/integracoes/benhermes/eventos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integracao-Origem': 'benhermes',
          'X-Integracao-Tempo': tempo,
          'X-Integracao-Assinatura': assinar(config.segredo, tempo, corpo),
        },
        body: corpo,
      });
      if (r.ok) return null;
      const txt = await r.text().catch(() => '');
      return `BenCalls respondeu ${r.status} ${txt.slice(0, 200)}`;
    } catch (err: any) {
      return `BenCalls fora do alcance: ${err?.message || err}`;
    }
  }

  /** Manda o que está na fila; o que falhar continua nela para a próxima tentativa. */
  async function esvaziar(): Promise<void> {
    if (!saidaAtiva) return;
    if (enviando) return enviando;
    enviando = (async () => {
      let fila = pendentes();
      while (fila.length) {
        const lote = fila.slice(0, LOTE);
        const erro = await enviarLote(lote);
        if (erro) {
          appDb.setAppState(CHAVE_STATUS, { ...status(), ultimoErro: `${new Date().toISOString()} · ${erro}` });
          console.warn(`[BENHERMES] Integração BenCalls: ${erro} (${fila.length} evento(s) na fila).`);
          return;
        }
        // relê a fila: outro salvamento pode ter acrescentado eventos durante o envio
        const enviados = new Set(lote.map((e) => e.id));
        fila = pendentes().filter((e) => !enviados.has(e.id));
        appDb.setAppState(CHAVE_SAIDA, fila);
        appDb.setAppState(CHAVE_STATUS, { ultimoEnvio: new Date().toISOString(), ultimoErro: null });
      }
    })().finally(() => {
      enviando = null;
    });
    return enviando;
  }

  /** Chamado depois de salvar o mapa: coloca os eventos na fila e tenta mandar (sem travar a resposta). */
  function mapaSalvo(antes: any | null, depois: any): EventoSaida[] {
    const eventos = eventosDaMudanca(antes, depois);
    if (eventos.length) marcarResolvidosAqui(eventos);
    if (!saidaAtiva || !eventos.length) return eventos;
    const ids = new Set(pendentes().map((e) => e.id));
    const fila = [...pendentes(), ...eventos.filter((e) => !ids.has(e.id))];
    appDb.setAppState(CHAVE_SAIDA, fila.slice(-MAX_PENDENTES));
    void esvaziar();
    return eventos;
  }

  // -------------------------------------------------------------------------
  // Entrada: chamados de WhatsApp abertos no BenCalls
  // -------------------------------------------------------------------------

  /** Número da baia voltou a OK aqui: o BenCalls vai concluir o chamado; some da lista daqui. */
  function marcarResolvidosAqui(eventos: EventoSaida[]): void {
    const ok = new Set(eventos.filter((e) => e.tipo === 'whatsapp.situacao' && e.dados.para === 'OK').map((e) => (e as any).dados.codigo));
    if (!ok.size) return;
    const lista = chamados();
    let mudou = false;
    for (const c of Object.values(lista)) {
      if (c.status === 'aberto' && ok.has(c.codigo)) {
        c.status = 'concluido';
        c.atualizadoEm = new Date().toISOString();
        c.resolvidoNoBenHermes = true;
        mudou = true;
      }
    }
    if (mudou) appDb.setAppState(CHAVE_CHAMADOS, lista);
  }

  return {
    saidaAtiva,
    entradaAtiva,
    mapaSalvo,
    esvaziar,
    pendentes: () => pendentes().length,
    status,
    receber: (req: IncomingMessage, res: ServerResponse) => receberDoBenCalls(req, res, appDb, config),
    listarChamados: (user: PublicUser) => chamadosVisiveis(appDb, user),
    dispensarChamado: (id: string) => dispensar(appDb, id),
  };

  function chamados(): Record<string, ChamadoBenCalls> {
    return appDb.getAppState<Record<string, ChamadoBenCalls>>(CHAVE_CHAMADOS, {});
  }
}

const CHAVE_CHAMADOS = 'bencalls_chamados';
const CHAVE_VISTOS = 'bencalls_eventos_vistos';

export interface ChamadoBenCalls {
  id: string;
  numero: string;
  codigo: string;
  situacao: string;
  whatsapp: 'BANIDO' | 'PERMANENTE' | null;
  status: 'aberto' | 'concluido' | 'cancelado';
  abertoEm: string;
  atualizadoEm: string;
  dispensado?: boolean;
  resolvidoNoBenHermes?: boolean;
}

/** null = certo; senão, o motivo */
export function conferirEventoDoBenCalls(ev: any): string | null {
  if (!ev || typeof ev !== 'object') return 'evento não é um objeto';
  if (typeof ev.id !== 'string' || !/^[A-Za-z0-9:_.\-]{1,160}$/.test(ev.id)) return 'id inválido';
  if (ev.tipo !== 'chamado.whatsapp') return `tipo desconhecido: ${String(ev.tipo).slice(0, 40)}`;
  if (typeof ev.em !== 'string' || Number.isNaN(Date.parse(ev.em))) return 'em inválido';
  const d = ev.dados;
  if (!d || typeof d !== 'object') return 'dados ausentes';
  if (!d.chamado || !Number.isInteger(d.chamado.id) || typeof d.chamado.numero !== 'string' || !/^#?\d{4}-\d{3,6}$/.test(d.chamado.numero)) return 'dados.chamado inválido';
  if (typeof d.codigo !== 'string' || !CODIGO.test(d.codigo)) return 'dados.codigo inválido';
  if (typeof d.situacao !== 'string' || d.situacao.length > 80) return 'dados.situacao inválida';
  if (d.whatsapp != null && d.whatsapp !== 'BANIDO' && d.whatsapp !== 'PERMANENTE') return 'dados.whatsapp inválido';
  if (!['aberto', 'concluido', 'cancelado'].includes(d.status)) return 'dados.status inválido';
  return null;
}

function lerCorpoBruto(req: IncomingMessage & { body?: unknown }): Promise<string> {
  if (req.body !== undefined) return Promise.resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  return new Promise((ok, falha) => {
    const partes: Buffer[] = [];
    let total = 0;
    req.on('data', (p: Buffer) => {
      total += p.length;
      if (total > 64 * 1024) {
        falha(Object.assign(new Error('corpo grande demais'), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(p);
    });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', falha);
  });
}

function responder(res: ServerResponse, status: number, dados: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(dados));
}

async function receberDoBenCalls(req: IncomingMessage, res: ServerResponse, appDb: AppDatabase, config: ConfigIntegracao): Promise<void> {
  if (!config.segredo) return responder(res, 503, { erro: 'integração com o BenCalls desligada' });
  let corpo: string;
  try {
    corpo = await lerCorpoBruto(req);
  } catch (err: any) {
    return responder(res, err.status || 400, { erro: err.message });
  }
  const motivo = conferirAssinatura({
    segredo: config.segredo,
    corpo,
    tempo: req.headers['x-integracao-tempo'],
    assinatura: req.headers['x-integracao-assinatura'],
  });
  if (motivo) return responder(res, 401, { erro: `não autorizado: ${motivo}` });
  let json: any;
  try {
    json = JSON.parse(corpo);
  } catch {
    return responder(res, 400, { erro: 'JSON inválido' });
  }
  const eventos = Array.isArray(json?.eventos) ? json.eventos : null;
  if (!eventos || !eventos.length || eventos.length > 100) return responder(res, 422, { erro: 'mande { "eventos": [ ... ] } com 1 a 100 eventos' });
  for (let i = 0; i < eventos.length; i++) {
    const m = conferirEventoDoBenCalls(eventos[i]);
    if (m) return responder(res, 422, { erro: `evento ${i + 1}: ${m}` });
  }

  const vistos = appDb.getAppState<string[]>(CHAVE_VISTOS, []);
  const jaVistos = new Set(vistos);
  const lista = appDb.getAppState<Record<string, ChamadoBenCalls>>(CHAVE_CHAMADOS, {});
  let recebidos = 0;
  let duplicados = 0;
  for (const ev of [...eventos].sort((a: any, b: any) => String(a.em).localeCompare(String(b.em)))) {
    if (jaVistos.has(ev.id)) {
      duplicados++;
      continue;
    }
    jaVistos.add(ev.id);
    vistos.push(ev.id);
    recebidos++;
    const d = ev.dados;
    const id = String(d.chamado.id);
    const atual = lista[id];
    lista[id] = {
      id,
      numero: d.chamado.numero.replace(/^#/, ''),
      codigo: d.codigo,
      situacao: d.situacao,
      whatsapp: d.whatsapp ?? null,
      status: d.status,
      abertoEm: atual?.abertoEm ?? new Date(ev.em).toISOString(),
      atualizadoEm: new Date(ev.em).toISOString(),
      ...(atual?.dispensado ? { dispensado: true } : {}),
    };
  }
  // Guarda só o necessário: os concluídos mais antigos saem primeiro
  const ordenados = Object.values(lista).sort((a, b) => (a.status === 'aberto' ? 1 : 0) - (b.status === 'aberto' ? 1 : 0) || a.atualizadoEm.localeCompare(b.atualizadoEm));
  const enxuta = Object.fromEntries(ordenados.slice(-500).map((c) => [c.id, c]));
  appDb.setAppState(CHAVE_CHAMADOS, enxuta);
  appDb.setAppState(CHAVE_VISTOS, vistos.slice(-2000));
  return responder(res, 202, { recebidos, duplicados });
}

/** Mesa do supervisor (mesma regra do validateWhatsappPermissions) */
const ehMesaDoSupervisor = (mesa: any, user: PublicUser) => {
  if (mesa.supervisorUserId && mesa.supervisorUserId === user.id) return true;
  const nome = String(mesa.supervisor || '').trim().toLowerCase();
  return !!nome && (nome === user.displayName.trim().toLowerCase() || nome === user.username.trim().toLowerCase());
};

function chamadosVisiveis(appDb: AppDatabase, user: PublicUser): ChamadoBenCalls[] {
  const abertos = Object.values(appDb.getAppState<Record<string, ChamadoBenCalls>>(CHAVE_CHAMADOS, {}))
    .filter((c) => c.status === 'aberto' && !c.dispensado)
    .sort((a, b) => a.abertoEm.localeCompare(b.abertoEm));
  if (user.role !== 'supervisor') return abertos;
  const mapa = appDb.getAppState<any | null>('whatsapp_mapa', null);
  const siglas = new Set<string>(
    (mapa?.salas ?? []).flatMap((s: any) => s.mesas ?? []).filter((m: any) => ehMesaDoSupervisor(m, user)).map((m: any) => String(m.sigla).toUpperCase())
  );
  return abertos.filter((c) => siglas.has(c.codigo.slice(0, c.codigo.lastIndexOf('-')).toUpperCase()));
}

function dispensar(appDb: AppDatabase, id: string): boolean {
  const lista = appDb.getAppState<Record<string, ChamadoBenCalls>>(CHAVE_CHAMADOS, {});
  if (!lista[id]) return false;
  lista[id] = { ...lista[id], dispensado: true };
  appDb.setAppState(CHAVE_CHAMADOS, lista);
  return true;
}
