import * as XLSX from 'xlsx';
import {
  Apelido,
  ChaveIndicador,
  LinhaExportacao,
  Meta,
  Metas,
  OperadorCadastro,
  RegistroHistoricoUra,
  TipoConfiguracao,
  TipoExportacao,
  TipoLinha,
} from '../types/relatorioUra';
import { brParaIso, celulaParaIso, montarIso, normalizarNome } from './calendario';

/**
 * Leitura das exportações do Argus e do Vanguard, no navegador.
 * Mesmas regras do leitura.py e do relatorio_ura.py do BENZAITEN:
 * os arquivos são reconhecidos pelas COLUNAS, então o nome do arquivo pode ser qualquer um.
 */

/** Colunas que identificam cada exportação (nomes padronizados, sem acento) */
export const TIPOS_DE_ARQUIVO: Record<TipoExportacao, string[]> = {
  esteira: ['CPF', 'ETAPA', 'AGENTE', 'DATA/HORA'],
  operadores: ['NOME', 'SUPERVISOR(ES)', 'STATUS'],
  tarifacao: ['DESCRICAO', 'VALOR R$', 'MINUTOS'],
  desempenho: ['DATA', 'OPERADOR', 'TME', 'TMA'],
  leads: ['DATA', 'OPERADOR', 'LEADS. ATEND.'],
};

export const NOMES_DOS_TIPOS: Record<TipoExportacao, string> = {
  esteira: 'Esteira Vanguard',
  operadores: 'Operadores Argus',
  tarifacao: 'Tarifação Argus',
  desempenho: 'Desempenho Argus (TMA/TME)',
  leads: 'Leads URA Argus',
};

/** Nome do indicador na planilha de metas -> chave da coluna no relatório */
export const INDICADORES: { titulo: string; chave: ChaveIndicador; sentido: Meta['sentido'] }[] = [
  { titulo: 'TMA', chave: 'tma', sentido: 'menor' },
  { titulo: 'TMO', chave: 'tmo', sentido: 'menor' },
  { titulo: 'LEADS ATENDIDOS/URA', chave: 'leads', sentido: 'maior' },
  { titulo: 'CUSTO TOTAL', chave: 'custo', sentido: 'menor' },
  { titulo: 'VENDAS GERAL', chave: 'vendas', sentido: 'maior' },
  { titulo: 'CLIENTE EFETIVADOS', chave: 'clientes', sentido: 'maior' },
  { titulo: 'CUSTO POR CPF', chave: 'custo_cpf', sentido: 'menor' },
  { titulo: 'PRODUÇÃO/LEAD', chave: 'prod_lead', sentido: 'maior' },
];

// ---------------------------------------------------------------------------
// Conversões (formato brasileiro)
// ---------------------------------------------------------------------------

/**
 * Padroniza o nome de uma coluna. O Argus às vezes coloca símbolos antes do nome.
 * Exemplo: "? Nome" -> "NOME"; "Valor R$" -> "VALOR R$"
 */
export const limparCabecalho = (coluna: unknown): string => {
  let texto = normalizarNome(coluna);
  while (texto && !/[A-Z0-9]/.test(texto[0]) && !'<['.includes(texto[0])) {
    texto = texto.slice(1).trim();
  }
  return texto;
};

/**
 * "R$ 1.234,56" -> 1234.56 | "10,50" -> 10.5 | "1.500" -> 1500 | "" -> 0
 * Números vindos do Excel passam direto.
 */
export const converterValorBr = (valor: unknown): number => {
  if (typeof valor === 'number') return valor;
  let limpo = String(valor ?? '')
    .replace('R$', '')
    .replace(/[\s ]/g, '')
    .trim();
  if (!limpo || limpo === '-') return 0;

  const negativo = limpo.startsWith('-');
  limpo = limpo.replace(/^-+/, '');
  if (limpo.includes(',')) {
    // Vírgula é o separador decimal; pontos são de milhar
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if ((limpo.match(/\./g) ?? []).length > 1 || /^\d{1,3}\.\d{3}$/.test(limpo)) {
    // Só pontos: "1.234.567" ou "1.500" são milhares
    limpo = limpo.replace(/\./g, '');
  }
  const numero = Number(limpo);
  if (Number.isNaN(numero)) return 0;
  return negativo ? -numero : numero;
};

/**
 * "00:01:04" -> 64 | "01:02:05" -> 3725 | "" -> 0.
 * No Excel, horas são frações do dia (0.000740... = 00:01:04).
 */
export const tempoParaSegundos = (valor: unknown): number => {
  if (typeof valor === 'number') return Math.round(valor < 1 ? valor * 86400 : valor);
  let texto = String(valor ?? '').trim();
  if (!texto) return 0;
  if (texto.includes(' ')) texto = texto.split(/\s+/).pop() ?? '';
  const segundos = texto.split(':').reduce((total, parte) => total * 60 + (Number(parte) || 0), 0);
  return Math.round(segundos);
};

/**
 * Data de uma célula: "19/10/2026", "19/10/2026 14:35:00", "2026-10-19..." ou número do Excel.
 */
export const converterData = (valor: unknown): string | null => {
  if (typeof valor === 'number') return celulaParaIso(valor);
  const texto = String(valor ?? '').trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto);
  if (br) return brParaIso(`${br[1]}/${br[2]}/${br[3]}`);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (iso) return montarIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return null;
};

// ---------------------------------------------------------------------------
// Leitura dos arquivos
// ---------------------------------------------------------------------------

/** Vanguard exporta em UTF-8; o Argus em Windows-1252 (o padrão antigo do Excel) */
const decodificar = (bytes: ArrayBuffer): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
};

/** CSV com separador ; e aspas (RFC 4180). Todos os valores ficam como texto. */
export const lerCsv = (texto: string, separador = ';'): string[][] => {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = '';
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"' && texto[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (c === '"') {
        entreAspas = false;
      } else {
        celula += c;
      }
      continue;
    }
    if (c === '"') {
      entreAspas = true;
    } else if (c === separador) {
      linha.push(celula);
      celula = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = '';
    } else {
      celula += c;
    }
  }
  if (celula || linha.length > 0) {
    linha.push(celula);
    linhas.push(linha);
  }
  return linhas;
};

const temConteudo = (linha: unknown[]): boolean => linha.some((c) => String(c ?? '').trim() !== '');

export interface TabelaLida {
  cabecalho: unknown[];
  linhas: unknown[][];
  livro: XLSX.WorkBook | null;
}

/**
 * Lê um .csv, .xlsx ou .xls. A primeira linha preenchida é o cabeçalho.
 * Nas planilhas Excel, os valores vêm "crus" (números são números), para não
 * depender da formatação do computador.
 */
export const lerArquivo = async (arquivo: File): Promise<TabelaLida> => {
  const bytes = await arquivo.arrayBuffer();

  if (arquivo.name.toLowerCase().endsWith('.csv')) {
    const linhas = lerCsv(decodificar(bytes)).filter(temConteudo);
    return { cabecalho: linhas[0] ?? [], linhas: linhas.slice(1), livro: null };
  }

  const livro = XLSX.read(bytes, { type: 'array' });
  const primeira = livro.Sheets[livro.SheetNames[0]];
  const linhas = XLSX.utils
    .sheet_to_json<unknown[]>(primeira, { header: 1, defval: '', raw: true, blankrows: false })
    .filter(temConteudo);
  return { cabecalho: linhas[0] ?? [], linhas: linhas.slice(1), livro };
};

/** Descobre que exportação é pelo conjunto de colunas */
export const tipoDoArquivo = (cabecalho: unknown[]): TipoExportacao | null => {
  const colunas = new Set(cabecalho.map(limparCabecalho));
  const tipos = Object.keys(TIPOS_DE_ARQUIVO) as TipoExportacao[];
  return tipos.find((tipo) => TIPOS_DE_ARQUIVO[tipo].every((c) => colunas.has(c))) ?? null;
};

/** Reconhece os arquivos de configuração do BENZAITEN (config/ e historico/) */
export const tipoDeConfiguracao = (tabela: TabelaLida): TipoConfiguracao | null => {
  const colunas = tabela.cabecalho.map(limparCabecalho);
  if (['DATA', 'TIPO', 'NOME', 'TMA (S)', 'TMO (S)'].every((c) => colunas.includes(c))) return 'historico_benzaiten';
  const abas = (tabela.livro?.SheetNames ?? []).map(normalizarNome);
  if (abas.includes('OPERADORES') && abas.includes('APELIDOS')) return 'cadastro_benzaiten';
  if (abas[0] === 'METAS' && colunas.includes('INDICADOR')) return 'metas_benzaiten';
  return null;
};

/** Linhas como {COLUNA PADRONIZADA: valor} */
export const comoDicionarios = (cabecalho: unknown[], linhas: unknown[][]): LinhaExportacao[] => {
  const colunas = cabecalho.map(limparCabecalho);
  return linhas.map((linha) => Object.fromEntries(colunas.map((c, i) => [c, linha[i] ?? ''])));
};

// ---------------------------------------------------------------------------
// Cadastro de operadores
// ---------------------------------------------------------------------------

/** "(1) FULANO DE TAL, (2) OUTRO" -> "FULANO DE TAL" */
export const limparSupervisor = (texto: unknown): string => {
  let primeiro = String(texto ?? '').split(',')[0].trim();
  if (primeiro.startsWith('(') && primeiro.includes(')')) {
    primeiro = primeiro.slice(primeiro.indexOf(')') + 1).trim();
  }
  return primeiro;
};

/** A equipe é o primeiro nome do supervisor: "FULANO DE TAL" -> "Fulano" */
export const nomeDaEquipe = (supervisor: unknown): string => {
  const primeiro = limparSupervisor(supervisor).split(/\s+/)[0] ?? '';
  return primeiro ? primeiro[0].toUpperCase() + primeiro.slice(1).toLowerCase() : '';
};

/**
 * Cadastro a partir da exportação de operadores do Argus.
 * Só nome, supervisor, equipe e status são guardados (CPF e e-mail ficam de fora).
 */
export const cadastroDaExportacao = (linhas: LinhaExportacao[]): OperadorCadastro[] => {
  return linhas
    .map((linha) => {
      const supervisor = limparSupervisor(linha['SUPERVISOR(ES)']);
      return {
        nome: String(linha['NOME'] ?? '').replace(/\s+/g, ' ').trim(),
        supervisor,
        equipe: nomeDaEquipe(supervisor),
        status: normalizarNome(linha['STATUS']) || 'ATIVO',
      };
    })
    .filter((op) => op.nome);
};

const linhasDaAba = (livro: XLSX.WorkBook, nome: string): unknown[][] => {
  const aba = livro.SheetNames.find((n) => normalizarNome(n) === normalizarNome(nome));
  if (!aba) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(livro.Sheets[aba], { header: 1, defval: '', raw: true, blankrows: false });
};

/** config/operadores.xlsx do BENZAITEN: abas Operadores (Nome, Supervisor, Equipe, Status) e Apelidos */
export const importarCadastroBenzaiten = (
  livro: XLSX.WorkBook
): { operadores: OperadorCadastro[]; apelidos: Apelido[] } => {
  const operadores = linhasDaAba(livro, 'Operadores')
    .slice(1)
    .map(([nome, supervisor, equipe, status]) => ({
      nome: String(nome ?? '').trim(),
      supervisor: String(supervisor ?? '').trim(),
      equipe: String(equipe ?? '').trim(),
      status: normalizarNome(status) || 'ATIVO',
    }))
    .filter((op) => op.nome);

  const apelidos = linhasDaAba(livro, 'Apelidos')
    .slice(1)
    .map(([noSistema, oficial]) => ({ noSistema: String(noSistema ?? '').trim(), oficial: String(oficial ?? '').trim() }))
    .filter((a) => a.noSistema && a.oficial && !a.noSistema.startsWith('(exemplo)'));

  return { operadores, apelidos };
};

/** Limite de meta vindo do Excel: hora vira "hh:mm:ss"; o resto vira texto */
const textoDaMeta = (valor: unknown, chave: ChaveIndicador): string => {
  if (valor === '' || valor === null || valor === undefined) return '';
  if (typeof valor === 'number' && (chave === 'tma' || chave === 'tmo') && valor < 1) {
    const total = Math.round(valor * 86400);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
  }
  return String(valor).replace('.', ',');
};

/** config/metas.xlsx do BENZAITEN: Indicador | Melhor quando | Verde | Vermelho */
export const importarMetasBenzaiten = (livro: XLSX.WorkBook): Metas => {
  const metas: Metas = {};
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(livro.Sheets[livro.SheetNames[0]], {
    header: 1,
    defval: '',
    raw: true,
  });
  for (const [indicador, sentido, verde, vermelho] of linhas.slice(1)) {
    const item = INDICADORES.find((i) => normalizarNome(i.titulo) === normalizarNome(indicador));
    if (!item) continue;
    metas[item.chave] = {
      sentido: normalizarNome(sentido) === 'MENOR' ? 'menor' : 'maior',
      verde: textoDaMeta(verde, item.chave),
      vermelho: textoDaMeta(vermelho, item.chave),
    };
  }
  return metas;
};

/** historico/relatorio_ura.csv do BENZAITEN (ou exportado por aqui) */
export const importarHistoricoUra = (cabecalho: unknown[], linhas: unknown[][]): RegistroHistoricoUra[] => {
  return comoDicionarios(cabecalho, linhas)
    .map((l) => ({
      data: converterData(l['DATA']) ?? '',
      tipo: String(l['TIPO'] ?? '') as TipoLinha,
      nome: String(l['NOME'] ?? ''),
      tma: Math.round(converterValorBr(l['TMA (S)'])),
      tmo: Math.round(converterValorBr(l['TMO (S)'])),
      leads: Math.round(converterValorBr(l['LEADS'])),
      custo: converterValorBr(l['CUSTO']),
      vendas: converterValorBr(l['VENDAS']),
      clientes: Math.round(converterValorBr(l['CLIENTES'])),
    }))
    .filter((r) => r.data && r.tipo);
};
