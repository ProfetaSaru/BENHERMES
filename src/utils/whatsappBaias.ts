import { CelularCorporativo, EstadoWhatsapp, Lugar, MapaWhatsapp, Mesa, Sala, Situacao } from '../types/whatsapp';
import { FormatoMesa, ajustarLugares, posicoesAtivas } from './mapaMesas';

/**
 * Regras do WhatsApp das Baias: situação de cada lugar, restrição com prazo, resumo,
 * e o arquivo .json do mapa. Tudo puro; "agora" vem sempre por parâmetro.
 */

export const ROTULOS: Record<Situacao, string> = {
  OK: 'OK',
  BANIDO: 'BANIDO',
  NAO_TEM: 'NÃO TEM',
  RESTRINGIDO: 'RESTRINGIDO',
};

const SITUACOES = Object.keys(ROTULOS) as Situacao[];

export const CORES_CELULARES: Record<string, string> = {
  VERDE: '#00B050',
  AZUL: '#00B0F0',
  VERMELHO: '#FF0000',
  CIANO: '#2BF8FD',
  PRETO: '#000000',
  ROXO: '#7030A0',
};

export const corDoCelular = (nome: string): string => CORES_CELULARES[nome.trim().toUpperCase()] ?? '#808080';

export const estado = (situacao: Situacao, agora: Date, restritoAte?: Date): EstadoWhatsapp => ({
  situacao,
  ...(restritoAte ? { restritoAte: restritoAte.toISOString() } : {}),
  mudouEm: agora.toISOString(),
});

export const novaMesa = (
  dados: Pick<Mesa, 'nome' | 'sigla' | 'supervisor' | 'esq' | 'dir' | 'centro' | 'inicio'>,
  agora: Date
): Mesa => {
  const mesa = { ...dados, id: crypto.randomUUID(), desativadas: [], lugares: {} } as Mesa;
  mesa.lugares = Object.fromEntries(posicoesAtivas(mesa).map((p) => [p, { operador: '', whatsapp: estado('OK', agora) }]));
  return mesa;
};

export const mapaInicial = (agora: Date): MapaWhatsapp => ({
  versao: 1,
  salas: [
    {
      id: crypto.randomUUID(),
      nome: 'Comercial 1',
      mesas: [novaMesa({ nome: '1º Equipe', sigla: 'OP1', supervisor: '', esq: 4, dir: 4, centro: 'SUPSUB', inicio: 'sup' }, agora)],
    },
  ],
  celulares: Object.entries(CORES_CELULARES).map(
    ([cor, hex]): CelularCorporativo => ({ cor, hex, messenger: estado('OK', agora), business: estado('OK', agora) })
  ),
  atualizadoEm: agora.toISOString(),
});

/** Nova situação (menos RESTRINGIDO, que precisa de prazo: use restringir) */
export const mudarSituacao = (atual: EstadoWhatsapp, nova: Situacao, agora: Date): EstadoWhatsapp => {
  if (nova === 'RESTRINGIDO') throw new Error('Para restringir, informe por quanto tempo.');
  return atual.situacao === nova ? atual : estado(nova, agora);
};

const HORA = 3_600_000;

export const restringir = (quantidade: number, unidade: 'horas' | 'dias', agora: Date): EstadoWhatsapp => {
  if (!Number.isFinite(quantidade) || quantidade <= 0) throw new Error('Informe um tempo maior que zero.');
  const horas = unidade === 'dias' ? quantidade * 24 : quantidade;
  return estado('RESTRINGIDO', agora, new Date(agora.getTime() + horas * HORA));
};

export const restricaoVencida = (e: EstadoWhatsapp, agora: Date): boolean =>
  e.situacao === 'RESTRINGIDO' && !!e.restritoAte && new Date(e.restritoAte).getTime() <= agora.getTime();

/** "1d 3h", "5h 20min", "45min"; vazio se não estiver restringido ou já venceu */
export const tempoRestante = (e: EstadoWhatsapp, agora: Date): string => {
  if (e.situacao !== 'RESTRINGIDO' || !e.restritoAte || restricaoVencida(e, agora)) return '';
  const minutos = Math.ceil((new Date(e.restritoAte).getTime() - agora.getTime()) / 60_000);
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  const resto = minutos % 60;
  if (dias > 0) return horas > 0 ? `${dias}d ${horas}h` : `${dias}d`;
  if (horas > 0) return resto > 0 ? `${horas}h ${resto}min` : `${horas}h`;
  return `${resto}min`;
};

export interface ResumoWhatsapp {
  ok: number;
  banido: number;
  restringido: number;
  vencidas: number;
  naoTem: number;
  vagasVazias: number;
}

const resumoVazio = (): ResumoWhatsapp => ({ ok: 0, banido: 0, restringido: 0, vencidas: 0, naoTem: 0, vagasVazias: 0 });

const somarMesa = (resumo: ResumoWhatsapp, mesa: Mesa, agora: Date): void => {
  for (const posicao of posicoesAtivas(mesa)) {
    const lugar = mesa.lugares[posicao];
    if (!lugar) continue;
    const { whatsapp } = lugar;
    if (whatsapp.situacao === 'OK') resumo.ok++;
    if (whatsapp.situacao === 'BANIDO') resumo.banido++;
    if (whatsapp.situacao === 'NAO_TEM') resumo.naoTem++;
    if (whatsapp.situacao === 'RESTRINGIDO') {
      resumo.restringido++;
      if (restricaoVencida(whatsapp, agora)) resumo.vencidas++;
    }
    if (/^[ED]\d+$/.test(posicao) && !lugar.operador.trim()) resumo.vagasVazias++;
  }
};

export const resumoDaSala = (sala: Sala, agora: Date): ResumoWhatsapp => {
  const resumo = resumoVazio();
  sala.mesas.forEach((mesa) => somarMesa(resumo, mesa, agora));
  return resumo;
};

export const resumoGeral = (mapa: MapaWhatsapp, agora: Date): ResumoWhatsapp => {
  const resumo = resumoVazio();
  mapa.salas.forEach((sala) => sala.mesas.forEach((mesa) => somarMesa(resumo, mesa, agora)));
  return resumo;
};

// ---------------------------------------------------------------------------
// Alterações (devolvem um mapa novo; o original não muda)
// ---------------------------------------------------------------------------

export const alterarMesaNoMapa = (
  mapa: MapaWhatsapp,
  salaId: string,
  mesaId: string,
  mudar: (mesa: Mesa) => Mesa,
  agora: Date
): MapaWhatsapp => ({
  ...mapa,
  salas: mapa.salas.map((s) =>
    s.id !== salaId ? s : { ...s, mesas: s.mesas.map((m) => (m.id === mesaId ? mudar(m) : m)) }
  ),
  atualizadoEm: agora.toISOString(),
});

export const alterarLugarNoMapa = (
  mapa: MapaWhatsapp,
  salaId: string,
  mesaId: string,
  posicao: string,
  mudanca: Partial<Lugar>,
  agora: Date
): MapaWhatsapp =>
  alterarMesaNoMapa(
    mapa,
    salaId,
    mesaId,
    (m) => ({ ...m, lugares: { ...m.lugares, [posicao]: { ...m.lugares[posicao], ...mudanca } } }),
    agora
  );

export const alterarCelularNoMapa = (
  mapa: MapaWhatsapp,
  cor: string,
  campo: 'messenger' | 'business',
  novo: EstadoWhatsapp,
  agora: Date
): MapaWhatsapp => ({
  ...mapa,
  celulares: mapa.celulares.map((c) => (c.cor === cor ? { ...c, [campo]: novo } : c)),
  atualizadoEm: agora.toISOString(),
});

// ---------------------------------------------------------------------------
// Configurar salas e mesas
// ---------------------------------------------------------------------------

const comSalas = (mapa: MapaWhatsapp, salas: Sala[], agora: Date): MapaWhatsapp => ({
  ...mapa,
  salas,
  atualizadoEm: agora.toISOString(),
});

export const adicionarSalaNoMapa = (mapa: MapaWhatsapp, nome: string, agora: Date): MapaWhatsapp =>
  comSalas(mapa, [...mapa.salas, { id: crypto.randomUUID(), nome: nome.trim(), mesas: [] }], agora);

export const renomearSalaNoMapa = (mapa: MapaWhatsapp, salaId: string, nome: string, agora: Date): MapaWhatsapp =>
  comSalas(mapa, mapa.salas.map((s) => (s.id === salaId ? { ...s, nome } : s)), agora);

export const removerSalaNoMapa = (mapa: MapaWhatsapp, salaId: string, agora: Date): MapaWhatsapp =>
  comSalas(mapa, mapa.salas.filter((s) => s.id !== salaId), agora);

export const adicionarMesaNoMapa = (mapa: MapaWhatsapp, salaId: string, mesa: Mesa, agora: Date): MapaWhatsapp =>
  comSalas(mapa, mapa.salas.map((s) => (s.id === salaId ? { ...s, mesas: [...s.mesas, mesa] } : s)), agora);

export const removerMesaNoMapa = (mapa: MapaWhatsapp, salaId: string, mesaId: string, agora: Date): MapaWhatsapp =>
  comSalas(mapa, mapa.salas.map((s) => (s.id === salaId ? { ...s, mesas: s.mesas.filter((m) => m.id !== mesaId) } : s)), agora);

export type DadosDaMesa = FormatoMesa & Pick<Mesa, 'nome' | 'supervisor'>;

/**
 * Novo formato da mesa: quem continua fica como está, posições novas entram vazias e OK,
 * e as que deixaram de existir voltam em `removidos` (para pedir confirmação se tinham operador).
 * Baias desativadas guardam o que tinham, para voltar igual ao reativar.
 */
export const formatarMesa = (
  mesa: Mesa,
  dados: DadosDaMesa,
  agora: Date
): { mesa: Mesa; removidos: { posicao: string; operador: string }[] } => {
  const { lugares, removidos } = ajustarLugares(mesa.lugares, { ...dados, desativadas: [] }, () => ({
    operador: '',
    whatsapp: estado('OK', agora),
  }));
  return {
    mesa: {
      ...mesa,
      ...dados,
      sigla: dados.sigla.trim().toUpperCase(),
      desativadas: dados.desativadas.filter((p) => p in lugares),
      lugares,
    },
    removidos: removidos.map((posicao) => ({ posicao, operador: mesa.lugares[posicao]?.operador ?? '' })),
  };
};

export const alternarDesativada = (mesa: Mesa, posicao: string, agora: Date): Mesa => {
  if (mesa.desativadas.includes(posicao)) {
    const lugares = posicao in mesa.lugares ? mesa.lugares : { ...mesa.lugares, [posicao]: { operador: '', whatsapp: estado('OK', agora) } };
    return { ...mesa, desativadas: mesa.desativadas.filter((p) => p !== posicao), lugares };
  }
  return { ...mesa, desativadas: [...mesa.desativadas, posicao] };
};

/** null = sigla pode ser usada; senão, o motivo */
export const siglaValida = (sigla: string, mapa: MapaWhatsapp, idDaMesa?: string): string | null => {
  const limpa = sigla.trim().toUpperCase();
  if (!limpa) return 'Informe a sigla da mesa.';
  if (!/^[A-Z0-9-]+$/.test(limpa)) return 'A sigla aceita só letras, números e hífen.';
  const usada = mapa.salas.some((s) => s.mesas.some((m) => m.id !== idDaMesa && m.sigla.toUpperCase() === limpa));
  return usada ? `A sigla ${limpa} já está em uso por outra mesa.` : null;
};

// ---------------------------------------------------------------------------
// Arquivo .json do mapa
// ---------------------------------------------------------------------------

export const TIPO_ARQUIVO = 'benhermes-whatsapp-baias';

export const exportarMapa = (mapa: MapaWhatsapp, agora: Date): string =>
  JSON.stringify({ tipo: TIPO_ARQUIVO, exportadoEm: agora.toISOString(), ...mapa }, null, 2);

const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const estadoValido = (e: any): boolean =>
  !!e && SITUACOES.includes(e.situacao) && ehTexto(e.mudouEm) && (e.restritoAte === undefined || ehTexto(e.restritoAte));

const mesaValida = (m: any): boolean =>
  !!m &&
  ehTexto(m.id) &&
  ehTexto(m.nome) &&
  ehTexto(m.sigla) &&
  ehTexto(m.supervisor) &&
  ehNumero(m.esq) &&
  ehNumero(m.dir) &&
  ['SUP', 'SUPSUB', 'NENHUM'].includes(m.centro) &&
  ['sup', 'porta'].includes(m.inicio) &&
  Array.isArray(m.desativadas) &&
  !!m.lugares &&
  typeof m.lugares === 'object' &&
  Object.values(m.lugares).every((l: any) => !!l && ehTexto(l.operador) && estadoValido(l.whatsapp));

/** Valida a estrutura e devolve só os campos do mapa */
const lerMapa = (dados: any): MapaWhatsapp => {
  const valido =
    !!dados &&
    dados.versao === 1 &&
    Array.isArray(dados.salas) &&
    dados.salas.every((s: any) => !!s && ehTexto(s.id) && ehTexto(s.nome) && Array.isArray(s.mesas) && s.mesas.every(mesaValida)) &&
    Array.isArray(dados.celulares) &&
    dados.celulares.every(
      (c: any) => !!c && ehTexto(c.cor) && ehTexto(c.hex) && estadoValido(c.messenger) && estadoValido(c.business)
    ) &&
    ehTexto(dados.atualizadoEm);
  if (!valido) throw new Error('O arquivo não é um mapa do WhatsApp das Baias válido.');
  return { versao: 1, salas: dados.salas, celulares: dados.celulares, atualizadoEm: dados.atualizadoEm };
};

export const importarMapa = (texto: string): MapaWhatsapp => {
  let dados: any;
  try {
    dados = JSON.parse(texto.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('O arquivo não é um .json válido.');
  }
  if (dados?.tipo !== TIPO_ARQUIVO) throw new Error('Este arquivo não foi exportado pelo WhatsApp das Baias.');
  return lerMapa(dados);
};

/** O que está salvo no navegador; se faltar ou estiver corrompido, começa do mapa inicial */
export const carregarMapa = (texto: string | null, agora: Date): MapaWhatsapp => {
  try {
    return lerMapa(JSON.parse(texto ?? ''));
  } catch {
    return mapaInicial(agora);
  }
};
