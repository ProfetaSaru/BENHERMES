import { EventoWhatsapp, MapaWhatsapp, Situacao } from '../types/whatsapp';
import { FeriadoLocal, ehFimDeSemana, feriado, montarIso } from './calendario';
import { nomeDoCelular } from './celulares';
import { numerosDoMapa } from './whatsappHistorico';

/**
 * Estatísticas do histórico: linha do tempo de cada número (reconstruída de trás para frente a
 * partir da situação atual), quedas, tempo OK, tempo até voltar, rankings e o calendário das
 * manutenções. Tudo puro; "agora" vem por parâmetro.
 */

const HORA = 3_600_000;
const DIA = 24 * HORA;
const QUEDA: Situacao[] = ['BANIDO', 'RESTRINGIDO', 'PERMANENTE'];

export interface Trecho {
  chave: string;
  /** ms */
  inicio: number;
  fim: number;
  situacao: Situacao;
  operador: string;
  codigo: string;
  equipe: string;
  celular: string;
  celularId: string | null;
}

export type Periodo = 7 | 30 | 90 | 365;

export interface Linha {
  chave: string;
  codigo: string;
  operador: string;
  celular: string;
  /** Nome da vaga ('Usuário 2 · Messenger 1'); identifica o backup */
  vaga: string;
  quedas: number;
}

export interface Estavel {
  chave: string;
  codigo: string;
  operador: string;
  celular: string;
  vaga: string;
  dias: number;
  /** Sem mudança desde o início do histórico: mostrar "≥" */
  desdeOInicio: boolean;
}

export interface Grupo {
  nome: string;
  quedas: number;
  tempoOk: number | null;
  sequenciaDias: number | null;
}

export interface DiaDoCalendario {
  dia: string;
  /** null = a janela ainda não terminou */
  manha: boolean | null;
  almoco: boolean | null;
}

export interface Estatisticas {
  de: Date;
  ate: Date;
  poucoHistorico: boolean;
  tempoOk: number | null;
  quedas: number;
  ateVoltarMs: number | null;
  perdidos: number;
  manutencoes: { feitas: number; total: number };
  quedasPorDia: { dia: string; quedas: number }[];
  maisCairam: Linha[];
  maisEstaveis: Estavel[];
  porOperador: Grupo[];
  porCelular: (Grupo & { hex: string })[];
  porEquipe: Grupo[];
  calendario: DiaDoCalendario[];
}

const celularDaChave = (chave: string): string | null => (chave.startsWith('v:') ? chave.split(':')[1] : null);
const ms = (iso: string) => new Date(iso).getTime();

const porChave = (historico: EventoWhatsapp[]) => {
  const mapa = new Map<string, EventoWhatsapp[]>();
  for (const e of historico) mapa.set(e.chave, [...(mapa.get(e.chave) ?? []), e]);
  return mapa;
};

/** Trechos de cada número entre `de` e `ate` (cortados no início do histórico), em ordem */
export const trechos = (mapa: MapaWhatsapp, de: Date, ate: Date): Trecho[] => {
  const inicioHist = ms(mapa.inicioDoHistorico);
  const piso = Math.max(de.getTime(), inicioHist);
  const teto = ate.getTime();
  const atuais = numerosDoMapa(mapa);
  const eventos = porChave(mapa.historico);
  const resultado: Trecho[] = [];

  for (const chave of new Set([...atuais.keys(), ...eventos.keys()])) {
    const lista = eventos.get(chave) ?? [];
    const atual = atuais.get(chave);
    const ultimo = lista[lista.length - 1];
    let existe = !!atual;
    let s = atual
      ? { situacao: atual.situacao, operador: atual.operador, codigo: atual.codigo, equipe: atual.equipe, celular: atual.celular }
      : { situacao: 'OK' as Situacao, operador: ultimo.operador, codigo: ultimo.codigo, equipe: ultimo.equipe, celular: ultimo.celular };
    let cursor = Math.max(teto, ultimo ? ms(ultimo.em) : 0);
    const doNumero: Trecho[] = [];
    const guardar = (inicio: number, fim: number) => {
      const i = Math.max(inicio, piso);
      const f = Math.min(fim, teto);
      if (existe && f > i) doNumero.push({ chave, inicio: i, fim: f, ...s, celularId: celularDaChave(chave) });
    };

    for (let i = lista.length - 1; i >= 0; i--) {
      const e = lista[i];
      guardar(ms(e.em), cursor);
      if (e.tipo === 'SITUACAO') s = { ...s, situacao: e.de as Situacao };
      else if (e.tipo === 'OPERADOR') s = { ...s, operador: e.de };
      else if (e.tipo === 'ENTROU') existe = false;
      else {
        existe = true;
        s = { situacao: e.de as Situacao, operador: e.operador, codigo: e.codigo, equipe: e.equipe, celular: e.celular };
      }
      cursor = ms(e.em);
    }
    guardar(inicioHist, cursor);
    resultado.push(...doNumero.reverse());
  }
  return resultado;
};

const tempoOkDos = (lista: Trecho[]): number | null => {
  let ok = 0;
  let observado = 0;
  for (const x of lista) {
    if (x.situacao === 'NAO_TEM') continue;
    observado += x.fim - x.inicio;
    if (x.situacao === 'OK') ok += x.fim - x.inicio;
  }
  return observado > 0 ? ok / observado : null;
};

const isoDoDia = (d: Date) => montarIso(d.getFullYear(), d.getMonth() + 1, d.getDate());

/** Dias (AAAA-MM-DD) de `de` até `ate`, inclusive */
const diasEntre = (de: Date, ate: Date): string[] => {
  const dias: string[] = [];
  const d = new Date(de.getFullYear(), de.getMonth(), de.getDate());
  while (d <= ate) {
    dias.push(isoDoDia(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
};

/** "45min", "3h 20min", "2d 4h" */
export const formatarDuracao = (duracao: number): string => {
  const minutos = Math.round(duracao / 60_000);
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return minutos % 60 ? `${horas}h ${minutos % 60}min` : `${horas}h`;
  return horas % 24 ? `${Math.floor(horas / 24)}d ${horas % 24}h` : `${Math.floor(horas / 24)}d`;
};

const agrupar = (lista: Trecho[], quedas: EventoWhatsapp[], nomeDoTrecho: (x: Trecho) => string, nomeDaQueda: (e: EventoWhatsapp) => string) => {
  const nomes = new Set([...lista.map(nomeDoTrecho), ...quedas.map(nomeDaQueda)].filter(Boolean));
  return [...nomes].map((nome) => ({
    nome,
    quedas: quedas.filter((e) => nomeDaQueda(e) === nome).length,
    tempoOk: tempoOkDos(lista.filter((x) => nomeDoTrecho(x) === nome)),
  }));
};

const ordenar = <T extends { nome: string; quedas: number }>(lista: T[]) =>
  lista.sort((a, b) => b.quedas - a.quedas || a.nome.localeCompare(b.nome, 'pt-BR'));

export const calcularEstatisticas = (mapa: MapaWhatsapp, periodo: Periodo, agora: Date, feriados: FeriadoLocal[]): Estatisticas => {
  const de = new Date(agora.getTime() - periodo * DIA);
  const inicioHist = new Date(mapa.inicioDoHistorico);
  const desde = new Date(Math.max(de.getTime(), inicioHist.getTime()));
  const lista = trechos(mapa, de, agora);
  const eventos = porChave(mapa.historico);
  const atuais = numerosDoMapa(mapa);
  const noPeriodo = (e: EventoWhatsapp) => ms(e.em) >= desde.getTime() && ms(e.em) <= agora.getTime();

  const quedas = mapa.historico.filter((e) => e.tipo === 'SITUACAO' && e.de === 'OK' && QUEDA.includes(e.para as Situacao) && noPeriodo(e));
  const voltas = quedas
    .map((q) => (eventos.get(q.chave) ?? []).find((e) => e.tipo === 'SITUACAO' && e.para === 'OK' && ms(e.em) > ms(q.em)))
    .map((volta, i) => (volta ? ms(volta.em) - ms(quedas[i].em) : null))
    .filter((v): v is number => v !== null);

  // Sequência atual em OK de cada número que está OK agora
  const sequencia = (chave: string): { dias: number; desdeOInicio: boolean } => {
    const lista = eventos.get(chave) ?? [];
    const entrada = [...lista].reverse().find((e) => (e.tipo === 'SITUACAO' || e.tipo === 'ENTROU') && e.para === 'OK');
    const inicio = entrada ? ms(entrada.em) : inicioHist.getTime();
    return { dias: Math.floor((agora.getTime() - inicio) / DIA), desdeOInicio: !entrada };
  };

  const retratoDe = (chave: string) => {
    const r = atuais.get(chave) ?? (eventos.get(chave) ?? []).slice(-1)[0];
    return { codigo: r?.codigo ?? '', operador: r?.operador ?? '', celular: r?.celular ?? '', vaga: r?.vaga ?? '' };
  };

  const contagem = new Map<string, number>();
  quedas.forEach((q) => contagem.set(q.chave, (contagem.get(q.chave) ?? 0) + 1));
  const maisCairam = [...contagem.entries()]
    .map(([chave, n]) => ({ chave, ...retratoDe(chave), quedas: n }))
    .sort((a, b) => b.quedas - a.quedas || a.codigo.localeCompare(b.codigo))
    .slice(0, 10);

  const maisEstaveis = [...atuais.entries()]
    .filter(([, r]) => r.situacao === 'OK')
    .map(([chave, r]) => ({ chave, codigo: r.codigo, operador: r.operador, celular: r.celular, vaga: r.vaga, ...sequencia(chave) }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 10);

  const porOperador = ordenar(
    agrupar(lista, quedas, (x) => x.operador, (e) => e.operador).map((g) => {
      const atual = [...atuais.entries()].find(([, r]) => r.operador === g.nome && r.situacao === 'OK');
      return { ...g, sequenciaDias: atual ? sequencia(atual[0]).dias : null };
    })
  );

  const porEquipe = ordenar(agrupar(lista, quedas, (x) => x.equipe, (e) => e.equipe).map((g) => ({ ...g, sequenciaDias: null })));

  const idsDeCelular = new Set([...lista.map((x) => x.celularId), ...quedas.map((q) => celularDaChave(q.chave))].filter((c): c is string => !!c));
  const porCelular = ordenar(
    [...idsDeCelular].map((id) => {
      const atual = mapa.celulares.find((c) => c.id === id);
      const doCelular = lista.filter((x) => x.celularId === id);
      return {
        nome: atual ? nomeDoCelular(atual) : doCelular[0]?.celular ?? quedas.find((q) => celularDaChave(q.chave) === id)?.celular ?? '',
        hex: atual?.hex ?? '#808080',
        quedas: quedas.filter((q) => celularDaChave(q.chave) === id).length,
        tempoOk: tempoOkDos(doCelular),
        sequenciaDias: null,
      };
    })
  );

  const feitas = (dia: string, janela: 'MANHA' | 'ALMOCO') =>
    mapa.manutencoes.some((m) => m.fim && m.janela === janela && isoDoDia(new Date(m.inicio)) === dia);
  const terminou = (dia: string, hora: number) => {
    const [a, mes, d] = dia.split('-').map(Number);
    return new Date(a, mes - 1, d, hora).getTime() <= agora.getTime();
  };
  const calendario = diasEntre(desde, agora)
    .filter((dia) => !ehFimDeSemana(dia) && !feriado(dia, feriados))
    .map((dia) => ({
      dia,
      manha: terminou(dia, 12) ? feitas(dia, 'MANHA') : null,
      almoco: terminou(dia, 15) ? feitas(dia, 'ALMOCO') : null,
    }));
  const janelas = calendario.flatMap((d) => [d.manha, d.almoco]).filter((j): j is boolean => j !== null);

  return {
    de,
    ate: agora,
    poucoHistorico: agora.getTime() - inicioHist.getTime() < 14 * DIA,
    tempoOk: tempoOkDos(lista),
    quedas: quedas.length,
    ateVoltarMs: voltas.length ? voltas.reduce((a, b) => a + b, 0) / voltas.length : null,
    perdidos: mapa.historico.filter((e) => e.tipo === 'SITUACAO' && e.para === 'PERMANENTE' && noPeriodo(e)).length,
    manutencoes: { feitas: janelas.filter(Boolean).length, total: janelas.length },
    quedasPorDia: diasEntre(desde, agora).map((dia) => ({ dia, quedas: quedas.filter((q) => isoDoDia(new Date(q.em)) === dia).length })),
    maisCairam,
    maisEstaveis,
    porOperador,
    porCelular,
    porEquipe,
    calendario,
  };
};
