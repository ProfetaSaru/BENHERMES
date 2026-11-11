import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Cell, Workbook } from 'exceljs';
import { LinhaRanking, RelatorioRanking } from '../../types/ranking';
import { gerarPlanilhaRanking, nomeDaPlanilhaRanking } from './planilha';

const TEMPLATE = readFileSync(new URL('../../../public/ranking/template_relatorio.xlsx', import.meta.url));
const buffer = () => TEMPLATE.buffer.slice(TEMPLATE.byteOffset, TEMPLATE.byteOffset + TEMPLATE.byteLength) as ArrayBuffer;

const linha = (posicao: string, nome: string, projetando: number, elegivel = false, feedback = ''): LinhaRanking => ({
  posicao,
  nome,
  portabilidade: 123456.78,
  projetando,
  potencial: 987.65,
  margemCartao: 2,
  andamento: 5000,
  projecao: 125956.78,
  elegivel,
  feedback,
});

const REL: RelatorioRanking = {
  dia: '2026-11-11',
  vendedores: [linha('1º', 'ANA   🏆', 1.05, true, 'Ana, siga firme no topo.'), linha('2º', 'BRUNO', 0.8), linha('3º', 'CARLA', 0.3)],
  supervisores: [linha('1º', 'EQUIPE A', 0.75), linha('2º', 'EQUIPE B', 0.1)],
  total: { portabilidade: 1, projetando: 0.5, potencial: 2, margemCartao: 3, andamento: 4, projecao: 5, elegiveis: 1 },
  metaCartao: 5,
  tituloVendedor: 'RANKING GERAL DE CONTRATOS PAGOS - VENDEDOR - DE 01/11/2026 A 11/11/2026',
  tituloSupervisor: 'RANKING GERAL DE CONTRATOS PAGOS - SUPERVISOR - DE 01/11/2026 A 11/11/2026',
  cabecalhoProjecao: 'PORT. PROJEÇÃO - 18/11/2026',
};

const carregar = async (livro: Workbook) => {
  const ExcelJS = (await import('exceljs')).default;
  const lido = new ExcelJS.Workbook();
  await lido.xlsx.load((await livro.xlsx.writeBuffer()) as ArrayBuffer);
  return lido.getWorksheet('RELATORIO')!;
};
const texto = (c: Cell) => (c.value === null || c.value === undefined ? '' : String(c.value));
const corDaFonte = (c: Cell) => (c.font?.color as any)?.argb;

describe('template', () => {
  it('não tem dados reais nas linhas de vendedores, supervisores e total', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(buffer());
    const ws = livro.getWorksheet('RELATORIO')!;
    for (const r of [2, ...Array.from({ length: 27 }, (_, i) => 4 + i), 32, 34, 35, 36, 37, 38, 39]) {
      for (let c = 2; c <= 11; c++) expect(texto(ws.getCell(r, c)), `linha ${r} coluna ${c}`).toBe('');
    }
  });
});

describe('planilha do ranking', () => {
  it('nome do arquivo', () => {
    expect(nomeDaPlanilhaRanking('2026-11-11')).toBe('ranking_2026-11-11.xlsx');
  });

  it('títulos, linhas na ordem da aba RELATORIO e total geral', async () => {
    const ws = await carregar(await gerarPlanilhaRanking(REL, buffer()));
    expect(texto(ws.getCell('B2'))).toBe(REL.tituloVendedor);
    expect(texto(ws.getCell('I3'))).toBe('PORT. PROJEÇÃO - 18/11/2026');
    expect([4, 5, 6].map((r) => texto(ws.getCell(r, 3)))).toEqual(['ANA   🏆', 'BRUNO', 'CARLA']);
    expect(texto(ws.getCell('B4'))).toBe('1º');
    expect(ws.getCell('D4').value).toBeCloseTo(123456.78, 2);
    expect(texto(ws.getCell('J4'))).toBe('SIM');
    expect(texto(ws.getCell('J5'))).toBe('NÃO');
    expect(texto(ws.getCell('K4'))).toBe('Ana, siga firme no topo.');
    // linha 7: separador; 8: título dos supervisores; 9: cabeçalho; 10-11: supervisores; 12: total
    expect(texto(ws.getCell('B8'))).toBe(REL.tituloSupervisor);
    expect(texto(ws.getCell('I9'))).toBe('PORT. PROJEÇÃO - 18/11/2026');
    expect([10, 11].map((r) => texto(ws.getCell(r, 3)))).toEqual(['EQUIPE A', 'EQUIPE B']);
    expect(texto(ws.getCell('C12'))).toBe('Total Geral');
    expect(ws.getCell('D12').value).toBe(1);
    expect(ws.getCell('J12').value).toBe(1);
  });

  it('cores do desempenho e do SIM/NÃO (paleta padrão do Excel)', async () => {
    const ws = await carregar(await gerarPlanilhaRanking(REL, buffer()));
    expect(corDaFonte(ws.getCell('C4'))).toBe('FF0000FF'); // ≥ 100%: azul
    expect(corDaFonte(ws.getCell('C5'))).toBe('FF00FF00'); // ≥ 70%: verde
    expect(corDaFonte(ws.getCell('C6'))).toBe('FF000000'); // abaixo: preto
    expect((ws.getCell('J4').fill as any).fgColor.argb).toBe('FF008000');
    expect((ws.getCell('J5').fill as any).fgColor.argb).toBe('FFFF0000');
  });

  it('legenda da meta de cartão e formatos', async () => {
    const ws = await carregar(await gerarPlanilhaRanking(REL, buffer()));
    const r = Array.from({ length: 40 }, (_, i) => i + 1).find((n) => texto(ws.getCell(n, 4)) === 'META PROVISÓRIA DE CARTÃO')!;
    expect(ws.getCell(r, 6).value).toBe(5);
    expect(ws.getCell(r, 8).value).toBe(10);
    expect(ws.getCell('D4').numFmt).toContain('R$');
    expect(ws.getCell('E4').numFmt).toBe('0%');
  });

  it('usa só os valores recebidos, sem recalcular (histórico reaberto — Review Focus 5)', async () => {
    const estranho = { ...REL, vendedores: [{ ...linha('7º', 'ZECA', 9.99), portabilidade: 1.23 }] };
    const ws = await carregar(await gerarPlanilhaRanking(estranho, buffer()));
    expect([texto(ws.getCell('B4')), texto(ws.getCell('C4'))]).toEqual(['7º', 'ZECA']);
    expect(ws.getCell('D4').value).toBe(1.23);
    expect(ws.getCell('E4').value).toBe(9.99);
  });
});
