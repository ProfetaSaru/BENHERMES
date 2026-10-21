import * as XLSX from 'xlsx';
import {
  EscalaAtribuicao,
  EscalaCadastro,
  EscalaRegistro,
  ImportacaoEscala,
  ResultadoSorteio,
} from '../types/escala';
import { celulaParaIso, diaDaSemana, ehFimDeSemana, feriadoNacional, isoParaBr, brParaIso, normalizarNome } from './calendario';
import { escaparCsv } from './csvTexto';

/**
 * Escala diária de bases do Ativo 2.
 *
 * Mesmas regras do escala_bases.py do BENZAITEN (e da antiga planilha Escala_Bases_Ativo2.xlsm):
 *  - cada base recebe um responsável;
 *  - com menos pessoas que bases, algumas pessoas ficam com uma base a mais (nunca duas a mais);
 *  - com mais pessoas que bases, algumas ficam sem base (aviso);
 *  - ninguém repete a mesma base dos últimos JANELA_SORTEIOS sorteios; se não houver
 *    combinação possível, a janela diminui e um aviso aparece;
 *  - ausentes ficam fora do sorteio.
 */

/** Quantos sorteios anteriores são olhados para evitar repetir a mesma base */
export const JANELA_SORTEIOS = 2;

/** Quantas vezes embaralhar antes de desistir de uma janela (igual à macro) */
const TENTATIVAS = 1000;

/** Cabeçalho do histórico em CSV, igual ao historico/historico_escalas.csv do BENZAITEN */
const CABECALHO_HISTORICO = 'Data;Base;Responsavel';

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

/**
 * Tira espaços extras, itens vazios e nomes repetidos, mantendo a ordem.
 */
export const limparLista = (valores: unknown[]): string[] => {
  const vistos = new Set<string>();
  const resultado: string[] = [];

  for (const valor of valores) {
    const texto = String(valor ?? '').replace(/\s+/g, ' ').trim();
    const chave = normalizarNome(texto);
    if (!texto || vistos.has(chave)) continue;
    vistos.add(chave);
    resultado.push(texto);
  }

  return resultado;
};

/** Texto de um campo "um item por linha" -> lista limpa */
export const textoParaLista = (texto: string): string[] => limparLista(texto.split(/\r?\n/));

// ---------------------------------------------------------------------------
// Sorteio
// ---------------------------------------------------------------------------

/** Embaralhamento de Fisher-Yates. `aleatorio` permite repetir o resultado nos testes. */
const embaralhar = <T,>(lista: T[], aleatorio: () => number): T[] => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

/**
 * Os últimos `quantidade` sorteios ANTES da data, como mapas {base: pessoa} normalizados.
 * Conta sorteios registrados (não dias do calendário): o fim de semana não "apaga" a sexta.
 */
export const sorteiosAnteriores = (
  historico: EscalaRegistro[],
  data: string,
  quantidade: number
): Map<string, string>[] => {
  const datas = [...new Set(historico.filter((r) => r.data < data).map((r) => r.data))]
    .sort()
    .reverse()
    .slice(0, quantidade);

  return datas.map(
    (d) =>
      new Map(
        historico
          .filter((r) => r.data === d)
          .map((r) => [normalizarNome(r.base), normalizarNome(r.responsavel)] as [string, string])
      )
  );
};

const repeteBase = (atribuicoes: EscalaAtribuicao[], anteriores: Map<string, string>[]): boolean => {
  return atribuicoes.some(({ base, responsavel }) =>
    anteriores.some((sorteio) => sorteio.get(normalizarNome(base)) === normalizarNome(responsavel))
  );
};

/**
 * Faz o sorteio e devolve as atribuições (na ordem das bases) e a janela respeitada.
 */
export const sortear = (
  bases: string[],
  pessoas: string[],
  historico: EscalaRegistro[],
  data: string,
  janela = JANELA_SORTEIOS,
  aleatorio: () => number = Math.random
): { atribuicoes: EscalaAtribuicao[]; janelaUsada: number } => {
  if (bases.length === 0) throw new Error('Nenhuma base cadastrada.');
  if (pessoas.length === 0) throw new Error('Nenhuma pessoa disponível para o sorteio.');

  // Tenta com a janela completa; se não der, diminui até 0 (sem restrição)
  for (let janelaAtual = janela; janelaAtual >= 0; janelaAtual--) {
    const anteriores = sorteiosAnteriores(historico, data, janelaAtual);

    for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
      const embaralhadas = embaralhar(pessoas, aleatorio);
      // Uma vaga por base. Se faltar gente, volta para o começo da lista,
      // então ninguém fica com mais de 1 base a mais que outra pessoa.
      const fila = bases.map((_, i) => embaralhadas[i % embaralhadas.length]);
      // Embaralha de novo para quem tem 2 bases não pegar sempre as mesmas posições
      const ordem = embaralhar(fila, aleatorio);
      const atribuicoes = bases.map((base, i) => ({ base, responsavel: ordem[i] }));

      if (!repeteBase(atribuicoes, anteriores)) {
        return { atribuicoes, janelaUsada: janelaAtual };
      }
    }
  }

  // Só chega aqui se nem sem restrição funcionar, o que não deve acontecer
  throw new Error('Não foi possível fazer o sorteio.');
};

/**
 * Sorteio completo do dia: tira os ausentes, sorteia e monta os avisos.
 * O histórico informado não deve conter a própria data (quem chama decide se substitui).
 */
export const realizarSorteio = (
  cadastro: EscalaCadastro,
  historico: EscalaRegistro[],
  data: string,
  ausentes: string[],
  aleatorio: () => number = Math.random
): ResultadoSorteio => {
  const fora = new Set(ausentes.map(normalizarNome));
  const disponiveis = cadastro.pessoas.filter((p) => !fora.has(normalizarNome(p)));
  const ausentesCadastrados = cadastro.pessoas.filter((p) => fora.has(normalizarNome(p)));
  const historicoSemData = historico.filter((r) => r.data !== data);

  const { atribuicoes, janelaUsada } = sortear(
    cadastro.bases,
    disponiveis,
    historicoSemData,
    data,
    JANELA_SORTEIOS,
    aleatorio
  );

  const avisos: string[] = [];
  const feriado = feriadoNacional(data);
  if (ehFimDeSemana(data)) avisos.push('A data escolhida cai no fim de semana.');
  if (feriado) avisos.push(`A data escolhida é feriado (${feriado}).`);
  if (disponiveis.length < cadastro.bases.length) {
    avisos.push(
      `${disponiveis.length} pessoa(s) para ${cadastro.bases.length} base(s): alguém fica com mais de uma base.`
    );
  }
  if (janelaUsada === 0) {
    avisos.push('Não havia como evitar que alguém repetisse a base do sorteio anterior.');
  } else if (janelaUsada < JANELA_SORTEIOS) {
    avisos.push(
      `Não havia combinação sem repetir base nos últimos ${JANELA_SORTEIOS} sorteios; só o último foi respeitado.`
    );
  }

  const comBase = new Set(atribuicoes.map((a) => a.responsavel));
  const semBase = disponiveis.filter((p) => !comBase.has(p));
  if (semBase.length > 0) {
    avisos.push(`Mais pessoas que bases; sem base hoje: ${semBase.join(', ')}.`);
  }

  return { data, atribuicoes, ausentes: ausentesCadastrados, semBase, janelaUsada, avisos };
};

/** Histórico com o sorteio do dia (substitui o que já existia na mesma data), ordenado por data */
export const registrarSorteio = (
  historico: EscalaRegistro[],
  resultado: ResultadoSorteio
): EscalaRegistro[] => {
  const novos = resultado.atribuicoes.map((a) => ({ data: resultado.data, ...a }));
  return ordenarHistorico([...historico.filter((r) => r.data !== resultado.data), ...novos]);
};

/** Ordena por data mantendo a ordem das bases dentro do mesmo dia */
export const ordenarHistorico = (historico: EscalaRegistro[]): EscalaRegistro[] => {
  return historico
    .map((registro, indice) => ({ registro, indice }))
    .sort((a, b) => a.registro.data.localeCompare(b.registro.data) || a.indice - b.indice)
    .map(({ registro }) => registro);
};

/**
 * Últimos sorteios em formato de tabela: uma linha por data (mais recente primeiro)
 * e uma coluna por base, como na aba Escala da planilha antiga.
 */
export const ultimosSorteios = (
  historico: EscalaRegistro[],
  bases: string[],
  quantidade = 10
): { data: string; responsaveis: string[] }[] => {
  const datas = [...new Set(historico.map((r) => r.data))].sort().reverse().slice(0, quantidade);

  return datas.map((data) => {
    const doDia = new Map(
      historico.filter((r) => r.data === data).map((r) => [normalizarNome(r.base), r.responsavel] as [string, string])
    );
    return { data, responsaveis: bases.map((b) => doDia.get(normalizarNome(b)) ?? '') };
  });
};

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

/** Texto pronto para colar no chat ou no e-mail */
export const textoDaEscala = (resultado: ResultadoSorteio): string => {
  const linhas = [
    `ESCALA DE BASES — ATIVO 2`,
    `${isoParaBr(resultado.data)} (${diaDaSemana(resultado.data)})`,
    '',
    ...resultado.atribuicoes.map((a) => `• ${a.base}: ${a.responsavel}`),
  ];
  if (resultado.ausentes.length > 0) {
    linhas.push('', `Ausentes: ${resultado.ausentes.join(', ')}`);
  }
  return linhas.join('\n');
};

/** Histórico em CSV (Data;Base;Responsavel, datas dd/mm/aaaa), compatível com o BENZAITEN */
export const historicoParaCsv = (historico: EscalaRegistro[]): string => {
  const linhas = ordenarHistorico(historico).map((r) =>
    [isoParaBr(r.data), r.base, r.responsavel].map(escaparCsv).join(';')
  );
  return [CABECALHO_HISTORICO, ...linhas].join('\r\n');
};

/**
 * Planilha da escala do dia (aba Escala) com os últimos 10 sorteios (aba Últimos sorteios),
 * no mesmo layout do saida/escala_AAAA-MM-DD.xlsx do BENZAITEN.
 */
export const gerarPlanilhaEscala = (
  resultado: ResultadoSorteio,
  historico: EscalaRegistro[],
  bases: string[]
): XLSX.WorkBook => {
  const escala = XLSX.utils.aoa_to_sheet([
    ['ESCALA DE BASES — ATIVO 2'],
    [`${isoParaBr(resultado.data)} (${diaDaSemana(resultado.data)})`],
    [],
    ['Base', 'Responsável'],
    ...resultado.atribuicoes.map((a) => [a.base, a.responsavel]),
    [],
    [`Ausentes: ${resultado.ausentes.length > 0 ? resultado.ausentes.join(', ') : 'nenhum'}`],
    [`Regra: ninguém repetiu a base dos últimos ${resultado.janelaUsada} sorteio(s).`],
  ]);
  escala['!cols'] = [{ wch: 38 }, { wch: 22 }];
  escala['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];

  const ultimos = XLSX.utils.aoa_to_sheet([
    ['Data', ...bases],
    ...ultimosSorteios(historico, bases).map((linha) => [isoParaBr(linha.data), ...linha.responsaveis]),
  ]);
  ultimos['!cols'] = [{ wch: 12 }, ...bases.map(() => ({ wch: 32 }))];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, escala, 'Escala');
  XLSX.utils.book_append_sheet(livro, ultimos, 'Últimos sorteios');
  return livro;
};

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

const linhasDaAba = (planilha: XLSX.WorkSheet): unknown[][] =>
  XLSX.utils.sheet_to_json<unknown[]>(planilha, { header: 1, defval: '', raw: true, blankrows: true });

const acharAba = (livro: XLSX.WorkBook, nome: string): XLSX.WorkSheet | null => {
  const encontrada = livro.SheetNames.find((n) => normalizarNome(n) === normalizarNome(nome));
  return encontrada ? livro.Sheets[encontrada] : null;
};

/**
 * Coluna com o cabeçalho indicado (ex.: "Base") de uma aba no formato do config/bases.xlsx.
 */
const colunaPorCabecalho = (planilha: XLSX.WorkSheet, cabecalho: string): string[] => {
  const linhas = linhasDaAba(planilha);
  const indice = (linhas[0] ?? []).findIndex((c) => normalizarNome(c) === normalizarNome(cabecalho));
  if (indice < 0) return [];
  return limparLista(linhas.slice(1).map((l) => l[indice]));
};

/**
 * Lê as planilhas que a escala já usou:
 *  - Escala_Bases_Ativo2.xlsm (abas Cadastro e Escala): cadastro + histórico;
 *  - config/bases.xlsx do BENZAITEN (abas Bases e Pessoas): cadastro.
 * As macros nunca são executadas; só os valores são lidos.
 */
export const importarPlanilhaEscala = (livro: XLSX.WorkBook): ImportacaoEscala => {
  const abaCadastro = acharAba(livro, 'Cadastro');
  const abaEscala = acharAba(livro, 'Escala');
  const abaBases = acharAba(livro, 'Bases');
  const abaPessoas = acharAba(livro, 'Pessoas');

  if (abaBases && abaPessoas) {
    const cadastro = {
      bases: colunaPorCabecalho(abaBases, 'Base'),
      pessoas: colunaPorCabecalho(abaPessoas, 'Pessoa'),
    };
    return { cadastro, registros: [] };
  }

  if (!abaCadastro && !abaEscala) {
    throw new Error(
      'Planilha não reconhecida. Use a Escala_Bases_Ativo2.xlsm (abas Cadastro e Escala), o bases.xlsx do BENZAITEN (abas Bases e Pessoas) ou o historico_escalas.csv.'
    );
  }

  // Aba Cadastro: bases na coluna A e pessoas na coluna C, a partir da linha 5
  let cadastro: EscalaCadastro | null = null;
  if (abaCadastro) {
    const linhas = linhasDaAba(abaCadastro).slice(4);
    cadastro = {
      bases: limparLista(linhas.map((l) => l[0])),
      pessoas: limparLista(linhas.map((l) => l[2])),
    };
  }

  // Aba Escala: linha de cabeçalho "Data | base 1 | base 2 ..." e um dia por linha
  const registros: EscalaRegistro[] = [];
  if (abaEscala) {
    const linhas = linhasDaAba(abaEscala);
    const inicio = linhas.findIndex((l) => normalizarNome(l[0]) === 'DATA');
    const cabecalho = inicio >= 0 ? linhas[inicio] : [];

    for (const linha of inicio >= 0 ? linhas.slice(inicio + 1) : []) {
      const data = celulaParaIso(linha[0]);
      if (!data) continue;
      cabecalho.slice(1).forEach((base, i) => {
        const responsavel = String(linha[i + 1] ?? '').trim();
        const nomeBase = String(base ?? '').trim();
        if (nomeBase && responsavel) registros.push({ data, base: nomeBase, responsavel });
      });
    }
  }

  return { cadastro, registros };
};

/**
 * Lê o historico_escalas.csv do BENZAITEN (ou um histórico exportado por aqui).
 */
export const csvParaHistorico = (texto: string): EscalaRegistro[] => {
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  const cabecalho = (linhas[0] ?? '').split(';').map(normalizarNome);
  if (cabecalho[0] !== 'DATA' || cabecalho[1] !== 'BASE' || cabecalho[2] !== 'RESPONSAVEL') {
    throw new Error('CSV não reconhecido. O histórico precisa ter as colunas Data;Base;Responsavel.');
  }

  const registros: EscalaRegistro[] = [];
  for (const linha of linhas.slice(1)) {
    const [dataBr, base, responsavel] = linha.split(';').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    const data = brParaIso(dataBr ?? '');
    if (data && base && responsavel) registros.push({ data, base, responsavel });
  }
  return registros;
};

/**
 * Junta registros importados ao histórico. Datas que já existem no histórico
 * são mantidas como estão (o que foi sorteado aqui não é sobrescrito).
 */
export const mesclarHistorico = (
  historico: EscalaRegistro[],
  importados: EscalaRegistro[]
): { historico: EscalaRegistro[]; diasNovos: number } => {
  const existentes = new Set(historico.map((r) => r.data));
  const novos = importados.filter((r) => !existentes.has(r.data));
  return {
    historico: ordenarHistorico([...historico, ...novos]),
    diasNovos: new Set(novos.map((r) => r.data)).size,
  };
};
