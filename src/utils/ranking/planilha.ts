import type { Style, Workbook, Worksheet } from 'exceljs';
import { LinhaRanking, RelatorioRanking } from '../../types/ranking';

/**
 * Planilha do ranking com o MESMO visual da aba RELATORIO da planilha original (porte do excel.py).
 * O template (public/ranking/template_relatorio.xlsx) é a aba original sem os dados: aqui o estilo de
 * cada "tipo de linha" é lido do modelo e carimbado nas linhas novas, como a macro fazia.
 */

const NCOLS = 12; // A..L

// Linhas-modelo dentro do template (posição na planilha original)
const MODELO = {
  topo: 1,
  titulo: 2,
  cabecalho: 3,
  vendedor: 4,
  separador: 31,
  titulo_sup: 32,
  cabecalho_sup: 33,
  supervisor: 34,
  total: 39,
  azul1: 40,
  azul2: 41,
  leg_titulo: 42,
  leg_1: 43,
  leg_2: 44,
  leg_3: 45,
  leg_cartao: 46,
  azul3: 47,
  azul4: 48,
  rodape: 49,
  vazia: 60,
} as const;
type TipoDeLinha = keyof typeof MODELO;

// Cores da macro (ColorIndex do VBA) na paleta padrão do Excel: 12 azul, 11 verde, 8 preto; fundo 17 e 10
const AZUL = 'FF0000FF';
const VERDE = 'FF00FF00';
const PRETO = 'FF000000';
const FUNDO_SIM = 'FF008000';
const FUNDO_NAO = 'FFFF0000';

interface Modelo {
  altura: number | undefined;
  celulas: { estilo: Partial<Style>; valor: unknown }[];
}

const copiar = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

const instantaneo = (ws: Worksheet): Record<TipoDeLinha, Modelo> =>
  Object.fromEntries(
    (Object.keys(MODELO) as TipoDeLinha[]).map((tipo) => {
      const r = MODELO[tipo];
      return [
        tipo,
        {
          altura: ws.getRow(r).height,
          celulas: Array.from({ length: NCOLS }, (_, i) => {
            const c = ws.getCell(r, i + 1);
            return { estilo: copiar(c.style), valor: c.value };
          }),
        },
      ];
    })
  ) as Record<TipoDeLinha, Modelo>;

const carimbar = (ws: Worksheet, modelos: Record<TipoDeLinha, Modelo>, tipo: TipoDeLinha, linha: number, valores = true) => {
  const m = modelos[tipo];
  ws.getRow(linha).height = m.altura as number;
  m.celulas.forEach(({ estilo, valor }, i) => {
    const c = ws.getCell(linha, i + 1);
    c.style = copiar(estilo) as Style;
    c.value = valores ? (valor as any) : null;
  });
};

const corDoDesempenho = (p: number) => (p >= 1 ? AZUL : p >= 0.7 ? VERDE : PRETO);

const escreverLinha = (ws: Worksheet, modelos: Record<TipoDeLinha, Modelo>, tipo: TipoDeLinha, r: number, l: LinhaRanking) => {
  carimbar(ws, modelos, tipo, r, false);
  const valores = [l.posicao, l.nome, l.portabilidade, l.projetando, l.potencial, l.margemCartao, l.andamento, l.projecao, l.elegivel ? 'SIM' : 'NÃO', l.feedback || null];
  const cor = corDoDesempenho(l.projetando);
  valores.forEach((v, i) => {
    const c = ws.getCell(r, i + 2);
    c.value = v as any;
    // A coluna J (ELEGÍVEL) tem fonte branca própria
    if (i + 2 !== 10) c.font = { ...c.font, color: { argb: cor } };
  });
  ws.getCell(r, 10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: l.elegivel ? FUNDO_SIM : FUNDO_NAO } };
};

export const nomeDaPlanilhaRanking = (dia: string): string => `ranking_${dia}.xlsx`;

/** O template limpo, servido pelo próprio BenHermes */
export const carregarTemplateRanking = async (): Promise<ArrayBuffer> => {
  const resposta = await fetch('/ranking/template_relatorio.xlsx');
  if (!resposta.ok) throw new Error('Não encontrei o modelo da planilha do ranking.');
  return resposta.arrayBuffer();
};

export const gerarPlanilhaRanking = async (rel: RelatorioRanking, template: ArrayBuffer): Promise<Workbook> => {
  const ExcelJS = (await import('exceljs')).default;
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(template);
  const ws = livro.getWorksheet('RELATORIO')!;
  const ultimaOriginal = ws.rowCount;
  for (const faixa of [...((ws.model as any).merges ?? [])] as string[]) ws.unMergeCells(faixa);
  const modelos = instantaneo(ws);

  let r = 1;
  carimbar(ws, modelos, 'topo', r++);
  carimbar(ws, modelos, 'titulo', r, false);
  ws.getCell(r, 2).value = rel.tituloVendedor;
  ws.mergeCells(r, 2, r, 11);
  r++;
  carimbar(ws, modelos, 'cabecalho', r);
  ws.getCell(r, 9).value = rel.cabecalhoProjecao;
  r++;

  for (const l of rel.vendedores) escreverLinha(ws, modelos, 'vendedor', r++, l);

  carimbar(ws, modelos, 'separador', r++);
  carimbar(ws, modelos, 'titulo_sup', r, false);
  ws.getCell(r, 2).value = rel.tituloSupervisor;
  ws.mergeCells(r, 2, r, 11);
  r++;
  carimbar(ws, modelos, 'cabecalho_sup', r);
  ws.getCell(r, 9).value = rel.cabecalhoProjecao;
  r++;

  for (const l of rel.supervisores) escreverLinha(ws, modelos, 'supervisor', r++, l);

  const t = rel.total;
  carimbar(ws, modelos, 'total', r, false);
  ['-', 'Total Geral', t.portabilidade, t.projetando, t.potencial, t.margemCartao, t.andamento, t.projecao, t.elegiveis].forEach(
    (v, i) => (ws.getCell(r, i + 2).value = v)
  );
  r++;

  for (const tipo of ['azul1', 'azul2'] as const) carimbar(ws, modelos, tipo, r++);

  carimbar(ws, modelos, 'leg_titulo', r);
  ws.mergeCells(r, 4, r, 10);
  r++;
  for (const tipo of ['leg_1', 'leg_2', 'leg_3'] as const) {
    carimbar(ws, modelos, tipo, r);
    ws.mergeCells(r, 4, r, 5);
    ws.mergeCells(r, 6, r, 10);
    r++;
  }
  carimbar(ws, modelos, 'leg_cartao', r);
  ws.getCell(r, 6).value = rel.metaCartao;
  ws.getCell(r, 8).value = rel.metaCartao * 2;
  ws.mergeCells(r, 4, r, 5);
  ws.mergeCells(r, 9, r, 10);
  r++;

  for (const tipo of ['azul3', 'azul4', 'rodape'] as const) carimbar(ws, modelos, tipo, r++);
  for (let linha = r; linha <= Math.max(ultimaOriginal, r + 60); linha++) carimbar(ws, modelos, 'vazia', linha, false);

  return livro;
};
