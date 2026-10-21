import type { Cell, Workbook } from 'exceljs';

/**
 * Planilhas .xlsx com cores, fontes e bordas (exceljs). A biblioteca só é carregada
 * quando alguém baixa uma planilha, para não pesar na abertura do BENHERMES.
 */

export const novaPlanilha = async (): Promise<Workbook> => {
  const ExcelJS = (await import('exceljs')).default;
  const livro = new ExcelJS.Workbook();
  livro.creator = 'BENHERMES';
  return livro;
};

/** "#0B2A5B" -> "FF0B2A5B" (formato de cor do Excel) */
const argb = (cor: string): string => `FF${cor.replace('#', '').toUpperCase()}`;

/** Fundo, cor da fonte e negrito de uma célula (como o preencher() do BENZAITEN) */
export const pintar = (
  celula: Cell,
  fundo?: string | null,
  fonte?: string | null,
  negrito = false,
  tamanho?: number
): void => {
  if (fundo) celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(fundo) } };
  celula.font = {
    name: 'Calibri',
    size: tamanho ?? 11,
    bold: negrito,
    ...(fonte ? { color: { argb: argb(fonte) } } : {}),
  };
};

/** Borda fina em volta da célula */
export const bordaFina = (celula: Cell, cor: string): void => {
  const lado = { style: 'thin' as const, color: { argb: argb(cor) } };
  celula.border = { top: lado, left: lado, bottom: lado, right: lado };
};

/** Gera o arquivo e dispara o download */
export const baixarPlanilha = async (livro: Workbook, nomeArquivo: string): Promise<void> => {
  const dados = await livro.xlsx.writeBuffer();
  const blob = new Blob([dados], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', nomeArquivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
