import { Celular, EstadoWhatsapp, MapaWhatsapp, Mesa, Sala, Situacao } from '../types/whatsapp';
import { estadoDaVaga, textoDoLocal } from './celulares';
import { codigoDoLugar, posicoesAtivas } from './mapaMesas';
import { analiseAtrasada, restricaoVencida } from './whatsappBaias';

/**
 * Resumo de todos os WhatsApps (baias, supervisores que têm WhatsApp e backups dos celulares)
 * e a lista de alertas do ciclo do banimento, em ordem de prioridade.
 */

export interface ResumoWhatsapp {
  ok: number;
  banido: number;
  analise: number;
  analiseAtrasada: number;
  permanente: number;
  restringido: number;
  vencidas: number;
  naoTem: number;
  vagasVazias: number;
  celulares: number;
}

const resumoVazio = (): ResumoWhatsapp => ({
  ok: 0,
  banido: 0,
  analise: 0,
  analiseAtrasada: 0,
  permanente: 0,
  restringido: 0,
  vencidas: 0,
  naoTem: 0,
  vagasVazias: 0,
  celulares: 0,
});

const CAMPO: Record<Situacao, keyof ResumoWhatsapp> = {
  OK: 'ok',
  BANIDO: 'banido',
  ANALISE: 'analise',
  PERMANENTE: 'permanente',
  RESTRINGIDO: 'restringido',
  NAO_TEM: 'naoTem',
};

const somar = (resumo: ResumoWhatsapp, e: EstadoWhatsapp, agora: Date): void => {
  resumo[CAMPO[e.situacao]]++;
  if (restricaoVencida(e, agora)) resumo.vencidas++;
  if (analiseAtrasada(e, agora)) resumo.analiseAtrasada++;
};

/** Posições que contam: baias ativas e o SUP quando o supervisor tem WhatsApp */
const posicoesQueContam = (mesa: Mesa): string[] =>
  posicoesAtivas(mesa).filter((p) => p !== 'SUB' && (p !== 'SUP' || mesa.whatsappSupervisor !== 'NAO_TEM'));

const somarSala = (resumo: ResumoWhatsapp, sala: Sala, agora: Date): void => {
  for (const mesa of sala.mesas) {
    for (const posicao of posicoesQueContam(mesa)) {
      const lugar = mesa.lugares[posicao];
      if (!lugar) continue;
      somar(resumo, lugar.whatsapp, agora);
      if (/^[ED]\d+$/.test(posicao) && !lugar.operador.trim()) resumo.vagasVazias++;
    }
  }
};

const backups = (celular: Celular) => celular.vagas.filter((v) => v.baia === null);

export const resumoDaSala = (sala: Sala, agora: Date): ResumoWhatsapp => {
  const resumo = resumoVazio();
  somarSala(resumo, sala, agora);
  return resumo;
};

export const resumoGeral = (mapa: MapaWhatsapp, agora: Date): ResumoWhatsapp => {
  const resumo = resumoVazio();
  mapa.salas.forEach((sala) => somarSala(resumo, sala, agora));
  mapa.celulares.forEach((c) => backups(c).forEach((v) => somar(resumo, v.whatsapp, agora)));
  resumo.celulares = mapa.celulares.length;
  return resumo;
};

export const resumoDoCelular = (
  mapa: MapaWhatsapp,
  celular: Celular,
  _agora: Date
): { total: number; operadores: number; backups: number; ok: number; problemas: number } => {
  const situacoes = celular.vagas.map((v) => estadoDaVaga(mapa, celular, v).situacao);
  const ok = situacoes.filter((s) => s === 'OK').length;
  const quantosBackups = backups(celular).length;
  return {
    total: celular.vagas.length,
    operadores: celular.vagas.length - quantosBackups,
    backups: quantosBackups,
    ok,
    problemas: situacoes.length - ok,
  };
};

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export type AlvoAlerta =
  | { tipo: 'lugar'; salaId: string; mesaId: string; posicao: string }
  | { tipo: 'vaga'; celularId: string; vagaId: string };

export type TipoAlerta = 'PEDIR_ANALISE' | 'ANALISE_ATRASADA' | 'RESTRICAO_VENCIDA' | 'PERMANENTE' | 'RESTRINGIDO' | 'NAO_TEM';

export interface Alerta {
  tipo: TipoAlerta;
  onde: string;
  quem: string;
  situacao: Situacao;
  desde: string;
  ate?: string;
  alvo: AlvoAlerta;
}

const PRIORIDADE: TipoAlerta[] = ['PEDIR_ANALISE', 'ANALISE_ATRASADA', 'RESTRICAO_VENCIDA', 'PERMANENTE', 'RESTRINGIDO', 'NAO_TEM'];

/** Tipo do alerta de uma situação; null = não precisa de atenção (OK ou análise dentro das 24 h) */
const tipoDoAlerta = (e: EstadoWhatsapp, agora: Date): TipoAlerta | null => {
  switch (e.situacao) {
    case 'BANIDO':
      return 'PEDIR_ANALISE';
    case 'ANALISE':
      return analiseAtrasada(e, agora) ? 'ANALISE_ATRASADA' : null;
    case 'RESTRINGIDO':
      return restricaoVencida(e, agora) ? 'RESTRICAO_VENCIDA' : 'RESTRINGIDO';
    case 'PERMANENTE':
      return 'PERMANENTE';
    case 'NAO_TEM':
      return 'NAO_TEM';
    default:
      return null;
  }
};

const montarAlerta = (
  e: EstadoWhatsapp,
  agora: Date,
  onde: string,
  quem: string,
  alvo: AlvoAlerta
): Alerta | null => {
  const tipo = tipoDoAlerta(e, agora);
  if (!tipo) return null;
  return {
    tipo,
    onde,
    quem,
    situacao: e.situacao,
    desde: tipo === 'ANALISE_ATRASADA' && e.analisePedidaEm ? e.analisePedidaEm : e.mudouEm,
    ...(e.situacao === 'RESTRINGIDO' && e.restritoAte ? { ate: e.restritoAte } : {}),
    alvo,
  };
};

/**
 * O que precisa de atenção: pedir análise (mais antigo primeiro), análise com mais de 24 h,
 * restrição vencida, perdidos, restringidos (pelo fim do prazo) e quem não tem WhatsApp.
 */
export const alertas = (mapa: MapaWhatsapp, agora: Date): Alerta[] => {
  const lista: Alerta[] = [];
  for (const sala of mapa.salas) {
    for (const mesa of sala.mesas) {
      for (const posicao of posicoesQueContam(mesa)) {
        const lugar = mesa.lugares[posicao];
        if (!lugar) continue;
        const quem = posicao === 'SUP' ? mesa.supervisor.trim() || 'Supervisor' : lugar.operador.trim() || 'Vaga vazia';
        const a = montarAlerta(lugar.whatsapp, agora, codigoDoLugar(mesa.sigla, posicao), quem, {
          tipo: 'lugar',
          salaId: sala.id,
          mesaId: mesa.id,
          posicao,
        });
        if (a) lista.push(a);
      }
    }
  }
  for (const celular of mapa.celulares) {
    for (const vaga of backups(celular)) {
      const a = montarAlerta(vaga.whatsapp, agora, textoDoLocal(celular, vaga), celular.nomeBackup, {
        tipo: 'vaga',
        celularId: celular.id,
        vagaId: vaga.id,
      });
      if (a) lista.push(a);
    }
  }
  const quando = (a: Alerta) => (a.tipo === 'RESTRINGIDO' && a.ate ? a.ate : a.desde);
  return lista.sort((a, b) => PRIORIDADE.indexOf(a.tipo) - PRIORIDADE.indexOf(b.tipo) || quando(a).localeCompare(quando(b)));
};
