import { EventoWhatsapp, MapaWhatsapp, Mesa, Situacao, TipoEvento } from '../types/whatsapp';
import { nomeDoCelular } from './celulares';
import { codigoDoLugar, posicoesAtivas } from './mapaMesas';

/**
 * Histórico automático: compara o mapa antes e depois de cada alteração e grava o que mudou em
 * cada "número" (vaga de celular, ou baia sem vaga ligada). Tudo puro; "agora" vem por parâmetro.
 */

export interface RetratoNumero {
  situacao: Situacao;
  operador: string;
  codigo: string;
  equipe: string;
  celular: string;
  vaga: string;
}

const operadorDoLugar = (mesa: Mesa, posicao: string): string =>
  posicao === 'SUP' ? mesa.supervisor.trim() : (mesa.lugares[posicao]?.operador ?? '').trim();

const ehNumeroDoLugar = (mesa: Mesa, posicao: string): boolean =>
  !!mesa.lugares[posicao] && !(posicao === 'SUP' && mesa.whatsappSupervisor === 'NAO_TEM');

/**
 * Todos os números do mapa, na ordem das salas/mesas/posições e depois dos celulares:
 * 'l:<mesaId>:<posicao>' para baia ativa sem vaga ligada e 'v:<celularId>:<vagaId>' para cada vaga.
 */
export const numerosDoMapa = (mapa: MapaWhatsapp): Map<string, RetratoNumero> => {
  const mesas = new Map(mapa.salas.flatMap((s) => s.mesas).map((m) => [m.id, m]));
  const ligadas = new Set<string>();
  for (const c of mapa.celulares) {
    const mesa = c.mesaId ? mesas.get(c.mesaId) : undefined;
    if (!mesa) continue;
    const ativas = posicoesAtivas(mesa);
    for (const v of c.vagas) if (v.baia && ativas.includes(v.baia) && mesa.lugares[v.baia]) ligadas.add(`${mesa.id}|${v.baia}`);
  }

  const numeros = new Map<string, RetratoNumero>();
  for (const mesa of mesas.values()) {
    for (const p of posicoesAtivas(mesa)) {
      if (ligadas.has(`${mesa.id}|${p}`) || !ehNumeroDoLugar(mesa, p)) continue;
      numeros.set(`l:${mesa.id}:${p}`, {
        situacao: mesa.lugares[p].whatsapp.situacao,
        operador: operadorDoLugar(mesa, p),
        codigo: codigoDoLugar(mesa.sigla, p),
        equipe: mesa.sigla,
        celular: '',
        vaga: '',
      });
    }
  }
  for (const c of mapa.celulares) {
    const mesa = c.mesaId ? mesas.get(c.mesaId) : undefined;
    for (const v of c.vagas) {
      const ligada = mesa && v.baia && ligadas.has(`${mesa.id}|${v.baia}`) ? v.baia : null;
      numeros.set(`v:${c.id}:${v.id}`, {
        situacao: ligada ? mesa!.lugares[ligada].whatsapp.situacao : v.whatsapp.situacao,
        operador: ligada ? operadorDoLugar(mesa!, ligada) : '',
        codigo: ligada ? codigoDoLugar(mesa!.sigla, ligada) : '',
        equipe: mesa?.sigla ?? '',
        celular: nomeDoCelular(c),
        vaga: `${v.grupo} · ${v.rotulo}`,
      });
    }
  }
  return numeros;
};

/** Acrescenta ao histórico do `depois` o que mudou em cada número desde o `antes` */
export const registrarMudancas = (antes: MapaWhatsapp, depois: MapaWhatsapp, agora: Date): MapaWhatsapp => {
  const velhos = numerosDoMapa(antes);
  const novos = numerosDoMapa(depois);
  const ultimo = depois.historico[depois.historico.length - 1];
  // Relógio voltou: mantém a linha do tempo em ordem
  const em = ultimo && new Date(ultimo.em) > agora ? ultimo.em : agora.toISOString();
  const manutencaoId = depois.manutencaoAtual?.id;

  const eventos: EventoWhatsapp[] = [];
  const evento = (chave: string, tipo: TipoEvento, de: string, para: string, r: RetratoNumero) =>
    eventos.push({
      em,
      chave,
      tipo,
      de,
      para,
      codigo: r.codigo,
      operador: r.operador,
      equipe: r.equipe,
      celular: r.celular,
      vaga: r.vaga,
      ...(manutencaoId ? { manutencaoId } : {}),
    });

  for (const [chave, depoisDele] of novos) {
    const antesDele = velhos.get(chave);
    if (!antesDele) {
      evento(chave, 'ENTROU', '', depoisDele.situacao, depoisDele);
      continue;
    }
    if (antesDele.situacao !== depoisDele.situacao) evento(chave, 'SITUACAO', antesDele.situacao, depoisDele.situacao, depoisDele);
    if (antesDele.operador !== depoisDele.operador) evento(chave, 'OPERADOR', antesDele.operador, depoisDele.operador, depoisDele);
  }
  for (const [chave, antesDele] of velhos) {
    if (!novos.has(chave)) evento(chave, 'SAIU', antesDele.situacao, '', antesDele);
  }

  return eventos.length ? { ...depois, historico: [...depois.historico, ...eventos] } : depois;
};

/** Histórico e manutenções guardam 12 meses */
export const podarHistorico = (mapa: MapaWhatsapp, agora: Date): MapaWhatsapp => {
  const limite = new Date(agora);
  limite.setMonth(limite.getMonth() - 12);
  const dentro = (iso: string) => new Date(iso) >= limite;
  const historico = mapa.historico.filter((e) => dentro(e.em));
  const manutencoes = mapa.manutencoes.filter((m) => dentro(m.inicio));
  if (historico.length === mapa.historico.length && manutencoes.length === mapa.manutencoes.length) return mapa;
  const inicioDoHistorico = dentro(mapa.inicioDoHistorico) ? mapa.inicioDoHistorico : limite.toISOString();
  return { ...mapa, historico, manutencoes, inicioDoHistorico };
};

/** O que o hook faz em toda alteração do mapa */
export const gravarAlteracao = (antes: MapaWhatsapp, depois: MapaWhatsapp, agora: Date): MapaWhatsapp =>
  podarHistorico(registrarMudancas(antes, depois, agora), agora);
