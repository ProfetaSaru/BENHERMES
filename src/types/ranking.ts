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

export type ProvedorComentarios = 'chatgpt' | 'claude' | 'frases';

/** Um ranking gerado, como fica no histórico do servidor (sem as esteiras) */
export interface RegistroRanking {
  id: string;
  /** AAAA-MM-DD */
  dia: string;
  geradoEm: string;
  geradoPor: string;
  provedor: ProvedorComentarios;
  relatorio: RelatorioRanking;
  legenda: string;
}

export interface StatusIa {
  chatgpt: { chave: boolean };
  claude: { chave: boolean };
}
