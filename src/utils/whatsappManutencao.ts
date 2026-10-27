import { Acao, AcaoFeita, EstadoWhatsapp, Janela, Manutencao, MapaWhatsapp } from '../types/whatsapp';
import { alterarCelularNoMapa, alterarEstadoDaVaga, estadoDaVaga, nomeDoCelular, ondeEstaABaia } from './celulares';
import { AlvoAlerta, resumoGeral } from './whatsappAlertas';
import { alterarLugarNoMapa, mudarSituacao, pedirAnalise, restricaoVencida, restringir } from './whatsappBaias';
import { RetratoNumero, numerosDoMapa } from './whatsappHistorico';

/**
 * Modo manutenção: a rotina diária (manhã e almoço da operação), celular por celular, com as ações
 * que de fato acontecem e o texto "REGISTRO DE MANUTENÇÃO — WHATSAPP" para o grupo. Tudo puro.
 */

export const GRUPO_SEM_CELULAR = 'sem-celular';

export const ROTULO_JANELA: Record<Janela, string> = { MANHA: 'Manhã', ALMOCO: 'Almoço', FORA: 'Fora do horário' };

/** Manhã 8:00–11:59, almoço da operação 12:00–14:59, fora o resto (faixas largas para atrasos) */
export const janelaDaHora = (d: Date): Janela => {
  const h = d.getHours();
  if (h >= 8 && h < 12) return 'MANHA';
  if (h >= 12 && h < 15) return 'ALMOCO';
  return 'FORA';
};

export const ACAO: Record<Acao, { emoji: string; rotulo: string; botao: string }> = {
  BANIDO: { emoji: '⛔', rotulo: 'Caiu', botao: 'Caiu (banido)' },
  RESTRINGIDO: { emoji: '⏳', rotulo: 'Restringido', botao: 'Restringido' },
  PEDIU_ANALISE: { emoji: '📨', rotulo: 'Pedi análise', botao: 'Pedi análise' },
  LIBERADO: { emoji: '🟢', rotulo: 'Liberado', botao: 'Liberado' },
  PERDIDO: { emoji: '✖️', rotulo: 'Perdido', botao: 'Perdido' },
  TROCOU_CHIP: { emoji: '🔁', rotulo: 'Chip trocado', botao: 'Troquei o chip' },
  VOLTOU: { emoji: '🟢', rotulo: 'Voltou', botao: 'Voltou' },
};

/** Só os botões que fazem sentido para a situação */
export const acoesPossiveis = (e: EstadoWhatsapp, agora: Date): Acao[] => {
  switch (e.situacao) {
    case 'OK':
      return ['BANIDO', 'RESTRINGIDO'];
    case 'BANIDO':
      return ['PEDIU_ANALISE'];
    case 'ANALISE':
      return ['LIBERADO', 'PERDIDO'];
    case 'PERMANENTE':
      return ['TROCOU_CHIP'];
    case 'RESTRINGIDO':
      return restricaoVencida(e, agora) ? ['VOLTOU'] : [];
    default:
      return [];
  }
};

const comManutencao = (mapa: MapaWhatsapp, mudar: (m: Manutencao) => Manutencao): MapaWhatsapp =>
  mapa.manutencaoAtual ? { ...mapa, manutencaoAtual: mudar(mapa.manutencaoAtual) } : mapa;

export const iniciarManutencao = (mapa: MapaWhatsapp, agora: Date): MapaWhatsapp =>
  mapa.manutencaoAtual
    ? mapa
    : {
        ...mapa,
        manutencaoAtual: {
          id: crypto.randomUUID(),
          inicio: agora.toISOString(),
          fim: null,
          janela: janelaDaHora(agora),
          conferidos: [],
          acoes: [],
          observacao: '',
          texto: '',
        },
      };

export const trocarJanela = (mapa: MapaWhatsapp, janela: Janela): MapaWhatsapp => comManutencao(mapa, (m) => ({ ...m, janela }));

export const alternarConferido = (mapa: MapaWhatsapp, id: string): MapaWhatsapp =>
  comManutencao(mapa, (m) => ({
    ...m,
    conferidos: m.conferidos.includes(id) ? m.conferidos.filter((c) => c !== id) : [...m.conferidos, id],
  }));

// ---------------------------------------------------------------------------
// Etapas e números
// ---------------------------------------------------------------------------

export interface Etapa {
  id: string;
  titulo: string;
  equipe: string;
  hex: string | null;
}

const ordemDasMesas = (mapa: MapaWhatsapp) => mapa.salas.flatMap((s) => s.mesas.map((m) => ({ sala: s, mesa: m })));

/** Celulares na ordem das mesas do mapa, depois os guardados; por fim as baias sem celular */
export const etapasDaManutencao = (mapa: MapaWhatsapp): Etapa[] => {
  const mesas = ordemDasMesas(mapa);
  const posicao = (mesaId: string | null) => {
    const i = mesas.findIndex((x) => x.mesa.id === mesaId);
    return i < 0 ? mesas.length : i;
  };
  const celulares = [...mapa.celulares]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => posicao(a.c.mesaId) - posicao(b.c.mesaId) || a.i - b.i)
    .map(({ c }) => ({ id: c.id, titulo: nomeDoCelular(c), equipe: mesas.find((x) => x.mesa.id === c.mesaId)?.mesa.sigla ?? '', hex: c.hex }));
  const temSemCelular = [...numerosDoMapa(mapa).keys()].some((k) => k.startsWith('l:'));
  return temSemCelular ? [...celulares, { id: GRUPO_SEM_CELULAR, titulo: 'Sem celular', equipe: '', hex: null }] : celulares;
};

export interface NumeroDaEtapa {
  chave: string;
  alvo: AlvoAlerta;
  retrato: RetratoNumero;
  estado: EstadoWhatsapp;
}

/** Os números de uma etapa: as vagas do celular, ou as baias sem vaga ligada */
export const numerosDaEtapa = (mapa: MapaWhatsapp, etapaId: string): NumeroDaEtapa[] => {
  const numeros = numerosDoMapa(mapa);
  if (etapaId === GRUPO_SEM_CELULAR) {
    const mesas = ordemDasMesas(mapa);
    return [...numeros.entries()]
      .filter(([k]) => k.startsWith('l:'))
      .map(([chave, retrato]) => {
        const [, mesaId, posicao] = chave.split(':');
        const { sala, mesa } = mesas.find((x) => x.mesa.id === mesaId)!;
        return { chave, alvo: { tipo: 'lugar' as const, salaId: sala.id, mesaId, posicao }, retrato, estado: mesa.lugares[posicao].whatsapp };
      });
  }
  const celular = mapa.celulares.find((c) => c.id === etapaId);
  if (!celular) return [];
  return celular.vagas.map((v) => {
    const chave = `v:${celular.id}:${v.id}`;
    return { chave, alvo: { tipo: 'vaga' as const, celularId: celular.id, vagaId: v.id }, retrato: numeros.get(chave)!, estado: estadoDaVaga(mapa, celular, v) };
  });
};

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

/** Chave do número do alvo (a baia com vaga ligada é o número da vaga) */
const chaveDoAlvo = (mapa: MapaWhatsapp, alvo: AlvoAlerta): string => {
  if (alvo.tipo === 'vaga') return `v:${alvo.celularId}:${alvo.vagaId}`;
  const ligada = ondeEstaABaia(mapa, alvo.mesaId, alvo.posicao);
  const daVaga = ligada && `v:${ligada.celular.id}:${ligada.vaga.id}`;
  return daVaga && numerosDoMapa(mapa).get(daVaga)?.codigo ? daVaga : `l:${alvo.mesaId}:${alvo.posicao}`;
};

const estadoDoAlvo = (mapa: MapaWhatsapp, alvo: AlvoAlerta): EstadoWhatsapp | null => {
  if (alvo.tipo === 'lugar') {
    const mesa = mapa.salas.find((s) => s.id === alvo.salaId)?.mesas.find((m) => m.id === alvo.mesaId);
    return mesa?.lugares[alvo.posicao]?.whatsapp ?? null;
  }
  const celular = mapa.celulares.find((c) => c.id === alvo.celularId);
  const vaga = celular?.vagas.find((v) => v.id === alvo.vagaId);
  return celular && vaga ? estadoDaVaga(mapa, celular, vaga) : null;
};

const novoEstado = (atual: EstadoWhatsapp, acao: Acao, agora: Date, extra?: ExtraDaAcao): EstadoWhatsapp => {
  switch (acao) {
    case 'BANIDO':
      return mudarSituacao(atual, 'BANIDO', agora);
    case 'RESTRINGIDO':
      return restringir(extra?.restricao?.quantidade ?? NaN, extra?.restricao?.unidade ?? 'horas', agora);
    case 'PEDIU_ANALISE':
      return pedirAnalise(agora);
    case 'PERDIDO':
      return mudarSituacao(atual, 'PERMANENTE', agora);
    default:
      return mudarSituacao(atual, 'OK', agora);
  }
};

export interface ExtraDaAcao {
  restricao?: { quantidade: number; unidade: 'horas' | 'dias' };
  numeroNovo?: string;
}

/**
 * Muda a situação do número (pelas mesmas funções do painel) e, com manutenção aberta, registra a
 * ação com o retrato de antes. RESTRINGIDO lança o erro de `restringir` se o tempo for inválido.
 */
export const aplicarAcao = (mapa: MapaWhatsapp, alvo: AlvoAlerta, acao: Acao, agora: Date, extra?: ExtraDaAcao): MapaWhatsapp => {
  const atual = estadoDoAlvo(mapa, alvo);
  if (!atual) return mapa;
  const chave = chaveDoAlvo(mapa, alvo);
  const retrato = numerosDoMapa(mapa).get(chave);
  const estado = novoEstado(atual, acao, agora, extra);

  let novo =
    alvo.tipo === 'lugar'
      ? alterarLugarNoMapa(mapa, alvo.salaId, alvo.mesaId, alvo.posicao, { whatsapp: estado }, agora)
      : alterarEstadoDaVaga(mapa, alvo.celularId, alvo.vagaId, estado, agora);

  const numeroNovo = acao === 'TROCOU_CHIP' ? extra?.numeroNovo?.trim() : '';
  if (numeroNovo && chave.startsWith('v:')) {
    const [, celularId, vagaId] = chave.split(':');
    novo = alterarCelularNoMapa(novo, celularId, (c) => ({ ...c, vagas: c.vagas.map((v) => (v.id === vagaId ? { ...v, numero: numeroNovo } : v)) }), agora);
  }

  const feita: AcaoFeita = {
    em: agora.toISOString(),
    acao,
    chave,
    codigo: retrato?.codigo ?? '',
    operador: retrato?.operador ?? '',
    celular: retrato?.celular ?? '',
    vaga: retrato?.vaga ?? '',
    ...(numeroNovo ? { numeroNovo } : {}),
    ...(acao === 'RESTRINGIDO' && estado.restritoAte ? { ate: estado.restritoAte } : {}),
  };
  return comManutencao(novo, (m) => ({ ...m, acoes: [...m.acoes, feita] }));
};

// ---------------------------------------------------------------------------
// Texto do grupo
// ---------------------------------------------------------------------------

const dois = (n: number) => String(n).padStart(2, '0');
const hora = (d: Date) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
const data = (d: Date) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
const diaEHora = (d: Date) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${hora(d)}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const linhaDaAcao = (a: AcaoFeita): string => {
  const onde = a.codigo ? `${a.codigo} (${a.operador || 'vaga vazia'})` : a.vaga;
  const celular = a.celular ? ` · ${a.celular}` : '';
  const ate = a.ate ? ` até ${diaEHora(new Date(a.ate))}` : '';
  return `${ACAO[a.acao].emoji} ${ACAO[a.acao].rotulo}: ${onde}${celular}${ate}`;
};

/** O texto "REGISTRO DE MANUTENÇÃO — WHATSAPP" no formato do grupo (negrito com *) */
export const textoDaManutencao = (m: Manutencao, mapa: MapaWhatsapp, agora: Date): string => {
  const inicio = new Date(m.inicio);
  const fim = m.fim ? new Date(m.fim) : agora;
  const r = resumoGeral(mapa, agora);
  const etapas = etapasDaManutencao(mapa);
  const conferidos = etapas.filter((e) => e.id !== GRUPO_SEM_CELULAR && m.conferidos.includes(e.id)).length;

  const comoFicou = [
    r.banido && `⛔ ${plural(r.banido, 'banido', 'banidos')}`,
    r.analise && `🔎 ${r.analise} em análise`,
    r.permanente && `✖️ ${plural(r.permanente, 'perdido', 'perdidos')}`,
    r.restringido && `⏳ ${plural(r.restringido, 'restringido', 'restringidos')}`,
  ].filter(Boolean);

  const celulares = etapas
    .map((e) => `${e.titulo}${e.equipe ? ` (${e.equipe})` : ''} ${m.conferidos.includes(e.id) ? '✅' : '⬜'}`)
    .join(' · ');

  return [
    '🔧 *REGISTRO DE MANUTENÇÃO — WHATSAPP*',
    `📅 ${data(inicio)} · ${ROTULO_JANELA[m.janela]} (${hora(inicio)}–${hora(fim)})`,
    `✅ ${plural(conferidos, 'celular conferido', 'celulares conferidos')} · ${r.ok} WhatsApps OK`,
    '',
    '*O que foi feito*',
    ...(m.acoes.length ? m.acoes.map(linhaDaAcao) : ['Tudo conferido, nenhuma ação necessária.']),
    '',
    '*Como ficou*',
    comoFicou.length ? comoFicou.join(' · ') : 'Tudo OK',
    '',
    ...(celulares ? [`📱 ${celulares}`] : []),
    ...(m.observacao.trim() ? [`📝 Obs: ${m.observacao.trim()}`] : []),
    '🎥 Vídeos a seguir',
  ].join('\n');
};

/** Fecha a manutenção aberta, gera o texto e guarda o registro */
export const concluirManutencao = (mapa: MapaWhatsapp, observacao: string, agora: Date): { mapa: MapaWhatsapp; texto: string } => {
  if (!mapa.manutencaoAtual) return { mapa, texto: '' };
  const aberta = { ...mapa.manutencaoAtual, fim: agora.toISOString(), observacao: observacao.trim() };
  const texto = textoDaManutencao(aberta, mapa, agora);
  return {
    mapa: { ...mapa, manutencaoAtual: null, manutencoes: [...mapa.manutencoes, { ...aberta, texto }] },
    texto,
  };
};

/** Descarta o registro; as mudanças de situação já feitas continuam */
export const cancelarManutencao = (mapa: MapaWhatsapp): MapaWhatsapp => ({ ...mapa, manutencaoAtual: null });
