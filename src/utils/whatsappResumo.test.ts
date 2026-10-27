import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { Cell, Workbook } from 'exceljs';
import { EstadoWhatsapp, MapaWhatsapp, Situacao } from '../types/whatsapp';
import { adicionarCelularNoMapa, alterarEstadoDaVaga, corDaCapinha, novoCelular } from './celulares';
import { alertas, resumoGeral } from './whatsappAlertas';
import { mapaInicial } from './whatsappBaias';
import { lerArquivoDoMapa } from './whatsappPlanilha';
import { gerarResumoWhatsapp, nomeDoResumoWhatsapp } from './whatsappResumo';

const AGORA = new Date('2026-10-27T10:00:00');
const antes = (horas: number) => new Date(AGORA.getTime() - horas * 3_600_000).toISOString();
const como = (situacao: Situacao, horas: number, extra: Partial<EstadoWhatsapp> = {}): EstadoWhatsapp => ({
  situacao,
  mudouEm: antes(horas),
  ...extra,
});

/** OP1 com nomes fictícios e várias situações, um Motorola Azul na OP1 e um Samsung Preto guardado */
const montar = (): MapaWhatsapp => {
  let mapa = mapaInicial(AGORA);
  const op1 = mapa.salas[0].mesas[0];
  op1.supervisor = 'JOANA';
  const nomes = ['ANA', 'BIA', 'CAIO', 'DUDA', 'EVA', 'FABIO', 'GABI', 'HUGO'];
  ['E1', 'E2', 'E3', 'E4', 'D1', 'D2', 'D3', 'D4'].forEach((p, i) => (op1.lugares[p].operador = nomes[i]));
  op1.lugares.E2.operador = '';
  op1.lugares.E1.whatsapp = como('BANIDO', 5);
  op1.lugares.D1.whatsapp = como('ANALISE', 26, { analisePedidaEm: antes(26) });
  op1.lugares.D3.whatsapp = como('PERMANENTE', 4);
  op1.lugares.E4.whatsapp = como('RESTRINGIDO', 2, { restritoAte: antes(-20) });
  const azul = novoCelular({ cor: 'Azul', hex: corDaCapinha('Azul'), apelido: '', marca: 'MOTOROLA', usuarios: 4, mesaId: op1.id }, mapa, AGORA);
  mapa = adicionarCelularNoMapa(mapa, azul, AGORA);
  const preto = novoCelular({ cor: 'Preto', hex: corDaCapinha('Preto'), apelido: 'Reserva', marca: 'SAMSUNG', usuarios: 1, mesaId: null }, mapa, AGORA);
  mapa = adicionarCelularNoMapa(mapa, preto, AGORA);
  return alterarEstadoDaVaga(mapa, preto.id, preto.vagas[0].id, como('BANIDO', 3), AGORA);
};

const gerar = async (mapa: MapaWhatsapp): Promise<{ livro: Workbook; buffer: ArrayBuffer }> => {
  const gerado = await gerarResumoWhatsapp(mapa, AGORA);
  const buffer = (await gerado.xlsx.writeBuffer()) as ArrayBuffer;
  const ExcelJS = (await import('exceljs')).default;
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(buffer);
  return { livro, buffer };
};

const textoDe = (c: Cell): string => {
  const v = c.value as any;
  if (v && typeof v === 'object' && Array.isArray(v.richText)) return v.richText.map((p: any) => p.text).join('');
  return v === null || v === undefined ? '' : String(v);
};

const celulas = (livro: Workbook, aba: string): Cell[] => {
  const lista: Cell[] = [];
  livro.getWorksheet(aba)!.eachRow((linha) => linha.eachCell((c) => lista.push(c)));
  return lista;
};

const achar = (livro: Workbook, aba: string, texto: string | RegExp): Cell => {
  const c = celulas(livro, aba).find((x) => (typeof texto === 'string' ? textoDe(x) === texto : texto.test(textoDe(x))));
  if (!c) throw new Error(`não achei "${texto}" na aba ${aba}`);
  return c;
};

describe('planilha nova', () => {
  const mapa = montar();

  it('nome do arquivo', () => {
    expect(nomeDoResumoWhatsapp(AGORA)).toBe('whatsapp_baias_2026-10-27.xlsx');
  });

  it('abas na ordem, dados oculta e sem linhas de grade', async () => {
    const { livro } = await gerar(mapa);
    expect(livro.worksheets.map((w) => w.name)).toEqual(['Painel', 'Mapa', 'Celulares', 'Lista', 'dados']);
    expect(livro.getWorksheet('dados')!.state).toBe('hidden');
    for (const aba of ['Painel', 'Mapa', 'Celulares', 'Lista']) expect(livro.getWorksheet(aba)!.views[0]?.showGridLines).toBe(false);
  });

  it('Painel: os 8 números são os do resumo', async () => {
    const { livro } = await gerar(mapa);
    const ws = livro.getWorksheet('Painel')!;
    const r = resumoGeral(mapa, AGORA);
    const numero = (rotulo: string) => {
      const c = achar(livro, 'Painel', rotulo);
      return ws.getCell(Number(c.row) - 1, Number(c.col)).value;
    };
    expect([
      numero('OK'),
      numero('Pedir análise'),
      numero('Em análise'),
      numero('Perdidos'),
      numero('Restringidos'),
      numero('Não tem'),
      numero('Vagas vazias'),
      numero('Celulares'),
    ]).toEqual([r.ok, r.banido, r.analise, r.permanente, r.restringido, r.naoTem, r.vagasVazias, r.celulares]);
  });

  it('Painel: a primeira linha de Atenção é o pedido de análise mais antigo', async () => {
    const { livro } = await gerar(mapa);
    const ws = livro.getWorksheet('Painel')!;
    const cabecalho = achar(livro, 'Painel', 'Onde');
    expect(textoDe(ws.getCell(Number(cabecalho.row) + 1, Number(cabecalho.col)))).toBe(alertas(mapa, AGORA)[0].onde);
    expect(alertas(mapa, AGORA)[0].onde).toBe('OP1-E1');
  });

  it('cores das situações', async () => {
    const { livro } = await gerar(mapa);
    const cor = (texto: RegExp) => achar(livro, 'Lista', texto).font?.color?.argb;
    expect(cor(/^BANIDO$/)).toBe('FFB42318');
    expect(cor(/^EM ANÁLISE$/)).toBe('FFC2410C');
    expect(cor(/^PERDIDO$/)).toBe('FF111827');
    expect(cor(/^OK$/)).toBe('FF1F7A4D');
    expect(cor(/^RESTRINGIDO$/)).toBe('FF9A6700');
  });

  it('Mapa: título da sala e a linha do celular de cada baia', async () => {
    const { livro } = await gerar(mapa);
    achar(livro, 'Mapa', 'Mapa · Comercial 1');
    achar(livro, 'Mapa', '📱 Azul · Proprietário · Messenger 1');
    achar(livro, 'Mapa', 'Vaga vazia');
  });

  it('Celulares: o guardado aparece "sem equipe"', async () => {
    const { livro } = await gerar(mapa);
    achar(livro, 'Celulares', /Samsung · sem equipe · 8/);
    achar(livro, 'Celulares', /Preto · Reserva/);
  });

  it('Lista: tabela do Excel com filtro e as colunas certas', async () => {
    const { livro } = await gerar(mapa);
    const tabelas = livro.getWorksheet('Lista')!.getTables() as any[];
    expect(tabelas).toHaveLength(1);
    const t = tabelas[0].table ?? tabelas[0];
    expect(t.autoFilterRef).toBeTruthy();
    expect(t.columns.map((c: any) => c.name)).toEqual([
      'Tipo', 'Sala', 'Equipe', 'Onde', 'Nome', 'Celular · vaga', 'Situação', 'Desde/Até', 'Número do chip',
    ]);
  });

  it('ida e volta: importar a planilha baixada devolve o mesmo mapa', async () => {
    const { buffer } = await gerar(mapa);
    expect(lerArquivoDoMapa(XLSX.read(buffer, { type: 'array' }), AGORA).mapa).toEqual(mapa);
  });
});
