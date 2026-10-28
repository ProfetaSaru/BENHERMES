import { describe, expect, it } from 'vitest';
import { EventoWhatsapp, MapaWhatsapp, Situacao } from '../types/whatsapp';
import { estado, mapaInicial, novaMesa } from './whatsappBaias';
import { calcularEstatisticas, formatarDuracao, trechos } from './whatsappEstatisticas';

const t = (iso: string) => new Date(iso);
const AGORA = t('2026-10-28T12:00:00');
const INICIO = t('2026-10-01T00:00:00');
const HORA = 3_600_000;

/** Uma mesa OP1 com só a baia E1 (ANA), contando desde 01/10 */
const umaBaia = (situacao: Situacao = 'OK', operador = 'ANA'): MapaWhatsapp => {
  const mapa = mapaInicial(INICIO);
  const mesa = novaMesa({ nome: '1º Equipe', sigla: 'OP1', supervisor: '', esq: 1, dir: 0, centro: 'NENHUM', inicio: 'sup' }, INICIO);
  mesa.lugares.E1 = { operador, whatsapp: estado(situacao, INICIO) };
  mapa.salas[0].mesas = [mesa];
  return mapa;
};

const chaveE1 = (m: MapaWhatsapp) => `l:${m.salas[0].mesas[0].id}:E1`;

const ev = (em: string, chave: string, tipo: EventoWhatsapp['tipo'], de: string, para: string, extra: Partial<EventoWhatsapp> = {}): EventoWhatsapp => ({
  em: t(em).toISOString(), chave, tipo, de, para, codigo: 'OP1-E1', operador: 'ANA', equipe: 'OP1', celular: '', vaga: '', ...extra,
});

describe('trechos e queda simples', () => {
  const mapa = umaBaia();
  const k = chaveE1(mapa);
  mapa.historico = [ev('2026-10-10T08:00:00', k, 'SITUACAO', 'OK', 'BANIDO'), ev('2026-10-11T08:00:00', k, 'SITUACAO', 'BANIDO', 'OK')];

  it('reconstrói a linha do tempo de trás para frente', () => {
    expect(trechos(mapa, INICIO, AGORA).map((x) => [x.situacao, new Date(x.inicio).toISOString(), new Date(x.fim).toISOString()])).toEqual([
      ['OK', INICIO.toISOString(), t('2026-10-10T08:00:00').toISOString()],
      ['BANIDO', t('2026-10-10T08:00:00').toISOString(), t('2026-10-11T08:00:00').toISOString()],
      ['OK', t('2026-10-11T08:00:00').toISOString(), AGORA.toISOString()],
    ]);
  });

  it('1 queda, 24 h até voltar, tempo OK descontando o dia banido', () => {
    const e = calcularEstatisticas(mapa, 30, AGORA, []);
    const observado = AGORA.getTime() - INICIO.getTime();
    expect(e.quedas).toBe(1);
    expect(e.ateVoltarMs).toBe(24 * HORA);
    expect(e.tempoOk).toBeCloseTo((observado - 24 * HORA) / observado, 6);
    expect(e.perdidos).toBe(0);
    expect(e.quedasPorDia.find((d) => d.dia === '2026-10-10')!.quedas).toBe(1);
    expect(e.maisCairam).toEqual([{ chave: k, codigo: 'OP1-E1', operador: 'ANA', celular: '', vaga: '', quedas: 1 }]);
  });

  it('mais estáveis: dias desde a volta para OK', () => {
    expect(calcularEstatisticas(mapa, 30, AGORA, []).maisEstaveis[0]).toMatchObject({ chave: k, dias: 17, desdeOInicio: false });
    expect(calcularEstatisticas(umaBaia(), 30, AGORA, []).maisEstaveis[0]).toMatchObject({ dias: 27, desdeOInicio: true });
  });

  it('período de 7 dias corta o que começou antes', () => {
    const e = calcularEstatisticas(mapa, 7, AGORA, []);
    expect(e.quedas).toBe(0);
    expect(e.tempoOk).toBe(1);
    expect(e.de.getTime()).toBe(AGORA.getTime() - 7 * 24 * HORA);
  });
});

describe('perdido, operador, entrou e saiu', () => {
  it('análise → permanente conta 1 perdido e não conta queda nova', () => {
    const mapa = umaBaia('PERMANENTE');
    const k = chaveE1(mapa);
    mapa.historico = [
      ev('2026-10-10T08:00:00', k, 'SITUACAO', 'OK', 'BANIDO'),
      ev('2026-10-10T09:00:00', k, 'SITUACAO', 'BANIDO', 'ANALISE'),
      ev('2026-10-11T09:00:00', k, 'SITUACAO', 'ANALISE', 'PERMANENTE'),
    ];
    const e = calcularEstatisticas(mapa, 30, AGORA, []);
    expect([e.quedas, e.perdidos, e.ateVoltarMs]).toEqual([1, 1, null]);
  });

  it('troca de operador no meio: cada trecho na conta de quem estava', () => {
    const mapa = umaBaia('OK', 'BIA');
    const k = chaveE1(mapa);
    mapa.historico = [
      ev('2026-10-10T08:00:00', k, 'SITUACAO', 'OK', 'BANIDO'),
      ev('2026-10-11T08:00:00', k, 'SITUACAO', 'BANIDO', 'OK'),
      ev('2026-10-15T00:00:00', k, 'OPERADOR', 'ANA', 'BIA', { operador: 'BIA' }),
    ];
    const { porOperador } = calcularEstatisticas(mapa, 30, AGORA, []);
    const ana = porOperador.find((o) => o.nome === 'ANA')!;
    const bia = porOperador.find((o) => o.nome === 'BIA')!;
    expect(ana.quedas).toBe(1);
    expect(ana.tempoOk).toBeCloseTo((14 * 24 - 24) / (14 * 24), 6);
    expect(bia).toMatchObject({ quedas: 0, tempoOk: 1, sequenciaDias: 17 });
  });

  it('número que entrou e saiu só conta no intervalo; o corte do período vale', () => {
    const mapa = umaBaia();
    const roxo = { codigo: '', operador: '', celular: 'Roxo', vaga: 'Padrão · Business' };
    mapa.historico = [
      ev('2026-10-20T00:00:00', 'v:c9:v9', 'ENTROU', '', 'OK', roxo),
      ev('2026-10-25T00:00:00', 'v:c9:v9', 'SAIU', 'OK', '', roxo),
    ];
    const doRoxo = (de: Date) => trechos(mapa, de, AGORA).filter((x) => x.chave === 'v:c9:v9');
    expect(doRoxo(INICIO).map((x) => [new Date(x.inicio).toISOString(), new Date(x.fim).toISOString(), x.celularId])).toEqual([
      [t('2026-10-20T00:00:00').toISOString(), t('2026-10-25T00:00:00').toISOString(), 'c9'],
    ]);
    const seteDias = new Date(AGORA.getTime() - 7 * 24 * HORA);
    expect(new Date(doRoxo(seteDias)[0].inicio).toISOString()).toBe(seteDias.toISOString());
    expect(calcularEstatisticas(mapa, 30, AGORA, []).porCelular).toEqual([
      { nome: 'Roxo', hex: '#808080', quedas: 0, tempoOk: 1, sequenciaDias: null },
    ]);
  });
});

describe('sem tempo observado e pouco histórico', () => {
  it('tudo NÃO TEM → tempo OK é null', () => {
    expect(calcularEstatisticas(umaBaia('NAO_TEM'), 30, AGORA, []).tempoOk).toBeNull();
  });

  it('histórico começando agora → null e pouco histórico', () => {
    const mapa = { ...umaBaia(), inicioDoHistorico: AGORA.toISOString() };
    const e = calcularEstatisticas(mapa, 30, AGORA, []);
    expect(e.tempoOk).toBeNull();
    expect(e.poucoHistorico).toBe(true);
    expect(calcularEstatisticas(umaBaia(), 30, AGORA, []).poucoHistorico).toBe(false);
  });
});

describe('calendário das manutenções', () => {
  it('dias úteis com as duas janelas; feriados fora; janela que não terminou é null', () => {
    const mapa = umaBaia();
    mapa.manutencoes = [
      { id: 'm1', inicio: t('2026-10-27T09:10:00').toISOString(), fim: t('2026-10-27T09:40:00').toISOString(), janela: 'MANHA', conferidos: [], acoes: [], observacao: '', texto: '' },
    ];
    const e = calcularEstatisticas(mapa, 30, AGORA, [{ data: '2026-10-15', descricao: 'Feriado municipal' }]);
    const dias = e.calendario.map((d) => d.dia);
    expect(dias).toHaveLength(18);
    expect(dias).not.toContain('2026-10-12');
    expect(dias).not.toContain('2026-10-15');
    expect(dias).not.toContain('2026-10-03');
    expect(e.calendario.find((d) => d.dia === '2026-10-27')).toEqual({ dia: '2026-10-27', manha: true, almoco: false });
    expect(e.calendario.find((d) => d.dia === '2026-10-28')).toEqual({ dia: '2026-10-28', manha: false, almoco: null });
    expect(e.manutencoes).toEqual({ feitas: 1, total: 35 });
  });
});

describe('duração', () => {
  it('minutos, horas e dias', () => {
    expect(formatarDuracao(45 * 60_000)).toBe('45min');
    expect(formatarDuracao(3 * HORA)).toBe('3h');
    expect(formatarDuracao(3 * HORA + 20 * 60_000)).toBe('3h 20min');
    expect(formatarDuracao(52 * HORA)).toBe('2d 4h');
    expect(formatarDuracao(48 * HORA)).toBe('2d');
  });
});

describe('backups no ranking', () => {
  it('dois backups do mesmo celular aparecem com o nome da vaga', () => {
    const mapa = umaBaia();
    const roxo = (vaga: string) => ({ codigo: '', operador: '', celular: 'Roxo', vaga, equipe: 'OP1' });
    mapa.historico = [
      ev('2026-10-20T09:00:00', 'v:c9:v1', 'SITUACAO', 'OK', 'BANIDO', roxo('Usuário 2 · Messenger 1')),
      ev('2026-10-21T09:00:00', 'v:c9:v2', 'SITUACAO', 'OK', 'BANIDO', roxo('Usuário 2 · Messenger 2')),
    ];
    expect(calcularEstatisticas(mapa, 30, AGORA, []).maisCairam.map((l) => l.vaga).sort()).toEqual(['Usuário 2 · Messenger 1', 'Usuário 2 · Messenger 2']);
  });
});
