import * as XLSX from 'xlsx';
import {
  EscalaAtribuicao,
  EscalaCadastro,
  EscalaRegistro,
  ImportacaoEscala,
  ResultadoSorteio,
} from '../types/escala';
import { FeriadoLocal, celulaParaIso, diaDaSemana, ehFimDeSemana, feriado, isoParaBr, brParaIso, normalizarNome } from './calendario';
import { escaparCsv } from './csvTexto';
import { bordaFina, novaPlanilha, pintar } from './planilhaColorida';
import type { Workbook } from 'exceljs';

/**
 * Escala diária de bases do Ativo 2, em RODÍZIO.
 *
 * Mesmas regras do escala_bases.py do BENZAITEN e da macro da Escala_Bases_Ativo2.xlsm:
 *  - a cada sorteio, cada pessoa anda UMA base para frente, na ordem do cadastro
 *    (NOTA 0 -> NOTA 1 -> ... -> volta para a primeira): ninguém repete uma base
 *    antes de passar por todas;
 *  - o ponto de partida é o último sorteio completo do histórico (todas as bases
 *    preenchidas, ninguém repetido); sem histórico, começa pela ordem do cadastro;
 *  - ausentes ficam fora; a base deles vai para quem está com menos bases (de preferência
 *    quem não teve essa base no sorteio anterior) e, quando voltam, retomam sua posição;
 *  - com menos pessoas que bases, algumas ficam com uma base a mais (nunca duas a mais);
 *  - com mais pessoas que bases, quem fica sem base também entra no rodízio;
 *  - pessoa nova no cadastro entra no fim da roda.
 */

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

/** Resto da divisão sempre positivo (o % do JavaScript devolve negativo para números negativos) */
const modulo = (a: number, b: number): number => ((a % b) + b) % b;

/**
 * Ordem do rodízio (roda) e quantos passos andar até a data.
 *
 * Procura, do mais recente para o mais antigo, o último sorteio ANTES da data que esteja
 * completo: todas as bases preenchidas e ninguém repetido (quando há pessoas suficientes).
 * Dias com ausência não servem de partida, porque alguém cobriu outra base.
 * Sem sorteio de partida: roda = ordem do cadastro e passos = 0.
 */
export const pontoDePartida = (
  historico: EscalaRegistro[],
  bases: string[],
  pessoas: string[],
  data: string
): { roda: string[]; passos: number } => {
  const oficiais = new Map(pessoas.map((p) => [normalizarNome(p), p]));
  const datas = [...new Set(historico.filter((r) => r.data < data).map((r) => r.data))].sort().reverse();

  for (let i = 0; i < datas.length; i++) {
    const doDia = new Map(
      historico
        .filter((r) => r.data === datas[i])
        .map((r) => [normalizarNome(r.base), normalizarNome(r.responsavel)] as [string, string])
    );
    const nomes = bases.map((b) => doDia.get(normalizarNome(b)) ?? '');
    const completo = nomes.every(Boolean) && (new Set(nomes).size === nomes.length || pessoas.length < bases.length);
    if (!completo) continue;

    // Quem saiu do cadastro sai da roda; quem entrou vai para o fim dela
    const roda = [...new Set(nomes.filter((n) => oficiais.has(n)).map((n) => oficiais.get(n)!))];
    roda.push(...pessoas.filter((p) => !roda.includes(p)));
    return { roda, passos: i + 1 };
  }
  return { roda: [...pessoas], passos: 0 };
};

/**
 * Monta a escala do dia em rodízio. O histórico informado não deve conter a própria data.
 */
export const rodizio = (
  bases: string[],
  pessoas: string[],
  historico: EscalaRegistro[],
  data: string,
  ausentes: string[] = []
): { atribuicoes: EscalaAtribuicao[]; avisos: string[] } => {
  if (bases.length === 0) throw new Error('Nenhuma base cadastrada.');
  const fora = new Set(ausentes.map(normalizarNome));
  const presentes = pessoas.filter((p) => !fora.has(normalizarNome(p)));
  if (presentes.length === 0) throw new Error('Nenhuma pessoa disponível para o sorteio.');

  const { roda, passos } = pontoDePartida(historico, bases, pessoas, data);
  const m = roda.length;
  // Cada passo leva cada pessoa para a base seguinte
  const plano = bases.map((_, j) => roda[modulo(j - passos, m)]);

  // Sorteio anterior, para evitar dar ao substituto a base que ele acabou de ter
  const anteriores = [...new Set(historico.filter((r) => r.data < data).map((r) => r.data))].sort();
  const ultimo = anteriores[anteriores.length - 1];
  const ontem = new Map(
    historico
      .filter((r) => r.data === ultimo)
      .map((r) => [normalizarNome(r.base), normalizarNome(r.responsavel)] as [string, string])
  );

  const escolha: (string | null)[] = plano.map((p) => (presentes.includes(p) ? p : null));
  const contagem = new Map(presentes.map((p) => [p, escolha.filter((e) => e === p).length]));
  const avisos: string[] = [];

  // Base de quem faltou: para quem está com menos bases; de preferência quem não teve
  // essa base no sorteio anterior; depois, quem vem logo atrás no rodízio
  bases.forEach((base, j) => {
    if (escolha[j]) return;
    const posicao = roda.indexOf(plano[j]);
    const nota = (p: string) => [
      contagem.get(p)!,
      ontem.get(normalizarNome(base)) === normalizarNome(p) ? 1 : 0,
      modulo(roda.indexOf(p) - posicao, m),
    ];
    const substituto = [...presentes].sort((a, b) => {
      const [na, nb] = [nota(a), nota(b)];
      return na[0] - nb[0] || na[1] - nb[1] || na[2] - nb[2];
    })[0];
    escolha[j] = substituto;
    contagem.set(substituto, contagem.get(substituto)! + 1);
    avisos.push(`${plano[j]} está ausente: ${base} ficou com ${substituto}.`);
  });

  const atribuicoes = bases.map((base, j) => ({ base, responsavel: escolha[j]! }));
  const repetidos = atribuicoes
    .filter((a) => ontem.get(normalizarNome(a.base)) === normalizarNome(a.responsavel))
    .map((a) => `${a.responsavel} (${a.base})`);
  if (repetidos.length > 0) {
    avisos.push(`Por causa das ausências, repetiu a base do sorteio anterior: ${repetidos.join(', ')}.`);
  }
  return { atribuicoes, avisos };
};

/**
 * Escala completa do dia: rodízio, ausentes e avisos.
 * O histórico pode conter a própria data (ela é ignorada: sortear de novo dá o mesmo resultado).
 */
export const realizarSorteio = (
  cadastro: EscalaCadastro,
  historico: EscalaRegistro[],
  data: string,
  ausentes: string[],
  feriadosLocais: FeriadoLocal[] = []
): ResultadoSorteio => {
  const fora = new Set(ausentes.map(normalizarNome));
  const disponiveis = cadastro.pessoas.filter((p) => !fora.has(normalizarNome(p)));
  const ausentesCadastrados = cadastro.pessoas.filter((p) => fora.has(normalizarNome(p)));
  const historicoSemData = historico.filter((r) => r.data !== data);

  const avisos: string[] = [];
  const nomeDoFeriado = feriado(data, feriadosLocais);
  if (ehFimDeSemana(data)) avisos.push('A data escolhida cai no fim de semana.');
  if (nomeDoFeriado) avisos.push(`A data escolhida é feriado (${nomeDoFeriado}).`);
  if (disponiveis.length < cadastro.bases.length) {
    avisos.push(
      `${disponiveis.length} pessoa(s) para ${cadastro.bases.length} base(s): alguém fica com mais de uma base.`
    );
  }

  const { atribuicoes, avisos: avisosRodizio } = rodizio(
    cadastro.bases,
    cadastro.pessoas,
    historicoSemData,
    data,
    ausentesCadastrados
  );
  avisos.push(...avisosRodizio);

  const comBase = new Set(atribuicoes.map((a) => a.responsavel));
  const semBase = disponiveis.filter((p) => !comBase.has(p));
  if (semBase.length > 0) {
    avisos.push(`Mais pessoas que bases; sem base hoje: ${semBase.join(', ')} (é a vez dele(s) no rodízio).`);
  }

  return { data, atribuicoes, ausentes: ausentesCadastrados, semBase, avisos };
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

/** Cores da empresa (as mesmas da planilha Escala_Bases_Ativo2.xlsm) */
const CORES_ESCALA = { azul: '#0A2F6B', amarelo: '#FFC20E', amareloClaro: '#FFF4CC', branco: '#FFFFFF' };

/**
 * Planilha da escala do dia (aba Escala) com os últimos 10 sorteios (aba Últimos sorteios),
 * no mesmo layout e nas mesmas cores do saida/escala_AAAA-MM-DD.xlsx do BENZAITEN.
 */
export const gerarPlanilhaEscala = async (
  resultado: ResultadoSorteio,
  historico: EscalaRegistro[],
  bases: string[]
): Promise<Workbook> => {
  const { azul, amarelo, amareloClaro, branco } = CORES_ESCALA;
  const livro = await novaPlanilha();

  // --- Aba 1: escala do dia ---
  const ws = livro.addWorksheet('Escala');
  ws.mergeCells('A1:B1');
  ws.getCell('A1').value = 'ESCALA DE BASES — ATIVO 2';
  pintar(ws.getCell('A1'), azul, branco, true, 14);
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.mergeCells('A2:B2');
  ws.getCell('A2').value = `${isoParaBr(resultado.data)} (${diaDaSemana(resultado.data)})`;
  pintar(ws.getCell('A2'), null, azul, true);
  ws.getCell('A2').alignment = { horizontal: 'center' };

  const cabecalho = ws.getRow(4);
  cabecalho.values = ['Base', 'Responsável'];
  [1, 2].forEach((c) => {
    pintar(cabecalho.getCell(c), amarelo, azul, true);
    bordaFina(cabecalho.getCell(c), azul);
  });
  resultado.atribuicoes.forEach((a, i) => {
    const linha = ws.getRow(5 + i);
    linha.values = [a.base, a.responsavel];
    [1, 2].forEach((c) => bordaFina(linha.getCell(c), azul));
  });
  const depois = 5 + resultado.atribuicoes.length + 1;
  ws.getCell(depois, 1).value = `Ausentes: ${resultado.ausentes.length > 0 ? resultado.ausentes.join(', ') : 'nenhum'}`;
  ws.getCell(depois + 1, 1).value = 'Regra: rodízio — cada pessoa anda uma base para frente a cada sorteio.';
  ws.getColumn(1).width = 38;
  ws.getColumn(2).width = 22;

  // --- Aba 2: últimos 10 sorteios, uma coluna por base (como na .xlsm) ---
  const wh = livro.addWorksheet('Últimos sorteios');
  const topo = wh.addRow(['Data', ...bases]);
  topo.eachCell((celula) => pintar(celula, azul, branco, true));
  ultimosSorteios(historico, bases).forEach((linha) => {
    const row = wh.addRow([isoParaBr(linha.data), ...linha.responsaveis]);
    if (linha.data === resultado.data) {
      for (let c = 1; c <= bases.length + 1; c++) pintar(row.getCell(c), amareloClaro);
    }
  });
  wh.getColumn(1).width = 12;
  bases.forEach((_, i) => (wh.getColumn(i + 2).width = 32));

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
