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
  /** Operadores ativos da Argus no último ranking (atualizada sozinha); usada quando a Argus não responde */
  funcionarios_ativos: string[];
  ia: { usar_chatgpt: boolean; usar_claude: boolean };
  /** Entram no ranking mesmo sem estar ativos na Argus (nome como na esteira) */
  incluir_sempre: string[];
  /** Nome na esteira → nome na Argus ("" = não é a mesma pessoa) */
  vinculos_argus: Record<string, string>;
  /** Quando a lista de ativos veio da Argus pela última vez (ISO) */
  argus_em: string | null;
}
