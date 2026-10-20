export interface ParsedSheetData {
  fileName: string;
  fileSizeBytes: number;
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  totalRows: number;
  headerRowIndex: number;
}

export interface ColumnMapping {
  cpf: string;
  beneficio: string;
  nome: string;
}

export interface FormattedRow {
  cpf: string;
  beneficio: string;
  nome: string;
  telefone1: string;
  telefone2: string;
  telefone3: string;
  telefone4: string;
  telefone5: string;
}

export interface AutoDetectedMapping {
  cpf: string;
  beneficio: string;
  nome: string;
}
