import * as XLSX from 'xlsx';
import { ChaveIndicador, CorMeta, LinhaRelatorio, Metas, RegistroHistoricoUra, ResultadoUra, TipoLinha } from '../types/relatorioUra';
import { isoParaBr } from './calendario';
import { escaparCsv } from './csvTexto';
import { corDaMeta, metasAtivas } from './uraCalculo';
import { INDICADORES } from './uraLeitura';

/**
 * Saídas do Relatório da URA: planilha .xlsx, tabela colorida para colar no Excel ou
 * no e-mail, e o histórico em CSV (mesmo formato do historico/relatorio_ura.csv do BENZAITEN).
 */

type ChaveColuna = ChaveIndicador | 'd_leads' | 'd_vendas' | 'd_custo';
type Formato = 'tempo' | 'inteiro' | 'reais' | 'dif_inteiro' | 'dif_reais';

export interface ColunaRelatorio {
  titulo: string;
  chave: ChaveColuna;
  formato: Formato;
}

export const COLUNAS: ColunaRelatorio[] = [
  { titulo: 'TMA', chave: 'tma', formato: 'tempo' },
  { titulo: 'TMO', chave: 'tmo', formato: 'tempo' },
  { titulo: 'LEADS ATENDIDOS/URA', chave: 'leads', formato: 'inteiro' },
  { titulo: 'CUSTO TOTAL', chave: 'custo', formato: 'reais' },
  { titulo: 'VENDAS GERAL', chave: 'vendas', formato: 'reais' },
  { titulo: 'CLIENTE EFETIVADOS', chave: 'clientes', formato: 'inteiro' },
  { titulo: 'CUSTO POR CPF', chave: 'custo_cpf', formato: 'reais' },
  { titulo: 'PRODUÇÃO/LEAD', chave: 'prod_lead', formato: 'reais' },
];

/** Colunas de comparação (só quando há relatório anterior no histórico) */
export const colunasDoRelatorio = (dataAnterior: string | null): ColunaRelatorio[] => {
  if (!dataAnterior) return COLUNAS;
  const rotulo = isoParaBr(dataAnterior).slice(0, 5);
  return [
    ...COLUNAS,
    { titulo: `LEADS vs ${rotulo}`, chave: 'd_leads', formato: 'dif_inteiro' },
    { titulo: `VENDAS vs ${rotulo}`, chave: 'd_vendas', formato: 'dif_reais' },
    { titulo: `CUSTO vs ${rotulo}`, chave: 'd_custo', formato: 'dif_reais' },
  ];
};

/** Leads e vendas subindo é bom; custo subindo é ruim */
const SUBIR_E_BOM: Partial<Record<ChaveColuna, boolean>> = { d_leads: true, d_vendas: true, d_custo: false };

/** Formatos de número do Excel */
const FORMATOS_EXCEL: Record<Formato, string> = {
  tempo: '[h]:mm:ss',
  inteiro: '0',
  reais: '"R$ "#,##0.00',
  dif_inteiro: '"▲ "#,##0;"▼ "#,##0;"="',
  dif_reais: '"▲ R$ "#,##0.00;"▼ R$ "#,##0.00;"="',
};

/** Cores da empresa (as mesmas da planilha modelo) */
export const CORES = {
  azul: '#0B2A5B',
  amarelo: '#FFE600',
  branco: '#FFFFFF',
  cinzaEquipe: '#EDEDED',
  cinzaTotal: '#D9D9D9',
  zebra: '#F4F7FB',
  amareloClaro: '#FFF2CC',
  marrom: '#7F6000',
  verdeTexto: '#006100',
  vermelhoTexto: '#C00000',
};

/** Semáforo das metas (fundo, fonte), nas cores padrão do Excel */
export const SEMAFORO: Record<CorMeta, [string, string]> = {
  verde: ['#C6EFCE', '#006100'],
  amarelo: ['#FFEB9C', '#9C5700'],
  vermelho: ['#FFC7CE', '#9C0006'],
};

/** Estilo de cada tipo de linha: [fundo, fonte, negrito] */
export const ESTILOS: Record<TipoLinha, [string | null, string | null, boolean]> = {
  operador: [null, null, false],
  separador: [CORES.amarelo, null, false],
  equipe: [CORES.cinzaEquipe, null, true],
  total_operadores: [CORES.cinzaTotal, CORES.azul, true],
  sem_derivacao: [CORES.amareloClaro, CORES.marrom, false],
  total_geral: [CORES.azul, CORES.branco, true],
};

// ---------------------------------------------------------------------------
// Formatação para a tela
// ---------------------------------------------------------------------------

const reais = (valor: number): string =>
  `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const tempo = (segundos: number): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(segundos / 3600))}:${p(Math.floor((segundos % 3600) / 60))}:${p(Math.round(segundos % 60))}`;
};

/** Valor da célula como texto, igual ao que o Excel mostra */
export const textoDaCelula = (valor: number | null | undefined, formato: Formato): string => {
  if (valor === null || valor === undefined) return '';
  switch (formato) {
    case 'tempo':
      return tempo(valor);
    case 'inteiro':
      return valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    case 'reais':
      return reais(valor);
    case 'dif_inteiro':
      return valor === 0 ? '=' : `${valor > 0 ? '▲' : '▼'} ${Math.abs(valor).toLocaleString('pt-BR')}`;
    case 'dif_reais':
      return Math.abs(valor) < 0.005 ? '=' : `${valor > 0 ? '▲' : '▼'} ${reais(Math.abs(valor))}`;
  }
};

export interface EstiloCelula {
  fundo: string | null;
  fonte: string | null;
  negrito: boolean;
}

/**
 * Cores de uma célula: estilo da linha (com zebra), comparação (verde se melhorou)
 * e semáforo das metas (só nas linhas de operador).
 */
export const estiloDaCelula = (
  linha: LinhaRelatorio,
  indice: number,
  coluna: ColunaRelatorio | null,
  metas: Metas
): EstiloCelula => {
  let [fundo, fonte, negrito] = ESTILOS[linha.tipo];
  if (linha.tipo === 'operador' && indice % 2 === 1) fundo = CORES.zebra;
  if (!coluna) return { fundo, fonte, negrito };

  const valor = linha[coluna.chave];
  const subirEBom = SUBIR_E_BOM[coluna.chave];
  if (subirEBom !== undefined && valor && linha.tipo !== 'total_geral') {
    fonte = valor > 0 === subirEBom ? CORES.verdeTexto : CORES.vermelhoTexto;
  }
  if (linha.tipo === 'operador' && coluna.chave in metas) {
    const cor = corDaMeta(valor, coluna.chave as ChaveIndicador, metas[coluna.chave as ChaveIndicador]);
    if (cor) [fundo, fonte, negrito] = [...SEMAFORO[cor], true];
  }
  return { fundo, fonte, negrito };
};

// ---------------------------------------------------------------------------
// Planilha .xlsx
// ---------------------------------------------------------------------------

/**
 * Planilha com as abas Relatório e Conferência, no layout do BENZAITEN
 * (título em B2, cabeçalho na linha 3, valores com formato de hora e de reais).
 */
export const gerarPlanilhaUra = (resultado: ResultadoUra, metas: Metas): XLSX.WorkBook => {
  const colunas = colunasDoRelatorio(resultado.dataAnterior);
  const relatorio = XLSX.utils.aoa_to_sheet([
    [],
    ['', `RELATORIO DE PRODUTIVIDADE URA ${isoParaBr(resultado.data)}`],
    ['', 'OPERADORES', ...colunas.map((c) => c.titulo)],
  ]);

  resultado.linhas.forEach((linha, i) => {
    const r = 3 + i;
    XLSX.utils.sheet_add_aoa(relatorio, [[linha.nome]], { origin: { r, c: 1 } });
    colunas.forEach((coluna, j) => {
      const valor = linha[coluna.chave];
      if (valor === null || valor === undefined) return;
      // Tempos vão como fração do dia, que é como o Excel guarda horas
      const v = coluna.formato === 'tempo' ? valor / 86400 : valor;
      relatorio[XLSX.utils.encode_cell({ r, c: 2 + j })] = { t: 'n', v, z: FORMATOS_EXCEL[coluna.formato] };
    });
  });
  relatorio['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 3 + resultado.linhas.length, c: 2 + colunas.length } });
  relatorio['!merges'] = [{ s: { r: 1, c: 1 }, e: { r: 1, c: 1 + colunas.length } }];
  relatorio['!cols'] = [{ wch: 2 }, { wch: 44 }, ...colunas.map((c) => ({ wch: c.chave === 'leads' ? 19 : 15 })), { wch: 2 }];

  const metasUsadas = metasAtivas(metas);
  const linhasConferencia: unknown[][] = [
    [`Conferência do relatório de ${isoParaBr(resultado.data)}`],
    [],
    ['Arquivos lidos'],
    ...resultado.arquivos.map((a) => [a.nome, a.tipo, a.observacao]),
    [],
    ['Custos'],
    ['Custo importado da tarifação (sem linhas de total)', resultado.custoImportado],
    ['Custo no relatório (operadores + sem derivação)', resultado.custoNoRelatorio],
    ['Custo de quem está fora do cadastro (ignorado)', resultado.custoIgnorado],
    ['Diferença (importado - relatório - ignorado)', resultado.custoImportado - resultado.custoNoRelatorio - resultado.custoIgnorado],
    ['Custo dos robôs da URA (rateado pelos leads)', resultado.custoRobos],
    ['Ligações sem derivação p/ operador', resultado.semDerivacao],
    ['Vendas de agentes fora do cadastro (ignoradas)', resultado.vendasIgnoradas],
    [],
    ['Nomes sem vínculo (cadastre em Apelidos se for grafia diferente)'],
    ...Object.entries(resultado.semVinculo).sort().map(([nome, origens]) => [nome, origens.join(', ')]),
    [],
    ['Ex-colaboradores ignorados (inativos no Argus)'],
    ...Object.entries(resultado.exColaboradores).sort().map(([nome, origens]) => [nome, origens.join(', ')]),
    [],
    ['Metas aplicadas'],
    ...(Object.keys(metasUsadas).length === 0
      ? [['Nenhuma meta preenchida.']]
      : INDICADORES.filter((i) => metasUsadas[i.chave]).map((i) => {
          const meta = metasUsadas[i.chave]!;
          return [i.titulo, `melhor quando ${meta.sentido}`, `verde: ${meta.verde || '-'} | vermelho: ${meta.vermelho || '-'}`];
        })),
    [],
    ['Avisos'],
    ...resultado.avisos.map((a) => [a]),
  ];
  const conferencia = XLSX.utils.aoa_to_sheet(linhasConferencia);
  linhasConferencia.forEach((linha, r) => {
    if (typeof linha[1] === 'number') {
      const celula = conferencia[XLSX.utils.encode_cell({ r, c: 1 })];
      celula.v = Math.round(celula.v * 100) / 100;
      celula.z = FORMATOS_EXCEL.reais;
    }
  });
  conferencia['!cols'] = [{ wch: 55 }, { wch: 40 }, { wch: 40 }];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, relatorio, 'Relatório');
  XLSX.utils.book_append_sheet(livro, conferencia, 'Conferência');
  return livro;
};

// ---------------------------------------------------------------------------
// Tabela colorida para colar no Excel, no e-mail ou no chat
// ---------------------------------------------------------------------------

const escaparHtml = (texto: string): string =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const estiloHtml = ({ fundo, fonte, negrito }: EstiloCelula, extra = ''): string =>
  [
    'border:1px solid #BFBFBF',
    'padding:4px 8px',
    'font-family:Calibri,Arial,sans-serif',
    'font-size:11pt',
    fundo ? `background:${fundo}` : '',
    fonte ? `color:${fonte}` : '',
    negrito ? 'font-weight:bold' : '',
    extra,
  ]
    .filter(Boolean)
    .join(';');

/** HTML do relatório com as cores da planilha modelo (o Excel e o Outlook mantêm as cores ao colar) */
export const htmlDoRelatorio = (resultado: ResultadoUra, metas: Metas): string => {
  const colunas = colunasDoRelatorio(resultado.dataAnterior);
  const cabecalho = { fundo: CORES.azul, fonte: CORES.branco, negrito: true };
  const linhas = resultado.linhas.map((linha, i) => {
    const celulas = [
      `<td style="${estiloHtml(estiloDaCelula(linha, i, null, metas))}">${escaparHtml(linha.nome)}</td>`,
      ...colunas.map(
        (c) =>
          `<td style="${estiloHtml(estiloDaCelula(linha, i, c, metas), 'text-align:right')}">${escaparHtml(textoDaCelula(linha[c.chave], c.formato))}</td>`
      ),
    ];
    return `<tr>${celulas.join('')}</tr>`;
  });

  return [
    '<table style="border-collapse:collapse">',
    `<tr><td colspan="${colunas.length + 1}" style="${estiloHtml({ fundo: null, fonte: CORES.azul, negrito: true }, 'font-size:14pt;text-align:center')}">RELATORIO DE PRODUTIVIDADE URA ${isoParaBr(resultado.data)}</td></tr>`,
    `<tr>${['OPERADORES', ...colunas.map((c) => c.titulo)].map((t) => `<th style="${estiloHtml(cabecalho, 'text-align:center')}">${escaparHtml(t)}</th>`).join('')}</tr>`,
    ...linhas,
    '</table>',
  ].join('');
};

/** Mesmo conteúdo em texto, separado por tabulação (cola em colunas no Excel) */
export const textoDoRelatorio = (resultado: ResultadoUra): string => {
  const colunas = colunasDoRelatorio(resultado.dataAnterior);
  return [
    ['OPERADORES', ...colunas.map((c) => c.titulo)],
    ...resultado.linhas.map((l) => [l.nome, ...colunas.map((c) => textoDaCelula(l[c.chave], c.formato))]),
  ]
    .map((linha) => linha.join('\t'))
    .join('\n');
};

// ---------------------------------------------------------------------------
// Histórico em CSV
// ---------------------------------------------------------------------------

const numeroBr = (valor: number): string => valor.toFixed(2).replace('.', ',');

/** Mesmo formato do historico/relatorio_ura.csv do BENZAITEN */
export const historicoUraParaCsv = (historico: RegistroHistoricoUra[]): string => {
  const linhas = historico.map((r) =>
    [isoParaBr(r.data), r.tipo, r.nome, r.tma, r.tmo, r.leads, numeroBr(r.custo), numeroBr(r.vendas), r.clientes]
      .map((v) => escaparCsv(String(v)))
      .join(';')
  );
  return ['Data;Tipo;Nome;TMA (s);TMO (s);Leads;Custo;Vendas;Clientes', ...linhas].join('\r\n');
};
