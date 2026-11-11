/**
 * Tipos do Ranking de Contratos usados pelo servidor e pelo navegador. Este arquivo não tem imports:
 * o servidor roda com node --experimental-strip-types e o navegador importa sem extensão.
 */

export interface MetasGrupo {
  meta_vendedor: number;
  meta_bonus_vendedor: number;
  meta_supervisor: number;
  meta_bonus_supervisor: number;
  meta_cartao: number;
}

/** Mesmo formato do config.json do pacote (abas GUIA e AUXILIAR), mais a escolha das IAs */
export interface ConfigRanking {
  metas: { clt: MetasGrupo; estagio: MetasGrupo; meta_geral: number };
  emoji_destaque: string;
  /** AAAA-MM-DD */
  feriados: string[];
  vendedores_clt: string[];
  supervisores_clt: string[];
  renomear_supervisores: Record<string, string>;
  funcionarios_ativos: string[];
  ia: { usar_chatgpt: boolean; usar_claude: boolean };
}
