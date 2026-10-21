/**
 * Escrita de CSV no padrão do Excel brasileiro (separador ;) e download de arquivos de texto.
 */

export const escaparCsv = (valor: string): string => {
  return /[;"\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
};

/** Dispara o download de um arquivo de texto com BOM UTF-8 (o Excel abre com acentos certos) */
export const baixarTexto = (conteudo: string, nomeArquivo: string): void => {
  const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', nomeArquivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
