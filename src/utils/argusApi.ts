import { ArquivoCarregado } from '../types/relatorioUra';
import { isoParaBr, normalizarNome } from './calendario';
import { comoDicionarios } from './uraLeitura';

/**
 * Download do desempenho, dos leads da URA e do cadastro de operadores pela API do Argus.
 * Mesmas regras do argus_api.py do BENZAITEN. As chamadas passam pela ponte /api/argus
 * (server/argusProxy.ts): no npm run dev, pelo servidor do Vite; no site, pela função da Vercel.
 *
 * As linhas saem com as mesmas colunas das exportações manuais, então o relatório
 * funciona igual com os dois. A TARIFAÇÃO não existe na API: continua manual.
 */

export const URL_PADRAO_ARGUS = 'https://argus.app.br/apiargus';
const FUSO = '-03:00'; // horário de Brasília
const GRUPO_URA = 'RECEPTIVO - URA';

export interface ConfigArgus {
  token: string;
  url: string;
}

type Registro = Record<string, unknown>;

/**
 * Como reconhecer cada informação no desempenho. A documentação do Argus não lista os
 * nomes dos campos: primeiro procuramos um destes nomes exatos; se nenhum existir,
 * um campo que CONTENHA todos os pedaços de "contem" e nenhum de "evita".
 */
const CAMPOS_DESEMPENHO: Record<string, { exatos: string[]; contem: string[]; evita?: string[] }> = {
  operador: { exatos: ['nomeUsuario', 'nomeOperador', 'usuario', 'operador', 'nome'], contem: ['nome'], evita: ['supervisor'] },
  supervisor: { exatos: ['nomeUsuarioSupervisor', 'supervisor', 'nomeSupervisor'], contem: ['supervisor'] },
  tma: { exatos: ['tma', 'tempoMedioAtendimento'], contem: ['tma'] },
  tme: { exatos: ['tme', 'tempoMedioEspera', 'tmo'], contem: ['tme'] },
  // No grupo RECEPTIVO - URA, cada atendimento é um lead atendido
  leads: { exatos: ['leadsAtendidos', 'qtdeLeadsAtendidos', 'leadsAtend', 'qtdeAtendimentoTotal'], contem: ['lead', 'atend'] },
  // Quantidade de atendimentos: peso ao juntar as linhas do mesmo operador
  atendimentos: { exatos: ['qtdeAtendimentoTotal'], contem: ['qtde', 'atendimento', 'total'] },
};

// ---------------------------------------------------------------------------
// Chamadas
// ---------------------------------------------------------------------------

const chamar = async (caminho: string, corpo: unknown, config: ConfigArgus): Promise<any> => {
  let resposta: Response;
  try {
    resposta = await fetch(`/api/argus?caminho=${encodeURIComponent(caminho)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Argus-Token': config.token.trim(),
        'X-Argus-Url': config.url.trim() || URL_PADRAO_ARGUS,
      },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error('A ponte com o Argus não respondeu. Confira a internet e tente de novo.');
  }
  const dados = await resposta.json().catch(() => null);
  if (!dados) {
    throw new Error('A ponte com o Argus não está ativa neste endereço (resposta inesperada do servidor).');
  }
  if (!resposta.ok) throw new Error(dados.erro ?? `Erro ${resposta.status} ao falar com o Argus.`);
  return dados;
};

const periodoDoDia = (dia: string) => ({ periodoInicial: `${dia}T00:00:00${FUSO}`, periodoFinal: `${dia}T23:59:59${FUSO}` });

const buscarDesempenho = async (
  dia: string,
  config: ConfigArgus,
  idGrupo?: number,
  idCampanha?: number
): Promise<Registro[]> => {
  const corpo = {
    ...periodoDoDia(dia),
    ...(idGrupo !== undefined ? { idGrupoUsuario: idGrupo } : {}),
    ...(idCampanha !== undefined ? { idCampanha } : {}),
  };
  const dados = await chamar('report/desempenhoresumido', corpo, config);
  return dados.desempenhosResumidos ?? [];
};

const buscarGrupos = async (config: ConfigArgus): Promise<Registro[]> =>
  (await chamar('cmd/listargrupos', { idTipoGrupo: 1 }, config)).grupos ?? [];

const buscarUsuarios = async (config: ConfigArgus): Promise<Registro[]> =>
  (await chamar('cmd/listarusuarios', { idTipoUsuario: 2 }, config)).usuarios ?? [];

// ---------------------------------------------------------------------------
// Tratamento dos dados
// ---------------------------------------------------------------------------

/** Qual campo do Argus traz a informação pedida (ex.: "tma"), ou null */
export const acharCampo = (chaves: string[], informacao: string): string | null => {
  const regra = CAMPOS_DESEMPENHO[informacao];
  const porMinusculo = new Map(chaves.map((c) => [c.toLowerCase(), c]));
  for (const nome of regra.exatos) {
    const campo = porMinusculo.get(nome.toLowerCase());
    if (campo) return campo;
  }
  return (
    chaves.find(
      (c) =>
        regra.contem.every((p) => c.toLowerCase().includes(p)) && !(regra.evita ?? []).some((p) => c.toLowerCase().includes(p))
    ) ?? null
  );
};

const mapearCampos = (registros: Registro[], informacoes: string[]): Record<string, string> => {
  const chaves = registros.length > 0 ? Object.keys(registros[0]) : [];
  const mapa = Object.fromEntries(informacoes.map((info) => [info, acharCampo(chaves, info)]));
  const faltando = informacoes.filter((info) => !mapa[info]);
  if (faltando.length > 0) {
    throw new Error(
      `Não encontrei no desempenho do Argus: ${faltando.join(', ')}. Campos que vieram: ${chaves.join(', ') || '(nenhum registro)'}.`
    );
  }
  return mapa as Record<string, string>;
};

/** Valor da API em número (vazio vira 0; "hh:mm:ss" vira segundos) */
export const numero = (valor: unknown): number => {
  if (typeof valor === 'string' && (valor.match(/:/g) ?? []).length === 2) {
    const [h, m, s] = valor.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  }
  const n = Number(valor || 0);
  return Number.isNaN(n) ? 0 : n;
};

/** Tempo no formato hh:mm:ss, igual à exportação manual (a API pode mandar segundos) */
export const formatarTempo = (valor: unknown): string => {
  if (valor === null || valor === undefined || valor === '') return '';
  if (typeof valor === 'string' && valor.includes(':')) return valor;
  const total = Math.round(Number(valor));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
};

/** Média de [valor, peso]; sem peso maior que zero, média simples */
export const mediaPonderada = (pares: [number, number][]): number => {
  const totalPeso = pares.reduce((s, [, peso]) => s + peso, 0);
  if (totalPeso > 0) return pares.reduce((s, [v, peso]) => s + v * peso, 0) / totalPeso;
  return pares.length > 0 ? pares.reduce((s, [v]) => s + v, 0) / pares.length : 0;
};

const supervisoresPorOperador = (usuarios: Registro[]): Map<string, string> => {
  const mapa = new Map<string, string>();
  for (const u of usuarios) {
    const primeiro = ((u.campanhas as Registro[]) ?? []).map((c) => c.nomeUsuarioSupervisor).find(Boolean);
    if (primeiro) mapa.set(normalizarNome(u.nome), String(primeiro));
  }
  return mapa;
};

const idsGrupoUra = (grupos: Registro[]): number[] =>
  grupos
    .filter((g) => normalizarNome(g.grupoUsuarioDesc).includes(normalizarNome(GRUPO_URA)))
    .map((g) => Number(g.idGrupoUsuario));

/** O Argus devolve várias linhas por operador; junta mantendo a ordem em que aparecem */
const agruparPorOperador = (registros: Registro[], campo: string): Map<string, { nome: string; linhas: Registro[] }> => {
  const grupos = new Map<string, { nome: string; linhas: Registro[] }>();
  for (const r of registros) {
    const nome = String(r[campo] ?? '');
    const chave = normalizarNome(nome);
    if (!grupos.has(chave)) grupos.set(chave, { nome, linhas: [] });
    grupos.get(chave)!.linhas.push(r);
  }
  return grupos;
};

/** Data; Operador; Supervisor; TME; TMA — TMA e TME = média ponderada pelos atendimentos */
export const linhasDesempenho = (registros: Registro[], dia: string, supervisores: Map<string, string>): string[][] => {
  if (registros.length === 0) return [];
  const campos = mapearCampos(registros, ['operador', 'tma', 'tme']);
  const chaves = Object.keys(registros[0]);
  const campoSup = acharCampo(chaves, 'supervisor');
  const campoPeso = acharCampo(chaves, 'atendimentos');

  return [...agruparPorOperador(registros, campos.operador)].map(([chave, { nome, linhas }]) => {
    const pesos = linhas.map((r) => (campoPeso ? numero(r[campoPeso]) : 1));
    const tma = mediaPonderada(linhas.map((r, i) => [numero(r[campos.tma]), pesos[i]]));
    const tme = mediaPonderada(linhas.map((r, i) => [numero(r[campos.tme]), pesos[i]]));
    const supervisor = String((campoSup ? linhas[0][campoSup] : '') || supervisores.get(chave) || '');
    return [isoParaBr(dia), nome, supervisor, formatarTempo(tme), formatarTempo(tma)];
  });
};

/** Data; Operador; Supervisor; Leads. Atend. — soma os grupos da URA */
export const linhasLeads = (porGrupo: Registro[][], dia: string, supervisores: Map<string, string>): string[][] => {
  const todos = porGrupo.flat();
  if (todos.length === 0) return [];
  const campos = mapearCampos(todos, ['operador', 'leads']);
  const campoSup = acharCampo(Object.keys(todos[0]), 'supervisor');
  const somas = new Map<string, { nome: string; supervisor: string; leads: number }>();
  for (const r of todos) {
    const nome = String(r[campos.operador] ?? '');
    const chave = normalizarNome(nome);
    const atual = somas.get(chave) ?? {
      nome,
      supervisor: String((campoSup ? r[campoSup] : '') || supervisores.get(chave) || ''),
      leads: 0,
    };
    atual.leads += Math.trunc(Number(r[campos.leads] || 0)) || 0;
    somas.set(chave, atual);
  }
  return [...somas.values()].map((s) => [isoParaBr(dia), s.nome, s.supervisor, String(s.leads)]);
};

/** Cadastro com as colunas da exportação manual (a ponte já descartou CPF, e-mail etc.) */
export const linhasOperadores = (usuarios: Registro[]): string[][] =>
  usuarios.map((u) => {
    const campanhas = (u.campanhas as Registro[]) ?? [];
    const grupos = campanhas.map((c) => c.grupoUsuarioDesc).filter(Boolean).join(', ');
    const supervisores = campanhas.map((c) => c.nomeUsuarioSupervisor).filter(Boolean).join(', ');
    return [String(u.idUsuario ?? ''), String(u.nome ?? ''), grupos, supervisores, u.ativo ? 'ATIVO' : 'INATIVO'];
  });

/**
 * Baixa tudo do dia e devolve como "arquivos" do relatório (desempenho, leads e operadores).
 */
export const baixarDoArgus = async (dia: string, config: ConfigArgus): Promise<ArquivoCarregado[]> => {
  if (!config.token.trim()) throw new Error('Cole o token da API do Argus nas configurações.');

  const usuarios = await buscarUsuarios(config);
  const supervisores = supervisoresPorOperador(usuarios);
  const gruposUra = idsGrupoUra(await buscarGrupos(config));
  if (gruposUra.length === 0) throw new Error(`Não encontrei o grupo operacional '${GRUPO_URA}' no Argus.`);

  const desempenho = await buscarDesempenho(dia, config);
  const leads = await Promise.all(gruposUra.map((id) => buscarDesempenho(dia, config, id)));

  const arquivo = (nome: string, tipo: ArquivoCarregado['tipo'], cabecalho: string[], linhas: string[][]): ArquivoCarregado => ({
    id: `argus-${tipo}-${dia}`,
    nome,
    tipo,
    linhas: comoDicionarios(cabecalho, linhas),
  });

  return [
    arquivo(`Argus API — desempenho ${isoParaBr(dia)}`, 'desempenho', ['Data', 'Operador', 'Supervisor', 'TME', 'TMA'], linhasDesempenho(desempenho, dia, supervisores)),
    arquivo(`Argus API — leads URA ${isoParaBr(dia)}`, 'leads', ['Data', 'Operador', 'Supervisor', 'Leads. Atend.'], linhasLeads(leads, dia, supervisores)),
    arquivo('Argus API — operadores', 'operadores', ['Cód. Usuário', 'Nome', '[Campanha] Grupo Associado', 'Supervisor(es)', 'Status'], linhasOperadores(usuarios)),
  ];
};

// ---------------------------------------------------------------------------
// Diagnóstico dos leads
// ---------------------------------------------------------------------------

const escaparCampo = (valor: unknown): string => {
  const texto = String(valor ?? '');
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/**
 * CSV para descobrir qual filtro da API bate com a exportação manual de leads da URA.
 * Para cada operador: atendimentos filtrando pelo GRUPO da URA (regra atual), pela
 * CAMPANHA do grupo da URA e sem filtro (geral). No fim, os nomes dos campos que a API
 * devolve e quantas linhas vieram em cada consulta. Só nomes de operadores e números:
 * nada de clientes nem CPF.
 */
export const diagnosticoLeads = async (dia: string, config: ConfigArgus): Promise<string> => {
  if (!config.token.trim()) throw new Error('Cole o token da API do Argus nas configurações.');

  const grupos = await buscarGrupos(config);
  const gruposUra = grupos.filter((g) => normalizarNome(g.grupoUsuarioDesc).includes(normalizarNome(GRUPO_URA)));
  if (gruposUra.length === 0) throw new Error(`Não encontrei o grupo operacional '${GRUPO_URA}' no Argus.`);
  const campanhas = [...new Set(gruposUra.map((g) => Number(g.idCampanha)).filter((id) => !Number.isNaN(id)))];

  const geral = await buscarDesempenho(dia, config);
  const porGrupo = await Promise.all(gruposUra.map((g) => buscarDesempenho(dia, config, Number(g.idGrupoUsuario))));
  const porCampanha = await Promise.all(campanhas.map((id) => buscarDesempenho(dia, config, undefined, id)));

  const todos = [...geral, ...porGrupo.flat(), ...porCampanha.flat()];
  const chaves = todos.length > 0 ? Object.keys(todos[0]) : [];
  const campoNome = acharCampo(chaves, 'operador');
  const campoQtde = acharCampo(chaves, 'leads');
  if (!campoNome || !campoQtde) throw new Error(`A API não trouxe nome e atendimentos. Campos: ${chaves.join(', ')}`);

  // Soma os atendimentos por operador em cada consulta
  const soma = (registros: Registro[]) => {
    const mapa = new Map<string, number>();
    registros.forEach((r) => {
      const nome = String(r[campoNome] ?? '').trim();
      mapa.set(nome, (mapa.get(nome) ?? 0) + numero(r[campoQtde]));
    });
    return mapa;
  };
  const [mGrupo, mCampanha, mGeral] = [soma(porGrupo.flat()), soma(porCampanha.flat()), soma(geral)];
  // Se cada linha do geral disser em que grupo foi o atendimento, soma só as linhas da URA
  const campoGrupo = chaves.find((k) => /grupo/i.test(k) && /desc|nome/i.test(k));
  const mLinhasUra = campoGrupo
    ? soma(geral.filter((r) => normalizarNome(r[campoGrupo]).includes(normalizarNome(GRUPO_URA))))
    : null;
  const nomes = [...new Set([...mGeral.keys(), ...mGrupo.keys(), ...mCampanha.keys()])].sort();
  const mapas = [mGrupo, mCampanha, mGeral, ...(mLinhasUra ? [mLinhasUra] : [])];

  const linhas = [
    `Diagnóstico dos leads da URA — ${isoParaBr(dia)}`,
    `Campo de atendimentos usado: ${campoQtde}`,
    `Grupo(s) da URA: ${gruposUra.map((g) => `${g.grupoUsuarioDesc} (grupo ${g.idGrupoUsuario}, campanha ${g.idCampanha} ${g.campanhaDesc ?? ''})`).join(' | ')}`,
    '',
    'Operador;Filtro por grupo URA (atual);Filtro por campanha;Sem filtro (geral)' +
      (mLinhasUra ? `;Geral só nas linhas do grupo URA (campo ${campoGrupo})` : ''),
    ...nomes.map((n) => [n, ...mapas.map((m) => m.get(n) ?? 0)].map(escaparCampo).join(';')),
    ['TOTAL', ...mapas.map((m) => [...m.values()].reduce((s, v) => s + v, 0))].join(';'),
    '',
    `Linhas devolvidas: grupo ${porGrupo.flat().length}; campanha ${porCampanha.flat().length}; geral ${geral.length}`,
    `Campos de cada linha do desempenho: ${chaves.join(', ')}`,
  ];
  return linhas.join('\r\n');
};
