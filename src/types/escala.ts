/**
 * Um sorteio registrado: quem ficou com qual base em determinado dia.
 * A data fica no formato ISO (AAAA-MM-DD) para não sofrer com fuso horário.
 */
export interface EscalaRegistro {
  data: string;
  base: string;
  responsavel: string;
}

/**
 * Cadastro da escala: as bases (lotes/notas do INSS) e as pessoas
 * (grupos operacionais dos supervisores) que participam do sorteio.
 */
export interface EscalaCadastro {
  bases: string[];
  pessoas: string[];
}

export interface EscalaAtribuicao {
  base: string;
  responsavel: string;
}

/**
 * Resultado de um sorteio, pronto para exibir, copiar e exportar.
 */
export interface ResultadoSorteio {
  data: string;
  atribuicoes: EscalaAtribuicao[];
  ausentes: string[];
  semBase: string[];
  avisos: string[];
}

/**
 * O que foi encontrado ao importar uma planilha antiga ou um histórico.
 */
export interface ImportacaoEscala {
  cadastro: EscalaCadastro | null;
  registros: EscalaRegistro[];
}
