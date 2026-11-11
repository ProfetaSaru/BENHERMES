import { ConfigRanking, LinhaRanking, MetasGrupo, RelatorioRanking } from '../../types/ranking';

/**
 * Ranking de Contratos Pagos: porte do engine.py (réplica da macro ATUALIZAR da planilha
 * "Ranking_relatorio_com_comentarios_OFICIAL.xlsm"). As regras são as mesmas da macro e não devem
 * ser "melhoradas" — o teste golden compara com o ranking oficial centavo por centavo.
 * Tudo puro; roda no navegador (as esteiras têm CPF e não saem do computador).
 */

const PRODUTOS_MARGEM_CARTAO = new Set(['MARGEM LIVRE', 'CARTAO BENEFICIO', 'CARTAO']);
const COLUNAS = ['Proposta', 'Etapa', 'Produto', 'Agente', 'Equipe', 'Valor Contrato'];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Igual à NORMALIZAR da macro: maiúsculas, sem acento, espaços colapsados */
export const normalizar = (texto: unknown): string =>
  texto === null || texto === undefined
    ? ''
    : String(texto)
        .trim()
        .toUpperCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .join(' ');

/** '11.233,99' / '11233.99' / 11233.99 / '' → número */
export const numeroBr = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

/** Divide uma linha do CSV (separador ';', aspas opcionais) */
const campos = (linha: string): string[] => {
  const saida: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === ';') {
      saida.push(atual);
      atual = '';
    } else atual += c;
  }
  saida.push(atual);
  return saida;
};

/** CSV exportado do sistema (separador ';', UTF-8 com BOM). Cabeçalhos sem espaços nas pontas. */
export const lerEsteira = (texto: string): { linhas: Record<string, string>[]; faltando: string[] } => {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (linhas.length === 0) return { linhas: [], faltando: [...COLUNAS] };
  const cabecalho = campos(linhas[0]).map((c) => c.trim());
  const registros = linhas.slice(1).map((l) => {
    const valores = campos(l);
    return Object.fromEntries(cabecalho.map((c, i) => [c, valores[i] ?? '']));
  });
  return { linhas: registros, faltando: COLUNAS.filter((c) => !cabecalho.includes(c)) };
};

/** Qual das duas esteiras é: a de pagamento tem contratos "Pago"; a de andamento, "Andamento" */
const contarEtapas = (linhas: Record<string, string>[]) => {
  let pago = 0;
  let andamento = 0;
  for (const l of linhas) {
    const etapa = (l.Etapa ?? '').trim();
    if (etapa === 'Pago') pago++;
    else if (etapa === 'Andamento') andamento++;
  }
  return { pago, andamento };
};

/** A etapa que mais aparece decide (a esteira de Andamento pode ter alguns "Pago" e vice-versa) */
export const qualEsteira = (linhas: Record<string, string>[]): 'pagamento' | 'andamento' | null => {
  const { pago, andamento } = contarEtapas(linhas);
  if (pago === 0 && andamento === 0) return null;
  return pago >= andamento ? 'pagamento' : 'andamento';
};

/**
 * Com as duas esteiras juntas, a que tem mais "Andamento" proporcionalmente é a de andamento e a outra a de
 * pagamento. Sozinha (ou empatadas), vale a etapa que mais aparece. Arquivos sem nenhuma das duas ficam fora.
 */
export const separarEsteiras = <T extends { linhas: Record<string, string>[] }>(arquivos: T[]): (T & { tipo: 'pagamento' | 'andamento' })[] => {
  if (arquivos.length === 2) {
    const fracao = arquivos.map((a) => contarEtapas(a.linhas).andamento / Math.max(1, a.linhas.length));
    if (fracao[0] !== fracao[1] && arquivos.every((a) => qualEsteira(a.linhas) !== null)) {
      const iAndamento = fracao[0] > fracao[1] ? 0 : 1;
      return arquivos.map((a, i) => ({ ...a, tipo: i === iAndamento ? ('andamento' as const) : ('pagamento' as const) }));
    }
  }
  return arquivos.flatMap((a) => {
    const tipo = qualEsteira(a.linhas);
    return tipo ? [{ ...a, tipo }] : [];
  });
};

// ---------------------------------------------------------------------------
// Datas (UTC, para não depender do fuso do computador)
// ---------------------------------------------------------------------------

const paraData = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const paraIso = (d: Date) => d.toISOString().slice(0, 10);
const somarDias = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const brasileira = (d: Date) => `${paraIso(d).slice(8, 10)}/${paraIso(d).slice(5, 7)}/${paraIso(d).slice(0, 4)}`;

const util = (d: Date, feriados: Set<string>) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !feriados.has(paraIso(d));

/**
 * (dias úteis passados até o último dia útil antes do relatório, total de dias úteis do mês).
 * Mesma lógica do CALC_ESPERADO: no 1º dia do mês, conta o mês anterior inteiro.
 */
export const diasUteis = (dia: string, feriados: string[]): [number, number] => {
  const f = new Set(feriados);
  let ultimo = somarDias(paraData(dia), -1);
  while (!util(ultimo, f) && ultimo.getUTCDate() > 1) ultimo = somarDias(ultimo, -1);
  const ano = ultimo.getUTCFullYear();
  const mes = ultimo.getUTCMonth();
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const contar = (ate: number) => {
    let n = 0;
    for (let d = 1; d <= ate; d++) if (util(new Date(Date.UTC(ano, mes, d)), f)) n++;
    return n;
  };
  return [contar(ultimo.getUTCDate()), contar(diasNoMes)];
};

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------

interface Contrato {
  etapa: 'Pago' | 'Andamento';
  produto: string;
  agente: string;
  equipe: string;
  valor: number;
}

/** Junta as esteiras sem duplicar proposta: da de pagamento só "Pago", da de andamento só "Andamento" */
const contratos = (andamento: Record<string, string>[], pagamento: Record<string, string>[]): Contrato[] => {
  const vistos = new Set<string>();
  const saida: Contrato[] = [];
  const entradas: [Record<string, string>, 'Pago' | 'Andamento'][] = [
    ...pagamento.map((l) => [l, 'Pago'] as [Record<string, string>, 'Pago']),
    ...andamento.map((l) => [l, 'Andamento'] as [Record<string, string>, 'Andamento']),
  ];
  entradas.forEach(([linha, etapaOk], i) => {
    if ((linha.Etapa ?? '').trim() !== etapaOk) return;
    const chave = (linha.Proposta ?? '').trim() || `sem-proposta-${i}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    saida.push({
      etapa: etapaOk,
      produto: (linha.Produto ?? '').trim().toUpperCase(),
      agente: normalizar((linha.Agente ?? '').split(' - ')[0]),
      equipe: normalizar(linha.Equipe),
      valor: numeroBr(linha['Valor Contrato']),
    });
  });
  return saida;
};

interface Agregado {
  port: number;
  and: number;
  mcQtd: number;
  mcValor: number;
  listar: boolean;
}

const agregar = (lista: Contrato[], chave: 'agente' | 'equipe') => {
  const ordem: string[] = [];
  const dados = new Map<string, Agregado>();
  for (const c of lista) {
    const k = c[chave];
    if (!k) continue;
    if (!dados.has(k)) dados.set(k, { port: 0, and: 0, mcQtd: 0, mcValor: 0, listar: false });
    const d = dados.get(k)!;
    const mc = PRODUTOS_MARGEM_CARTAO.has(c.produto);
    // A macro só lista quem tem contrato que não é margem/cartão
    if (!mc && !d.listar) {
      d.listar = true;
      ordem.push(k);
    }
    if (c.etapa === 'Pago') {
      if (mc) {
        d.mcQtd += 1;
        d.mcValor += c.valor;
      } else d.port += c.valor;
    } else if (!mc) d.and += c.valor;
  }
  return { ordem, dados };
};

/** Ordena por atingimento (desc); em empate, quem apareceu por último vem antes; mesmo atingimento = mesma posição */
const ordenarComEmpate = (itens: [string, number][]): [string, number][] => {
  const arred = (x: number) => Math.round(x * 1e12) / 1e12;
  const indexados = itens.map((item, i) => ({ item, i }));
  indexados.sort((a, b) => b.item[1] - a.item[1] || b.i - a.i);
  const saida: [string, number][] = [];
  let pos = 0;
  let anterior: number | null = null;
  indexados.forEach(({ item: [nome, ating] }, i) => {
    if (anterior === null || arred(ating) !== arred(anterior)) pos = i + 1;
    anterior = ating;
    saida.push([nome, pos]);
  });
  return saida;
};

const linha = (
  posicao: number,
  nome: string,
  d: Agregado,
  projetando: number,
  potencial: number,
  metaBonus: number
): LinhaRanking => ({
  posicao: `${posicao}º`,
  nome,
  portabilidade: d.port,
  projetando,
  potencial,
  margemCartao: d.mcQtd,
  andamento: d.and,
  projecao: d.port + d.and * 0.5,
  elegivel: d.port >= metaBonus,
  feedback: '',
});

export const gerarRelatorio = (
  andamento: Record<string, string>[],
  pagamento: Record<string, string>[],
  config: ConfigRanking,
  dia: string
): RelatorioRanking => {
  const { clt, estagio: est } = config.metas;
  const [passados, totalMes] = diasUteis(dia, config.feriados);
  const fator = passados / totalMes;
  const lista = contratos(andamento, pagamento);
  const ativos = new Set(config.funcionarios_ativos.map(normalizar));
  const vendCLT = new Set(config.vendedores_clt.map(normalizar));
  const supCLT = new Set(config.supervisores_clt.map(normalizar));
  const destaque = (nome: string, p: number) => (p >= 1.33 ? `${nome}   ${config.emoji_destaque}` : nome);
  const metasDe = (ehClt: boolean): MetasGrupo => (ehClt ? clt : est);

  // ---------------- vendedores
  const vend = agregar(lista, 'agente');
  const candidatos: [string, number][] = [];
  for (const nome of vend.ordem) {
    if (ativos.size > 0 && !ativos.has(nome)) continue; // REMOVER_DEMITIDOS
    candidatos.push([nome, vend.dados.get(nome)!.port / metasDe(vendCLT.has(nome)).meta_vendedor]);
  }
  const vendedores = ordenarComEmpate(candidatos).map(([nome, pos]) => {
    const d = vend.dados.get(nome)!;
    const ehClt = vendCLT.has(nome);
    const m = metasDe(ehClt);
    const esperado = m.meta_vendedor * fator;
    const p = esperado ? d.port / esperado : 0;
    const limiteExtra = ehClt ? 550 / 450 : 500 / 350;
    const taxa = ehClt ? (p < 1 ? 0.0015 : p < limiteExtra ? 0.0025 : 0.003) : p < 1 ? 0.001 : p < limiteExtra ? 0.0025 : 0.003;
    const extra = p >= limiteExtra ? 1000 : 0;
    const potencial = (m.meta_vendedor * p * taxa + d.mcValor * 0.01 + extra) * 1.2;
    return linha(pos, destaque(nome, p), d, p, potencial, m.meta_bonus_vendedor);
  });

  // ---------------- supervisores (pela coluna Equipe)
  const sup = agregar(lista, 'equipe');
  const renomear = new Map(Object.entries(config.renomear_supervisores).map(([k, v]) => [normalizar(k), v]));
  const candS: [string, number][] = sup.ordem.map((e) => [e, sup.dados.get(e)!.port / est.meta_supervisor]);
  const supervisores = ordenarComEmpate(candS).map(([equipe, pos]) => {
    const d = sup.dados.get(equipe)!;
    const ehClt = supCLT.has(equipe);
    const m = metasDe(ehClt);
    const esperado = m.meta_supervisor * fator;
    const p = esperado ? d.port / esperado : 0;
    const taxa = ehClt ? (p < 1 ? 0.001 : p < 3600 / 2800 ? 0.0015 : 0.002) : p < 1 ? 0.0015 : p < 2800 / 2400 ? 0.0018 : 0.0024;
    const potencial = (m.meta_supervisor * p * taxa + d.mcValor * 0.01) * 1.2;
    const nome = renomear.get(normalizar(equipe)) ?? equipe;
    return linha(pos, destaque(nome, p), d, p, potencial, m.meta_bonus_supervisor);
  });

  // ---------------- total geral: soma dos supervisores; potencial e elegíveis somam todos
  const portTotal = supervisores.reduce((s, l) => s + l.portabilidade, 0);
  const esperadoGeral = config.metas.meta_geral * fator;
  const todos = [...vendedores, ...supervisores];
  const d = paraData(dia);
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

  return {
    dia,
    vendedores,
    supervisores,
    total: {
      portabilidade: portTotal,
      projetando: esperadoGeral ? portTotal / esperadoGeral : 0,
      potencial: todos.reduce((s, l) => s + l.potencial, 0),
      margemCartao: supervisores.reduce((s, l) => s + l.margemCartao, 0),
      andamento: supervisores.reduce((s, l) => s + l.andamento, 0),
      projecao: supervisores.reduce((s, l) => s + l.projecao, 0),
      elegiveis: todos.filter((l) => l.elegivel).length,
    },
    metaCartao: clt.meta_cartao,
    tituloVendedor: `RANKING GERAL DE CONTRATOS PAGOS - VENDEDOR - DE ${brasileira(inicio)} A ${brasileira(d)}`,
    tituloSupervisor: `RANKING GERAL DE CONTRATOS PAGOS - SUPERVISOR - DE ${brasileira(inicio)} A ${brasileira(d)}`,
    cabecalhoProjecao: `PORT. PROJEÇÃO - ${brasileira(somarDias(d, 7))}`,
  };
};
