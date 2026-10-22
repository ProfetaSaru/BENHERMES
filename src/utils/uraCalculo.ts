import {
  Apelido,
  ArquivoCarregado,
  ArquivoConferencia,
  ChaveIndicador,
  CorMeta,
  CorrecaoTarifacao,
  LinhaExportacao,
  LinhaRelatorio,
  Meta,
  Metas,
  OperadorCadastro,
  RegistroHistoricoUra,
  ResultadoUra,
  TipoExportacao,
  TipoLinha,
} from '../types/relatorioUra';
import { isoParaBr, normalizarNome } from './calendario';
import { NOMES_DOS_TIPOS, converterData, converterValorBr, tempoParaSegundos } from './uraLeitura';

/**
 * Relatório diário de produtividade da URA — mesmas contas do relatorio_ura.py do BENZAITEN.
 *
 *  TMA e TMO ............. Argus > Desempenho Operadores (colunas TMA e TME)
 *  Leads atendidos/URA ... Argus > Desempenho Operadores > grupo RECEPTIVO - URA
 *  Custo total ........... Tarifação VENDITORE + 4NET: custo do operador
 *                          + rateio do custo dos robôs da URA, na proporção dos leads
 *  Vendas geral .......... Vanguard: soma do Valor Contrato (etapas Andamento, Pendente, Pago)
 *  Clientes efetivados ... Vanguard: CPFs únicos com etapa Andamento ou Pago
 *  Custo por CPF ......... custo total / clientes efetivados
 *  Produção/lead ......... vendas geral / leads atendidos
 *
 * Ordem: quem mais vendeu primeiro (empate: mais leads), depois o total de cada equipe
 * (também por vendas) e os totais. Nas equipes, TMA e TMO são a SOMA dos operadores.
 */

const ETAPAS_VENDA = new Set(['ANDAMENTO', 'PENDENTE', 'PAGO']); // entram em Vendas geral
const ETAPAS_CLIENTE = new Set(['ANDAMENTO', 'PAGO']); // entram em Clientes efetivados
const COLUNA_VALOR_VENDA = 'VALOR CONTRATO';
const PREFIXOS_ROBO = ['OPER VIRT', 'OPERADOR VIRT']; // linhas dos robôs da URA na tarifação
const TEXTO_SEM_DERIVACAO = 'SEM DERIVACAO'; // linha "<LIGAÇÕES SEM DERIVAÇÃO P/ OPERADOR>"

/** Tipos de linha que vão para o histórico */
const TIPOS_NO_HISTORICO: TipoLinha[] = ['operador', 'equipe', 'total_operadores', 'total_geral'];

interface Operador {
  nome: string;
  equipe: string;
  ordem: number;
  tma: number;
  tmo: number;
  leads: number;
  custoDireto: number;
  rateioRobos: number;
  vendas: number;
  cpfs: Set<string>;
  temDesempenho: boolean;
}

const custoDe = (op: Operador): number => op.custoDireto + op.rateioRobos;

const temAtividade = (op: Operador): boolean =>
  op.leads > 0 || custoDe(op) > 0 || op.vendas > 0 || op.cpfs.size > 0;

/** Divisão que devolve 0 quando o divisor é 0 (igual ao SEERRO do Excel) */
const dividir = (a: number, b: number): number => (b ? a / b : 0);

const moeda = (valor: number): string =>
  `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "VENDITORE.csv" -> VENDITORE, "4net_19-10.xlsx" -> 4NET; outro nome fica como está */
export const operadoraDaTarifacao = (nomeDoArquivo: string): string => {
  const nome = normalizarNome(nomeDoArquivo).replace(/[^A-Z0-9]/g, '');
  if (nome.includes('VENDITORE')) return 'VENDITORE';
  if (nome.includes('4NET')) return '4NET';
  return nomeDoArquivo.replace(/\.[^.]+$/, '');
};

/** Valor de cada linha da tarifação que entra no custo (operadores, robôs e sem derivação) */
const valoresDaTarifacao = (arquivo: ArquivoCarregado) =>
  arquivo.linhas
    .map((linha) => ({ descricao: String(linha['DESCRICAO'] ?? '').trim(), valor: converterValorBr(linha['VALOR R$']) }))
    .filter(({ descricao }) =>
      descricao.startsWith('<') ? normalizarNome(descricao).includes(TEXTO_SEM_DERIVACAO) : Boolean(descricao)
    );

/** Total de cada operadora como o Argus estimou, na ordem em que os arquivos foram carregados */
export const totaisDasTarifacoes = (arquivos: ArquivoCarregado[]): { operadora: string; arquivos: string[]; estimado: number }[] => {
  const totais = new Map<string, { operadora: string; arquivos: string[]; estimado: number }>();
  for (const arquivo of arquivos.filter((a) => a.tipo === 'tarifacao')) {
    const operadora = operadoraDaTarifacao(arquivo.nome);
    const atual = totais.get(operadora) ?? { operadora, arquivos: [], estimado: 0 };
    atual.arquivos.push(arquivo.nome);
    atual.estimado += valoresDaTarifacao(arquivo).reduce((soma, l) => soma + l.valor, 0);
    totais.set(operadora, atual);
  }
  return [...totais.values()];
};

export interface EntradaRelatorio {
  dia: string;
  arquivos: ArquivoCarregado[];
  cadastro: OperadorCadastro[];
  apelidos: Apelido[];
  historico: RegistroHistoricoUra[];
  /** Dia útil anterior ao dia do relatório: com quem comparar */
  diaAnterior: string;
  /** Valor real da fatura por operadora (VENDITORE, 4NET), quando o do Argus é só estimativa */
  valoresReais?: Record<string, number>;
}

/**
 * Faz todas as contas e monta as linhas do relatório, já comparadas com o anterior.
 */
export const calcularRelatorio = (entrada: EntradaRelatorio): ResultadoUra => {
  const { dia } = entrada;
  const porTipo = (tipo: TipoExportacao) => entrada.arquivos.filter((a) => a.tipo === tipo);

  // Cadastro: ativos na ordem do cadastro; inativos viram "ex-colaboradores"
  const operadores = new Map<string, Operador>();
  const inativos = new Set<string>();
  entrada.cadastro.forEach((op) => {
    const chave = normalizarNome(op.nome);
    if (!chave) return;
    if (normalizarNome(op.status) !== 'ATIVO') {
      inativos.add(chave);
      return;
    }
    if (operadores.has(chave)) return;
    operadores.set(chave, {
      nome: op.nome.trim(),
      equipe: op.equipe || 'SEM EQUIPE',
      ordem: operadores.size,
      tma: 0,
      tmo: 0,
      leads: 0,
      custoDireto: 0,
      rateioRobos: 0,
      vendas: 0,
      cpfs: new Set(),
      temDesempenho: false,
    });
  });
  operadores.forEach((_, chave) => inativos.delete(chave));
  const apelidos = new Map(entrada.apelidos.map((a) => [normalizarNome(a.noSistema), normalizarNome(a.oficial)]));

  const resultado: ResultadoUra = {
    data: dia,
    linhas: [],
    dataAnterior: null,
    operadoresAtivos: operadores.size,
    semDerivacao: 0,
    custoRobos: 0,
    custoImportado: 0,
    custoIgnorado: 0,
    custoNoRelatorio: 0,
    vendasIgnoradas: 0,
    tarifacoes: [],
    semVinculo: {},
    exColaboradores: {},
    avisos: [],
    arquivos: [],
  };
  const conferencia: ArquivoConferencia[] = resultado.arquivos;

  /**
   * Liga o nome de cada sistema ao operador do cadastro, só pelo nome padronizado e pelos
   * apelidos. NÃO faz correspondência por semelhança: nome diferente vira aviso.
   */
  const vincular = (nome: unknown, origem: string): Operador | null => {
    let chave = normalizarNome(nome);
    if (!chave) return null;
    chave = apelidos.get(chave) ?? chave;
    const op = operadores.get(chave);
    if (op) return op;
    const lista = inativos.has(chave) ? resultado.exColaboradores : resultado.semVinculo;
    const exibido = String(nome).replace(/\s+/g, ' ').trim();
    lista[exibido] = [...new Set([...(lista[exibido] ?? []), origem])].sort();
    return null;
  };

  /** Junta as linhas com Data = dia; arquivos de outros dias ficam de fora (com aviso) */
  const linhasDoDia = (tipo: TipoExportacao): LinhaExportacao[] => {
    const escolhidas: LinhaExportacao[] = [];
    for (const arquivo of porTipo(tipo)) {
      const doDia = arquivo.linhas.filter((l) => converterData(l['DATA']) === dia);
      if (doDia.length > 0) {
        escolhidas.push(...doDia);
        conferencia.push({ nome: arquivo.nome, tipo: NOMES_DOS_TIPOS[tipo], observacao: `${doDia.length} linha(s) de ${isoParaBr(dia)}` });
      } else {
        const datas = [...new Set(arquivo.linhas.map((l) => converterData(l['DATA'])).filter(Boolean) as string[])].sort();
        const outras = datas.map(isoParaBr).join(', ') || 'sem data';
        conferencia.push({ nome: arquivo.nome, tipo: NOMES_DOS_TIPOS[tipo], observacao: `IGNORADO: é de ${outras}` });
      }
    }
    return escolhidas;
  };

  // 1. TMA e TMO (desempenho do Argus)
  for (const linha of linhasDoDia('desempenho')) {
    const op = vincular(linha['OPERADOR'], 'Argus desempenho');
    if (!op) continue;
    op.tma = tempoParaSegundos(linha['TMA']);
    op.tmo = tempoParaSegundos(linha['TME']);
    op.temDesempenho = true;
  }

  // 2. Leads atendidos da URA
  for (const linha of linhasDoDia('leads')) {
    const op = vincular(linha['OPERADOR'], 'Argus leads URA');
    if (op) op.leads += Math.trunc(converterValorBr(linha['LEADS. ATEND.']));
  }

  // 3. Custos (tarifação VENDITORE + 4NET). Com o valor real da fatura, cada linha da
  // operadora é multiplicada por real / estimado: o total bate com a fatura e a divisão
  // entre operadores, robôs e sem derivação continua na mesma proporção do Argus.
  const tarifacoes = porTipo('tarifacao');
  const fatores = new Map<string, number>();
  resultado.tarifacoes = totaisDasTarifacoes(tarifacoes).map(({ operadora, arquivos, estimado }): CorrecaoTarifacao => {
    const digitado = entrada.valoresReais?.[operadora];
    const real = digitado !== undefined && Number.isFinite(digitado) && digitado > 0 ? digitado : null;
    if (real !== null && estimado <= 0) {
      resultado.avisos.push(
        `A tarifação ${operadora} não tem valores para corrigir: o valor real de ${moeda(real)} não entrou no custo.`
      );
      return { operadora, arquivos, estimado, real: null, fator: 1 };
    }
    const fator = real !== null ? real / estimado : 1;
    if (real !== null && Math.abs(fator - 1) > 0.5) {
      resultado.avisos.push(
        `O valor real da ${operadora} (${moeda(real)}) está muito longe do que o Argus estimou (${moeda(estimado)}). Confira se foi digitado certo.`
      );
    }
    fatores.set(operadora, fator);
    return { operadora, arquivos, estimado, real, fator };
  });
  for (const arquivo of tarifacoes) {
    const fator = fatores.get(operadoraDaTarifacao(arquivo.nome)) ?? 1;
    conferencia.push({
      nome: arquivo.nome,
      tipo: NOMES_DOS_TIPOS.tarifacao,
      observacao: `${arquivo.linhas.length} linha(s)${fator !== 1 ? ' • corrigida pelo valor real da fatura' : ''}`,
    });
    for (const { descricao, valor: estimado } of valoresDaTarifacao(arquivo)) {
      const valor = estimado * fator;
      resultado.custoImportado += valor;
      if (descricao.startsWith('<')) {
        // Das linhas de total, só a "SEM DERIVAÇÃO" entra no custo
        resultado.semDerivacao += valor;
        continue;
      }
      if (PREFIXOS_ROBO.some((p) => normalizarNome(descricao).startsWith(p))) {
        resultado.custoRobos += valor;
        continue;
      }
      const op = vincular(descricao, 'Tarifação');
      if (op) op.custoDireto += valor;
      else resultado.custoIgnorado += valor;
    }
  }

  // 4. Rateio do custo dos robôs na proporção dos leads da URA
  const lista = [...operadores.values()];
  const totalLeads = lista.reduce((s, op) => s + op.leads, 0);
  if (totalLeads > 0) {
    lista.forEach((op) => (op.rateioRobos = (resultado.custoRobos * op.leads) / totalLeads));
  } else if (resultado.custoRobos > 0) {
    resultado.avisos.push(
      `Há ${moeda(resultado.custoRobos)} de custo dos robôs da URA, mas nenhum lead atendido para fazer o rateio. Esse custo ficou fora do relatório.`
    );
  }

  // 5. Vendas e clientes efetivados (esteira do Vanguard)
  const esteiras = porTipo('esteira');
  if (esteiras.length > 1) {
    resultado.avisos.push('Há mais de uma esteira carregada: as vendas foram somadas. Confira se não é o mesmo arquivo duas vezes.');
  }
  let vendasNoDia = 0;
  for (const arquivo of esteiras) {
    const doDia = arquivo.linhas.filter((l) => converterData(l['DATA/HORA']) === dia);
    vendasNoDia += doDia.length;
    conferencia.push({
      nome: arquivo.nome,
      tipo: NOMES_DOS_TIPOS.esteira,
      observacao: `${doDia.length} de ${arquivo.linhas.length} proposta(s) com data ${isoParaBr(dia)}`,
    });
    for (const linha of doDia) {
      const etapa = normalizarNome(linha['ETAPA']);
      if (!ETAPAS_VENDA.has(etapa) && !ETAPAS_CLIENTE.has(etapa)) continue;
      const valor = converterValorBr(linha[COLUNA_VALOR_VENDA]);
      const op = vincular(linha['AGENTE'], 'Vanguard');
      if (!op) {
        if (ETAPAS_VENDA.has(etapa)) resultado.vendasIgnoradas += valor;
        continue;
      }
      if (ETAPAS_VENDA.has(etapa)) op.vendas += valor;
      const cpf = String(linha['CPF'] ?? '').trim();
      if (ETAPAS_CLIENTE.has(etapa) && cpf) op.cpfs.add(cpf);
    }
  }

  // Conferências
  if (porTipo('desempenho').length === 0 || !lista.some((op) => op.temDesempenho)) {
    resultado.avisos.push(`Não há desempenho (TMA/TME) de ${isoParaBr(dia)} nos arquivos carregados.`);
  }
  if (totalLeads === 0) resultado.avisos.push(`Não há leads da URA de ${isoParaBr(dia)} nos arquivos carregados.`);
  if (tarifacoes.length === 0) {
    resultado.avisos.push('Não há tarifação (VENDITORE/4NET): o custo ficou zerado.');
  } else if (tarifacoes.length > 2) {
    resultado.avisos.push(
      `Há ${tarifacoes.length} tarifações carregadas (o normal são 2: VENDITORE e 4NET). Todas foram somadas; remova as de outros dias.`
    );
  }
  if (esteiras.length === 0) {
    resultado.avisos.push('Não há esteira do Vanguard: vendas e clientes ficaram zerados.');
  } else if (vendasNoDia === 0) {
    resultado.avisos.push(`A esteira não tem nenhuma proposta com data ${isoParaBr(dia)}.`);
  }
  for (const arquivo of porTipo('operadores')) {
    conferencia.push({ nome: arquivo.nome, tipo: NOMES_DOS_TIPOS.operadores, observacao: 'cadastro' });
  }

  resultado.custoNoRelatorio = lista.reduce((s, op) => s + custoDe(op), 0) + resultado.semDerivacao;
  resultado.linhas = montarLinhas(lista, resultado.semDerivacao);
  resultado.dataAnterior = compararComAnterior(
    resultado.linhas,
    entrada.historico,
    dia,
    entrada.diaAnterior,
    resultado.avisos
  );
  return resultado;
};

const valores = (tma: number | null, tmo: number | null, leads: number, custo: number, vendas: number, clientes: number) => ({
  tma,
  tmo,
  leads,
  custo,
  vendas,
  clientes,
  custo_cpf: dividir(custo, clientes),
  prod_lead: dividir(vendas, leads),
});

/** Monta as linhas na ordem do relatório (só operadores com alguma atividade) */
const montarLinhas = (operadores: Operador[], semDerivacao: number): LinhaRelatorio[] => {
  const visiveis = operadores
    .filter(temAtividade)
    .sort((a, b) => b.vendas - a.vendas || b.leads - a.leads || a.ordem - b.ordem);

  const linhas: LinhaRelatorio[] = visiveis.map((op) => ({
    tipo: 'operador',
    nome: op.nome,
    ...valores(op.tma, op.tmo, op.leads, custoDe(op), op.vendas, op.cpfs.size),
  }));
  linhas.push({ tipo: 'separador', nome: '' });

  // Equipes: somam os operadores visíveis (TMA e TMO também são somados)
  const equipes = new Map<string, Operador[]>();
  visiveis.forEach((op) => equipes.set(op.equipe, [...(equipes.get(op.equipe) ?? []), op]));
  const soma = (membros: Operador[], f: (op: Operador) => number) => membros.reduce((s, op) => s + f(op), 0);
  const totaisEquipe: LinhaRelatorio[] = [...equipes.entries()].map(([equipe, membros]) => ({
    tipo: 'equipe',
    nome: `TOTAL EQUIPE - ${equipe}`,
    ...valores(
      soma(membros, (m) => m.tma),
      soma(membros, (m) => m.tmo),
      soma(membros, (m) => m.leads),
      soma(membros, custoDe),
      soma(membros, (m) => m.vendas),
      soma(membros, (m) => m.cpfs.size)
    ),
  }));
  // Empate: nome em ordem simples de caracteres (como o sorted do Python)
  totaisEquipe.sort((a, b) => (b.vendas ?? 0) - (a.vendas ?? 0) || (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0));
  linhas.push(...totaisEquipe);

  const leads = soma(visiveis, (m) => m.leads);
  const custo = soma(visiveis, custoDe);
  const vendas = soma(visiveis, (m) => m.vendas);
  const clientes = soma(visiveis, (m) => m.cpfs.size);
  linhas.push({ tipo: 'total_operadores', nome: 'TOTAL OPERADORES', ...valores(null, null, leads, custo, vendas, clientes) });
  linhas.push({ tipo: 'sem_derivacao', nome: 'LIGAÇÕES SEM DERIVAÇÃO P/ OPERADOR', custo: semDerivacao });
  linhas.push({
    tipo: 'total_geral',
    nome: 'TOTAL GERAL (c/ sem derivação)',
    ...valores(null, null, leads, custo + semDerivacao, vendas, clientes),
  });
  return linhas;
};

// ---------------------------------------------------------------------------
// Histórico e comparação com o relatório anterior
// ---------------------------------------------------------------------------

/**
 * Acrescenta em cada linha a diferença em relação ao relatório do dia útil anterior
 * (d_leads, d_vendas, d_custo). Se esse dia não estiver no histórico, compara com o
 * mais recente antes do dia e avisa. Devolve a data comparada (ou null).
 */
const compararComAnterior = (
  linhas: LinhaRelatorio[],
  historico: RegistroHistoricoUra[],
  dia: string,
  esperado: string,
  avisos: string[]
): string | null => {
  const datas = [...new Set(historico.filter((r) => r.data && r.data < dia).map((r) => r.data))].sort();
  if (datas.length === 0) return null;

  let anterior = esperado;
  if (!datas.includes(esperado)) {
    anterior = datas[datas.length - 1];
    avisos.push(
      `O relatório de ${isoParaBr(esperado)} (dia útil anterior) não está no histórico: a comparação foi feita com o de ${isoParaBr(anterior)}. Para incluí-lo, gere o relatório de ${isoParaBr(esperado)}.`
    );
  }

  const doAnterior = new Map(
    historico.filter((r) => r.data === anterior).map((r) => [`${r.tipo}|${normalizarNome(r.nome)}`, r])
  );
  for (const linha of linhas) {
    const antes = doAnterior.get(`${linha.tipo}|${normalizarNome(linha.nome)}`);
    if (!antes) continue;
    // NaN = número que não se conhece do dia anterior (ex.: custo sem a tarifação daquele dia)
    if (Number.isFinite(antes.leads)) linha.d_leads = (linha.leads ?? 0) - antes.leads;
    if (Number.isFinite(antes.vendas)) linha.d_vendas = (linha.vendas ?? 0) - antes.vendas;
    if (Number.isFinite(antes.custo)) linha.d_custo = (linha.custo ?? 0) - antes.custo;
  }
  return anterior;
};

/** Histórico com os números do dia (substitui o dia, se já existir), ordenado por data */
export const registrarNoHistorico = (
  historico: RegistroHistoricoUra[],
  resultado: ResultadoUra
): RegistroHistoricoUra[] => {
  const novos = resultado.linhas
    .filter((l) => TIPOS_NO_HISTORICO.includes(l.tipo))
    .map((l) => ({
      data: resultado.data,
      tipo: l.tipo,
      nome: l.nome,
      tma: l.tma ?? 0,
      tmo: l.tmo ?? 0,
      leads: l.leads ?? 0,
      custo: l.custo ?? 0,
      vendas: l.vendas ?? 0,
      clientes: l.clientes ?? 0,
    }));
  return [...historico.filter((r) => r.data !== resultado.data), ...novos]
    .map((registro, indice) => ({ registro, indice }))
    .sort((a, b) => a.registro.data.localeCompare(b.registro.data) || a.indice - b.indice)
    .map(({ registro }) => registro);
};

// ---------------------------------------------------------------------------
// Metas (semáforo verde / amarelo / vermelho)
// ---------------------------------------------------------------------------

/** Limite digitado -> número (TMA/TMO em segundos: "00:01:30" ou "90") */
export const valorDaMeta = (texto: string, chave: ChaveIndicador): number | null => {
  const limpo = texto.trim();
  if (!limpo) return null;
  if ((chave === 'tma' || chave === 'tmo') && limpo.includes(':')) return tempoParaSegundos(limpo);
  return converterValorBr(limpo);
};

/** 'verde', 'amarelo' ou 'vermelho' para o valor, conforme a meta (ou null sem meta) */
export const corDaMeta = (valor: number | null | undefined, chave: ChaveIndicador, meta?: Meta): CorMeta | null => {
  if (valor === null || valor === undefined || !meta) return null;
  const verde = valorDaMeta(meta.verde, chave);
  const vermelho = valorDaMeta(meta.vermelho, chave);
  if (verde === null && vermelho === null) return null;

  if (meta.sentido === 'maior') {
    if (verde !== null && valor >= verde) return 'verde';
    if (vermelho !== null && valor <= vermelho) return 'vermelho';
  } else {
    if (verde !== null && valor <= verde) return 'verde';
    if (vermelho !== null && valor >= vermelho) return 'vermelho';
  }
  return 'amarelo';
};

/** Só as metas com pelo menos um limite preenchido */
export const metasAtivas = (metas: Metas): Metas =>
  Object.fromEntries(
    Object.entries(metas).filter(([, meta]) => meta && (meta.verde.trim() || meta.vermelho.trim()))
  ) as Metas;

/**
 * Cores automáticas, usadas quando nenhuma meta foi preenchida: cada indicador é dividido
 * em terços entre os operadores do dia (sem contar os zeros). O terço melhor fica verde,
 * o do meio amarelo e o pior vermelho. Zero em leads, vendas, clientes e produção fica
 * vermelho; TMA, TMO e custo por CPF zerados ficam sem cor (não houve o que medir).
 */
export const metasAutomaticas = (linhas: LinhaRelatorio[]): Metas => {
  const indicadores: [ChaveIndicador, Meta['sentido']][] = [
    ['tma', 'menor'],
    ['tmo', 'menor'],
    ['leads', 'maior'],
    ['vendas', 'maior'],
    ['clientes', 'maior'],
    ['custo_cpf', 'menor'],
    ['prod_lead', 'maior'],
  ];
  const operadores = linhas.filter((l) => l.tipo === 'operador');
  const metas: Metas = {};

  for (const [chave, sentido] of indicadores) {
    const valores = operadores
      .map((l) => l[chave])
      .filter((v): v is number => typeof v === 'number' && v > 0)
      .sort((a, b) => a - b);
    if (valores.length < 3) continue;
    const tercil = (fracao: number) => valores[Math.min(valores.length - 1, Math.floor(fracao * valores.length))];
    const [baixo, alto] = [tercil(1 / 3), tercil(2 / 3)];
    if (baixo === alto) continue;
    // Texto no formato que valorDaMeta entende (sem separador de milhar)
    const texto = (v: number) => v.toFixed(2);
    metas[chave] =
      sentido === 'maior'
        ? { sentido, verde: texto(alto), vermelho: texto(baixo) }
        : { sentido, verde: texto(baixo), vermelho: texto(alto) };
  }
  return metas;
};
