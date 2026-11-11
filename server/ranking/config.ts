import type { ConfigRanking, MetasGrupo } from './tipos.ts';

/**
 * Validação da configuração do ranking (mesmo formato do config.json do pacote, mais a escolha das IAs).
 * Sem imports de código: usado pelo servidor e pelo navegador (o import acima é só de tipo).
 */

const CAMPOS_META: (keyof MetasGrupo)[] = ['meta_vendedor', 'meta_bonus_vendedor', 'meta_supervisor', 'meta_bonus_supervisor', 'meta_cartao'];
const LISTAS = ['vendedores_clt', 'supervisores_clt', 'funcionarios_ativos'] as const;

const numeroValido = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const dataValida = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export const validarConfig = (bruto: unknown): { config: ConfigRanking } | { erro: string } => {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return { erro: 'A configuração precisa ser um objeto (o conteúdo do config.json).' };
  const d = bruto as Record<string, any>;
  const metas = d.metas;
  if (!metas || typeof metas !== 'object') return { erro: 'Faltam as metas (metas.clt, metas.estagio e metas.meta_geral).' };
  for (const grupo of ['clt', 'estagio'] as const) {
    if (!metas[grupo] || typeof metas[grupo] !== 'object') return { erro: `Faltam as metas de metas.${grupo}.` };
    for (const campo of CAMPOS_META) {
      if (!numeroValido(metas[grupo][campo])) return { erro: `metas.${grupo}.${campo} precisa ser um número maior ou igual a zero.` };
    }
  }
  if (!numeroValido(metas.meta_geral)) return { erro: 'metas.meta_geral precisa ser um número maior ou igual a zero.' };
  if (d.emoji_destaque !== undefined && typeof d.emoji_destaque !== 'string') return { erro: 'emoji_destaque precisa ser um texto.' };
  if (!Array.isArray(d.feriados) || !d.feriados.every(dataValida)) return { erro: 'feriados precisa ser uma lista de datas no formato AAAA-MM-DD.' };
  for (const lista of LISTAS) {
    if (!Array.isArray(d[lista]) || !d[lista].every((n: unknown) => typeof n === 'string')) return { erro: `${lista} precisa ser uma lista de nomes.` };
  }
  const renomear = d.renomear_supervisores ?? {};
  if (typeof renomear !== 'object' || Array.isArray(renomear) || !Object.values(renomear).every((v) => typeof v === 'string')) {
    return { erro: 'renomear_supervisores precisa ligar textos a textos (como vem na esteira → como aparece).' };
  }
  const incluir = d.incluir_sempre ?? [];
  if (!Array.isArray(incluir) || !incluir.every((n: unknown) => typeof n === 'string')) return { erro: 'incluir_sempre precisa ser uma lista de nomes.' };
  const vinculos = d.vinculos_argus ?? {};
  if (typeof vinculos !== 'object' || Array.isArray(vinculos) || !Object.values(vinculos).every((v) => typeof v === 'string')) {
    return { erro: 'vinculos_argus precisa ligar textos a textos (nome na esteira → nome na Argus).' };
  }
  const argusEm = d.argus_em ?? null;
  if (argusEm !== null && (typeof argusEm !== 'string' || Number.isNaN(Date.parse(argusEm)) || !/^\d{4}-\d{2}-\d{2}T/.test(argusEm))) {
    return { erro: 'argus_em precisa ser uma data e hora (ISO).' };
  }
  const ia = d.ia ?? {};
  const grupo = (g: any): MetasGrupo => Object.fromEntries(CAMPOS_META.map((c) => [c, g[c]])) as unknown as MetasGrupo;
  return {
    config: {
      metas: { clt: grupo(metas.clt), estagio: grupo(metas.estagio), meta_geral: metas.meta_geral },
      emoji_destaque: d.emoji_destaque || '🏆',
      feriados: [...d.feriados],
      vendedores_clt: d.vendedores_clt.map((n: string) => n.trim()).filter(Boolean),
      supervisores_clt: d.supervisores_clt.map((n: string) => n.trim()).filter(Boolean),
      renomear_supervisores: { ...renomear },
      funcionarios_ativos: d.funcionarios_ativos.map((n: string) => n.trim()).filter(Boolean),
      ia: { usar_chatgpt: ia.usar_chatgpt !== false, usar_claude: ia.usar_claude !== false },
      incluir_sempre: incluir.map((n: string) => n.trim()).filter(Boolean),
      vinculos_argus: Object.fromEntries(Object.entries(vinculos as Record<string, string>).map(([de, para]) => [de.trim(), para.trim()]).filter(([de]) => de)),
      argus_em: argusEm,
    },
  };
};
