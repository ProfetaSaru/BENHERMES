/**
 * Tipos do Relatório de Produtividade da URA.
 * Datas sempre no formato ISO (AAAA-MM-DD).
 */

/** Exportações reconhecidas pelas colunas */
export type TipoExportacao = 'esteira' | 'operadores' | 'tarifacao' | 'desempenho' | 'leads';

/** Arquivos de configuração do BENZAITEN que também podem ser arrastados para cá */
export type TipoConfiguracao = 'cadastro_benzaiten' | 'historico_benzaiten' | 'metas_benzaiten';

/** Linha de uma exportação: {COLUNA PADRONIZADA: valor} */
export type LinhaExportacao = Record<string, unknown>;

export interface ArquivoCarregado {
  id: string;
  nome: string;
  tipo: TipoExportacao;
  linhas: LinhaExportacao[];
}

export interface OperadorCadastro {
  nome: string;
  supervisor: string;
  equipe: string;
  status: string;
}

export interface Apelido {
  noSistema: string;
  oficial: string;
}

export type ChaveIndicador = 'tma' | 'tmo' | 'leads' | 'custo' | 'vendas' | 'clientes' | 'custo_cpf' | 'prod_lead';

export interface Meta {
  sentido: 'maior' | 'menor';
  /** Texto digitado (ex.: "00:01:30", "15000,50"); vazio = sem limite */
  verde: string;
  vermelho: string;
}

export type Metas = Partial<Record<ChaveIndicador, Meta>>;

export type CorMeta = 'verde' | 'amarelo' | 'vermelho';

export type TipoLinha = 'operador' | 'separador' | 'equipe' | 'total_operadores' | 'sem_derivacao' | 'total_geral';

export interface LinhaRelatorio {
  tipo: TipoLinha;
  nome: string;
  tma?: number | null;
  tmo?: number | null;
  leads?: number;
  custo?: number;
  vendas?: number;
  clientes?: number;
  custo_cpf?: number;
  prod_lead?: number;
  d_leads?: number;
  d_vendas?: number;
  d_custo?: number;
}

/** Uma linha do histórico (mesmo conteúdo do historico/relatorio_ura.csv do BENZAITEN) */
export interface RegistroHistoricoUra {
  data: string;
  tipo: TipoLinha;
  nome: string;
  tma: number;
  tmo: number;
  leads: number;
  custo: number;
  vendas: number;
  clientes: number;
}

export interface ArquivoConferencia {
  nome: string;
  tipo: string;
  observacao: string;
}

/**
 * Valor de uma tarifação (VENDITORE ou 4NET): o que o Argus estimou e, se digitado,
 * o valor real da fatura. Com o valor real, todas as linhas daquela tarifação são
 * multiplicadas pelo fator (real / estimado), mantendo a proporção entre operadores.
 */
export interface CorrecaoTarifacao {
  operadora: string;
  arquivos: string[];
  estimado: number;
  real: number | null;
  fator: number;
}

export interface ResultadoUra {
  data: string;
  linhas: LinhaRelatorio[];
  dataAnterior: string | null;
  operadoresAtivos: number;
  semDerivacao: number;
  custoRobos: number;
  custoImportado: number;
  custoIgnorado: number;
  custoNoRelatorio: number;
  vendasIgnoradas: number;
  tarifacoes: CorrecaoTarifacao[];
  semVinculo: Record<string, string[]>;
  exColaboradores: Record<string, string[]>;
  avisos: string[];
  arquivos: ArquivoConferencia[];
}
