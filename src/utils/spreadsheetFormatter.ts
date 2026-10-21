import * as XLSX from 'xlsx';
import { ParsedSheetData, ColumnMapping, FormattedRow, AutoDetectedMapping } from '../types/formatter';

/**
 * Remove acentos e caracteres especiais para comparação flexível de cabeçalhos
 */
const normalizeText = (text: string): string => {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Padrões de busca para identificação automática de colunas
 */
const PATTERNS = {
  cpf: [
    'cpf',
    'documento',
    'doc',
    'cpfcliente',
    'numcpf',
    'nrcpf',
    'nrdocumento',
    'cpftitular',
    'numerocpf',
  ],
  beneficio: [
    'beneficio',
    'benef',
    'nb',
    'nubeneficio',
    'nrbeneficio',
    'numbeneficio',
    'numerobeneficio',
    'numdocbeneficio',
    'matricula',
    'beneficiario',
  ],
  nome: [
    'nome',
    'cliente',
    'nomecompleto',
    'titular',
    'nometitular',
    'nomecliente',
    'segurado',
    'razaosocial',
  ],
};

/**
 * Detecta automaticamente em qual linha está o cabeçalho real (offset de cabeçalho)
 * analisando as primeiras 10 linhas da planilha.
 */
export const findHeaderRowIndex = (rawRows: any[][]): number => {
  const maxRowsToCheck = Math.min(rawRows.length, 10);
  let bestRowIndex = 0;
  let maxScore = -1;

  for (let r = 0; r < maxRowsToCheck; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    let rowScore = 0;
    const rowTexts = row.map((cell) => normalizeText(String(cell || '')));

    for (const text of rowTexts) {
      if (!text) continue;
      if (PATTERNS.cpf.some((p) => text.includes(p))) rowScore += 3;
      if (PATTERNS.beneficio.some((p) => text.includes(p))) rowScore += 3;
      if (PATTERNS.nome.some((p) => text.includes(p))) rowScore += 3;
    }

    if (rowScore > maxScore) {
      maxScore = rowScore;
      bestRowIndex = r;
    }
  }

  return maxScore > 0 ? bestRowIndex : 0;
};

/**
 * Extrai os dados de uma planilha/aba específica a partir do workbook SheetJS
 */
export const extractSheetData = (
  workbook: XLSX.WorkBook,
  sheetName: string,
  fileName: string,
  fileSizeBytes: number
): ParsedSheetData => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Aba "${sheetName}" não foi encontrada no arquivo.`);
  }

  // Converte a aba em matriz de células
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: true, // mantém as linhas vazias para "Cabeçalho na linha N" bater com a planilha
    raw: false,
  });

  const hasData = (row: any[]): boolean =>
    Array.isArray(row) && row.some((cell) => cell !== '' && cell !== null && cell !== undefined);

  if (!rawRows.some(hasData)) {
    return {
      fileName,
      fileSizeBytes,
      sheetNames: workbook.SheetNames,
      activeSheet: sheetName,
      headers: [],
      rows: [],
      totalRows: 0,
      headerRowIndex: 0,
    };
  }

  // Identifica a linha do cabeçalho
  const headerRowIndex = findHeaderRowIndex(rawRows);
  const headerRaw = rawRows[headerRowIndex] || [];

  // Mapeia os nomes das colunas, preenchendo vazios com fallback amigável
  const headers = headerRaw.map((col, idx) => {
    const val = String(col ?? '').trim();
    return val ? val : `Coluna ${idx + 1}`;
  });

  // Filtra linhas de dados posteriores à linha de cabeçalho
  const rows = rawRows.slice(headerRowIndex + 1).filter(hasData);

  return {
    fileName,
    fileSizeBytes,
    sheetNames: workbook.SheetNames,
    activeSheet: sheetName,
    headers,
    rows,
    totalRows: rows.length,
    headerRowIndex,
  };
};

/**
 * Lê e analisa qualquer arquivo de planilha suportado (.xlsx, .xls, .csv, .tsv, .txt)
 */
export const parseSpreadsheetFile = async (
  file: File,
  targetSheetName?: string
): Promise<{ workbook: XLSX.WorkBook; data: ParsedSheetData }> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    raw: false,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('O arquivo não contém nenhuma aba legível.');
  }

  const selectedSheet = targetSheetName && workbook.SheetNames.includes(targetSheetName)
    ? targetSheetName
    : workbook.SheetNames[0];

  const data = extractSheetData(workbook, selectedSheet, file.name, file.size);

  return { workbook, data };
};

/**
 * Detecta automaticamente colunas candidatas para CPF, BENEFICIO e NOME.
 * Primeiro procura o nome EXATO ("cpf", "beneficio", "nome"...), depois um cabeçalho
 * que CONTENHA o padrão — assim "Beneficio" ganha de "Desbloqueio NB".
 * Uma coluna já escolhida não é usada para outro campo.
 */
export const autoDetectColumns = (headers: string[]): AutoDetectedMapping => {
  const mapping: AutoDetectedMapping = {
    cpf: '',
    beneficio: '',
    nome: '',
  };

  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: normalizeText(h),
  }));

  const fields: (keyof AutoDetectedMapping)[] = ['cpf', 'beneficio', 'nome'];

  for (const field of fields) {
    const used = Object.values(mapping);
    const candidates = normalizedHeaders.filter((item) => !used.includes(item.original));
    const patterns = PATTERNS[field];

    const exact = candidates.find((item) => patterns.includes(item.normalized));
    const partial = candidates.find((item) => patterns.some((p) => item.normalized.includes(p)));

    mapping[field] = (exact ?? partial)?.original ?? '';
  }

  return mapping;
};

/**
 * Completa com zeros à esquerda o CPF que o Excel salvou como número
 * (ex.: 1234567890 -> 01234567890). Só altera valores com 9 ou 10 dígitos.
 */
export const padCpf = (value: string): string => {
  return /^\d{9,10}$/.test(value) ? value.padStart(11, '0') : value;
};

/**
 * Lê o valor de uma célula como texto (vazio se a coluna não existir na linha)
 */
const cellText = (row: any[], index: number): string => {
  return index >= 0 && row[index] !== undefined && row[index] !== null ? String(row[index]) : '';
};

/**
 * Sanitiza valores de células no padrão RFC 4180
 * Envolve em aspas se contiver ponto-e-vírgula, quebra de linha ou aspas duplas,
 * mantendo o dado original exatamente como veio do arquivo.
 */
export const escapeCsvValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // Se contiver delimitador, quebras de linha ou aspas, aplica escape padrão
  if (str.includes(';') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return str;
};

/**
 * Converte as linhas brutas para a estrutura padronizada FormattedRow
 */
export const getFormattedRows = (
  headers: string[],
  rows: any[][],
  mapping: ColumnMapping,
  limit?: number
): FormattedRow[] => {
  const cpfIndex = headers.indexOf(mapping.cpf);
  const beneficioIndex = headers.indexOf(mapping.beneficio);
  const nomeIndex = headers.indexOf(mapping.nome);

  const targetRows = typeof limit === 'number' && limit > 0 ? rows.slice(0, limit) : rows;

  return targetRows.map((row) => ({
    cpf: padCpf(cellText(row, cpfIndex)),
    beneficio: cellText(row, beneficioIndex),
    nome: cellText(row, nomeIndex),
    telefone1: '',
    telefone2: '',
    telefone3: '',
    telefone4: '',
    telefone5: '',
  }));
};

/**
 * Gera o texto do arquivo CSV completo com cabeçalho fixo e 5 colunas de telefone vazias
 * Formato: CPF;BENEFICIO;NOME;TELEFONE1;TELEFONE2;TELEFONE3;TELEFONE4;TELEFONE5
 */
export const generateFormattedCsv = (
  headers: string[],
  rows: any[][],
  mapping: ColumnMapping
): string => {
  const HEADER_LINE = 'CPF;BENEFICIO;NOME;TELEFONE1;TELEFONE2;TELEFONE3;TELEFONE4;TELEFONE5';

  const cpfIndex = headers.indexOf(mapping.cpf);
  const beneficioIndex = headers.indexOf(mapping.beneficio);
  const nomeIndex = headers.indexOf(mapping.nome);

  const lines: string[] = [HEADER_LINE];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cpfVal = escapeCsvValue(padCpf(cellText(row, cpfIndex)));
    const beneficioVal = escapeCsvValue(cellText(row, beneficioIndex));
    const nomeVal = escapeCsvValue(cellText(row, nomeIndex));

    // As 5 colunas de telefones são deixadas vazias (5 pontos-e-vírgula ao final)
    lines.push(`${cpfVal};${beneficioVal};${nomeVal};;;;;`);
  }

  return lines.join('\r\n');
};

/**
 * Dispara o download seguro do arquivo CSV gerado com UTF-8 BOM (\uFEFF)
 * garantindo compatibilidade imediata com Microsoft Excel no Windows.
 */
export const downloadCsvFile = (csvContent: string, originalFileName: string): void => {
  const bomPrefix = '\uFEFF';
  const blob = new Blob([bomPrefix + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const safeBaseName = originalFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const downloadName = `${safeBaseName}_formatado.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', downloadName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

/**
 * Formata bytes em formato legível (KB, MB)
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
