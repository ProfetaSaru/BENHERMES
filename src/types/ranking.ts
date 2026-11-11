export type { ConfigRanking, MetasGrupo } from '../../server/ranking/tipos';

/** Uma linha do ranking (vendedor ou supervisor), como na aba RELATORIO */
export interface LinhaRanking {
  posicao: string;
  nome: string;
  portabilidade: number;
  projetando: number;
  potencial: number;
  margemCartao: number;
  andamento: number;
  projecao: number;
  elegivel: boolean;
  feedback: string;
}

export interface TotalRanking {
  portabilidade: number;
  projetando: number;
  potencial: number;
  margemCartao: number;
  andamento: number;
  projecao: number;
  elegiveis: number;
}

export interface RelatorioRanking {
  /** AAAA-MM-DD */
  dia: string;
  vendedores: LinhaRanking[];
  supervisores: LinhaRanking[];
  total: TotalRanking;
  metaCartao: number;
  tituloVendedor: string;
  tituloSupervisor: string;
  cabecalhoProjecao: string;
}
