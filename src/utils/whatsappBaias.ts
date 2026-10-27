import { EstadoWhatsapp, Lugar, MapaWhatsapp, Mesa, Sala, Situacao, WhatsappDoSupervisor } from '../types/whatsapp';
import { FormatoMesa, ajustarLugares, posicoesAtivas } from './mapaMesas';

/**
 * Regras do WhatsApp das Baias: situação de cada lugar, ciclo do banimento, restrição com prazo,
 * mesas e o arquivo .json do mapa. Tudo puro; "agora" vem sempre por parâmetro.
 */

/** Rótulos curtos (planilha, botões, chips) */
export const ROTULOS: Record<Situacao, string> = {
  OK: 'OK',
  BANIDO: 'BANIDO',
  ANALISE: 'EM ANÁLISE',
  PERMANENTE: 'PERDIDO',
  RESTRINGIDO: 'RESTRINGIDO',
  NAO_TEM: 'NÃO TEM',
};

/** Rótulos longos (tela) */
export const DESCRICOES: Record<Situacao, string> = {
  OK: 'OK',
  BANIDO: 'Banido — pedir análise',
  ANALISE: 'Em análise',
  PERMANENTE: 'Perdido (permanente)',
  RESTRINGIDO: 'Restringido',
  NAO_TEM: 'Não tem',
};

const SITUACOES = Object.keys(ROTULOS) as Situacao[];

export const estado = (situacao: Situacao, agora: Date, restritoAte?: Date): EstadoWhatsapp => ({
  situacao,
  ...(restritoAte ? { restritoAte: restritoAte.toISOString() } : {}),
  mudouEm: agora.toISOString(),
});

export const novaMesa = (
  dados: Pick<Mesa, 'nome' | 'sigla' | 'supervisor' | 'esq' | 'dir' | 'centro' | 'inicio'> &
    Partial<Pick<Mesa, 'whatsappSupervisor'>>,
  agora: Date
): Mesa => {
  const mesa = { whatsappSupervisor: 'PC', ...dados, id: crypto.randomUUID(), desativadas: [], lugares: {} } as Mesa;
  mesa.lugares = Object.fromEntries(posicoesAtivas(mesa).map((p) => [p, { operador: '', whatsapp: estado('OK', agora) }]));
  return mesa;
};

export const mapaInicial = (agora: Date): MapaWhatsapp => ({
  versao: 2,
  salas: [
    {
      id: crypto.randomUUID(),
      nome: 'Comercial 1',
      mesas: [novaMesa({ nome: '1º Equipe', sigla: 'OP1', supervisor: '', esq: 4, dir: 4, centro: 'SUP', inicio: 'sup' }, agora)],
    },
  ],
  celulares: [],
  atualizadoEm: agora.toISOString(),
});

/** Nova situação (menos RESTRINGIDO e ANALISE: use restringir e pedirAnalise) */
export const mudarSituacao = (atual: EstadoWhatsapp, nova: Situacao, agora: Date): EstadoWhatsapp => {
  if (nova === 'RESTRINGIDO') throw new Error('Para restringir, informe por quanto tempo.');
  if (nova === 'ANALISE') throw new Error('Use "Pedi a análise" para registrar a hora do pedido.');
  return atual.situacao === nova ? atual : estado(nova, agora);
};

const HORA = 3_600_000;

/** O número caiu e a análise foi pedida agora */
export const pedirAnalise = (agora: Date): EstadoWhatsapp => ({
  situacao: 'ANALISE',
  analisePedidaEm: agora.toISOString(),
  mudouEm: agora.toISOString(),
});

/** Análise pedida há 24 h ou mais sem resposta */
export const analiseAtrasada = (e: EstadoWhatsapp, agora: Date): boolean =>
  e.situacao === 'ANALISE' && !!e.analisePedidaEm && agora.getTime() - new Date(e.analisePedidaEm).getTime() >= 24 * HORA;

/** "45min", "3h", "26h" (até 47 h), "3d" */
export const tempoDesde = (iso: string, agora: Date): string => {
  const minutos = Math.max(0, Math.floor((agora.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  return horas < 48 ? `${horas}h` : `${Math.floor(horas / 24)}d`;
};

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
  !!e &&
  SITUACOES.includes(e.situacao) &&
  ehTexto(e.mudouEm) &&
  (e.restritoAte === undefined || ehTexto(e.restritoAte)) &&
  (e.analisePedidaEm === undefined || ehTexto(e.analisePedidaEm));

const mesaValida = (m: any): boolean =>
  !!m &&
  ehTexto(m.id) &&
  ehTexto(m.nome) &&
  ehTexto(m.sigla) &&
  ehTexto(m.supervisor) &&
  ['NAO_TEM', 'PC', 'CELULAR'].includes(m.whatsappSupervisor) &&
  ehNumero(m.esq) &&
  ehNumero(m.dir) &&
  ['SUP', 'SUPSUB', 'NENHUM'].includes(m.centro) &&
  ['sup', 'porta'].includes(m.inicio) &&
  Array.isArray(m.desativadas) &&
  !!m.lugares &&
  typeof m.lugares === 'object' &&
  Object.values(m.lugares).every((l: any) => !!l && ehTexto(l.operador) && estadoValido(l.whatsapp));

const vagaValida = (v: any): boolean =>
  !!v &&
  ehTexto(v.id) &&
  ehTexto(v.grupo) &&
  ['MESSENGER', 'BUSINESS'].includes(v.app) &&
  ehTexto(v.rotulo) &&
  (v.baia === null || ehTexto(v.baia)) &&
  estadoValido(v.whatsapp) &&
  ehTexto(v.numero);

const celularValido = (c: any): boolean =>
  !!c &&
  ehTexto(c.id) &&
  ehTexto(c.cor) &&
  ehTexto(c.hex) &&
  ehTexto(c.apelido) &&
  ['SAMSUNG', 'MOTOROLA', 'XIAOMI', 'IPHONE', 'OUTRO'].includes(c.marca) &&
  ehNumero(c.usuarios) &&
  (c.mesaId === null || ehTexto(c.mesaId)) &&
  typeof c.compartilhado === 'boolean' &&
  ehTexto(c.nomeBackup) &&
  Array.isArray(c.vagas) &&
  c.vagas.every(vagaValida);

/**
 * Versão 1 → 2: mantém salas, mesas e lugares; tira o backup (SUB) e os celulares antigos;
 * supervisor com NÃO TEM passa a ser "sem WhatsApp".
 */
export const migrarMapa = (dados: any): MapaWhatsapp => ({
  versao: 2,
  atualizadoEm: dados.atualizadoEm,
  celulares: [],
  salas: (dados.salas ?? []).map((sala: any) => ({
    ...sala,
    mesas: (sala.mesas ?? []).map((mesa: any) => {
      const { SUB: _backup, ...lugares } = mesa.lugares ?? {};
      const semWhatsapp = mesa.lugares?.SUP?.whatsapp?.situacao === 'NAO_TEM';
      return {
        ...mesa,
        centro: mesa.centro === 'SUPSUB' ? 'SUP' : mesa.centro,
        desativadas: (mesa.desativadas ?? []).filter((p: string) => p !== 'SUB'),
        whatsappSupervisor: (semWhatsapp ? 'NAO_TEM' : 'PC') as WhatsappDoSupervisor,
        lugares,
      };
    }),
  })),
});

/** Valida a estrutura (migrando a versão 1) e devolve só os campos do mapa */
const lerMapa = (bruto: any): MapaWhatsapp => {
  const dados = bruto?.versao === 1 && Array.isArray(bruto.salas) ? migrarMapa(bruto) : bruto;
  const valido =
    !!dados &&
    dados.versao === 2 &&
    Array.isArray(dados.salas) &&
    dados.salas.every((s: any) => !!s && ehTexto(s.id) && ehTexto(s.nome) && Array.isArray(s.mesas) && s.mesas.every(mesaValida)) &&
    Array.isArray(dados.celulares) &&
    dados.celulares.every(celularValido) &&
    ehTexto(dados.atualizadoEm);
  if (!valido) throw new Error('O arquivo não é um mapa do WhatsApp das Baias válido.');
  return { versao: 2, salas: dados.salas, celulares: dados.celulares, atualizadoEm: dados.atualizadoEm };
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

/**
 * O que está salvo no navegador. Sem nada salvo, começa do mapa inicial; com algo salvo que não dá
 * para ler, também, mas avisa (`ilegivel`) para guardar uma cópia antes de sobrescrever.
 */
export const lerMapaSalvo = (texto: string | null, agora: Date): { mapa: MapaWhatsapp; ilegivel: boolean } => {
  if (texto === null) return { mapa: mapaInicial(agora), ilegivel: false };
  try {
    return { mapa: lerMapa(JSON.parse(texto)), ilegivel: false };
  } catch {
    return { mapa: mapaInicial(agora), ilegivel: true };
  }
};

export const carregarMapa = (texto: string | null, agora: Date): MapaWhatsapp => lerMapaSalvo(texto, agora).mapa;
