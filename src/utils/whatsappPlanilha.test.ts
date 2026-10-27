import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { Cell, Workbook } from 'exceljs';
import { MapaWhatsapp } from '../types/whatsapp';
import {
  gerarPlanilhaWhatsapp,
  gradeDaPlanilha,
  importarPlanilhaWhatsapp,
  lerSituacao,
  nomeDaPlanilhaWhatsapp,
} from './whatsappPlanilha';

const AGORA = new Date('2026-10-27T10:00:00');

/** Grade no layout da planilha RELATORIO-WHATSAPP-INTUITIVO (nomes fictícios) */
const montarGrade = (celulas: Record<string, string>): string[][] => {
  const grade = Array.from({ length: 90 }, () => Array.from({ length: 16 }, () => ''));
  for (const [endereco, valor] of Object.entries(celulas)) {
    const { r, c } = XLSX.utils.decode_cell(endereco);
    grade[r][c] = valor;
  }
  return grade;
};

const bloco = (col: string, linha: number, titulo: string, linhas: string[][], rodape: string[] | null) => {
  const c = XLSX.utils.decode_col(col);
  const cel = (dc: number, l: number) => `${XLSX.utils.encode_col(c + dc)}${l}`;
  const out: Record<string, string> = { [cel(0, linha)]: titulo };
  ['OPERADOR ', 'WHATSAPP', 'OPERADOR', 'WHATSAPP'].forEach((t, i) => (out[cel(i, linha + 1)] = t));
  linhas.forEach((valores, i) => valores.forEach((v, j) => (out[cel(j, linha + 2 + i)] = v)));
  if (rodape) rodape.forEach((v, j) => (out[cel(j, linha + 2 + linhas.length)] = v));
  return out;
};

const PLANILHA = montarGrade({
  E34: 'STATUS DOS WHATSAPP DO COMERCIAL 1 ',
  ...bloco('E', 35, '1º EQUIPE - Joana Sousa', [
    [' ANA ALVES', 'OK', 'BRUNO BRITO', 'BANIDO'],
    ['VAZIO', 'OK', 'CARLA CRUZ', 'NAO TEM'],
    ['DIEGO DIAS', 'Ok', 'ELISA ESTEVES', 'não tem'],
    ['FABIO FARIAS', 'RESTRINGIDO ATÉ 29/10 14:00', 'GABI GOMES', 'OK'],
  ], ['SUPERVISOR ', 'OK', 'BACKUP', 'NÃO TEM']),
  ...bloco('K', 35, '2° EQUIPE - Fulano de Tal', [
    ['HUGO HORTA', 'OK', 'IARA IBIS', 'OK'],
    ['JOAO JUNIOR', 'OK', 'VAZIO', 'BANIDO'],
    ['KAUE KLEIN', 'OK', 'LARA LIMA', 'OK'],
    ['MARIA MELO', 'OK', 'NINA NUNES', 'OK'],
  ], ['SUPERVISOR', 'BANIDO', '', '']),
  E63: 'STATUS DOS WHATSAPP DO COMERCIAL 2',
  ...bloco('E', 64, '6º EQUIPE - Digital', [
    ['OTAVIO OLIVEIRA', 'BANIDO', 'PAULA PIRES', 'OK'],
    ['QUEILA QUEIROZ', 'TALVEZ', 'RUI RAMOS', 'OK'],
  ], ['SUPERVISOR ', 'OK', 'BACKUP', 'OK']),
  ...bloco('K', 64, '7º EQUIPE - (SEGUNDA ESPINHA AO CHEGAR NO COMERCIAL)VAZIA', [
    ['VAZIO', 'BANIDO', 'VAZIO', 'BANIDO'],
  ], ['SUPERVISOR ', 'BANIDO', 'BACKUP', 'BANIDO']),
  E74: 'WHATSAPP DOS CELULARES CORPORATIVOS ',
  E75: 'CELULAR', F75: 'MENSSENGER', G75: 'CELULAR', H75: 'BUSINESS',
  E76: 'VERDE', F76: 'OK', G76: 'VERDE', H76: 'OK',
  E77: 'AZUL', F77: 'BANIDO', G77: 'AZUL', H77: 'OK',
  E78: 'DOURADO', F78: 'OK', G78: 'DOURADO', H78: 'NÃO TEM',
});

describe('situação escrita na planilha', () => {
  it('aceita variações de acento, maiúsculas e espaços', () => {
    expect(lerSituacao(' ok ', AGORA)).toEqual({ situacao: 'OK' });
    expect(lerSituacao('Banido', AGORA)).toEqual({ situacao: 'BANIDO' });
    expect(lerSituacao('NAO  TEM', AGORA)).toEqual({ situacao: 'NAO_TEM' });
    expect(lerSituacao('não tem', AGORA)).toEqual({ situacao: 'NAO_TEM' });
    expect(lerSituacao('RESTRINGIDO', AGORA)).toEqual({ situacao: 'RESTRINGIDO' });
    expect(lerSituacao('RESTRINGIDO ATÉ 29/10 14:00', AGORA)).toEqual({
      situacao: 'RESTRINGIDO',
      restritoAte: new Date('2026-10-29T14:00:00'),
    });
    expect(lerSituacao('TALVEZ', AGORA)).toBeNull();
    expect(lerSituacao('', AGORA)).toBeNull();
  });
});

describe('importar a planilha de status dos WhatsApps', () => {
  const { mapa, avisos } = importarPlanilhaWhatsapp(PLANILHA, AGORA);
  const [c1, c2] = mapa.salas;

  it('salas e equipes na ordem da planilha', () => {
    expect(mapa.salas.map((s) => s.nome)).toEqual(['Comercial 1', 'Comercial 2']);
    expect(c1.mesas.map((m) => m.sigla)).toEqual(['OP1', 'OP2']);
    expect(c2.mesas.map((m) => m.sigla)).toEqual(['DG', 'OP7']);
  });

  it('equipe com supervisor e backup', () => {
    const m = c1.mesas[0];
    expect(m).toMatchObject({ nome: '1º Equipe', supervisor: 'Joana Sousa', esq: 4, dir: 4, centro: 'SUPSUB', inicio: 'sup' });
    expect(m.lugares.E1.operador).toBe('ANA ALVES');
    expect(m.lugares.E2.operador).toBe('');
    expect(m.lugares.D1).toMatchObject({ operador: 'BRUNO BRITO', whatsapp: { situacao: 'BANIDO', mudouEm: AGORA.toISOString() } });
    expect(m.lugares.D2.whatsapp.situacao).toBe('NAO_TEM');
    expect(m.lugares.E3.whatsapp.situacao).toBe('OK');
    expect(m.lugares.E4.whatsapp).toMatchObject({ situacao: 'RESTRINGIDO', restritoAte: new Date('2026-10-29T14:00:00').toISOString() });
    expect(m.lugares.SUP).toMatchObject({ operador: '', whatsapp: { situacao: 'OK' } });
    expect(m.lugares.SUB.whatsapp.situacao).toBe('NAO_TEM');
  });

  it('equipe sem backup e com "2°"', () => {
    const m = c1.mesas[1];
    expect(m).toMatchObject({ nome: '2º Equipe', supervisor: 'Fulano de Tal', centro: 'SUP' });
    expect(m.lugares.SUB).toBeUndefined();
    expect(m.lugares.SUP.whatsapp.situacao).toBe('BANIDO');
    expect(m.lugares.D2).toMatchObject({ operador: '', whatsapp: { situacao: 'BANIDO' } });
  });

  it('Digital e a segunda espinha', () => {
    expect(c2.mesas[0]).toMatchObject({ nome: 'Digital', sigla: 'DG', supervisor: '', esq: 2, dir: 2 });
    expect(c2.mesas[1]).toMatchObject({
      nome: '7º Equipe (segunda espinha ao chegar no comercial)',
      sigla: 'OP7',
      supervisor: '',
      esq: 1,
      dir: 1,
    });
  });

  it('situação desconhecida vira NÃO TEM com aviso', () => {
    expect(c2.mesas[0].lugares.E2.whatsapp.situacao).toBe('NAO_TEM');
    expect(avisos.join(' ')).toContain('TALVEZ');
    expect(avisos.join(' ')).toContain('DG-E2');
  });

  it('celulares corporativos', () => {
    expect(mapa.celulares.map((c) => [c.cor, c.hex, c.messenger.situacao, c.business.situacao])).toEqual([
      ['VERDE', '#00B050', 'OK', 'OK'],
      ['AZUL', '#00B0F0', 'BANIDO', 'OK'],
      ['DOURADO', '#808080', 'OK', 'NAO_TEM'],
    ]);
  });

  it('número de equipe repetido ganha letra na sigla', () => {
    const repetida = montarGrade({
      E34: 'STATUS DOS WHATSAPP DO COMERCIAL 1',
      ...bloco('E', 35, '6º EQUIPE - Ana', [['X', 'OK', 'Y', 'OK']], ['SUPERVISOR', 'OK', 'BACKUP', 'OK']),
      ...bloco('K', 35, '6º EQUIPE - Bia', [['Z', 'OK', 'W', 'OK']], ['SUPERVISOR', 'OK', 'BACKUP', 'OK']),
    });
    expect(importarPlanilhaWhatsapp(repetida, AGORA).mapa.salas[0].mesas.map((m) => m.sigla)).toEqual(['OP6', 'OP6B']);
  });

  it('título sem número: reconhecido pela linha OPERADOR / WHATSAPP logo abaixo', () => {
    const sem = montarGrade({
      E34: 'STATUS DOS WHATSAPP DO COMERCIAL 2',
      ...bloco('E', 35, 'DIGITAL', [['X', 'OK', 'Y', 'OK']], ['SUPERVISOR', 'OK', 'BACKUP', 'OK']),
      ...bloco('K', 35, 'PLANTÃO - Joana Sousa', [['Z', 'BANIDO', 'W', 'OK']], ['SUPERVISOR', 'OK', '', '']),
    });
    const [digital, plantao] = importarPlanilhaWhatsapp(sem, AGORA).mapa.salas[0].mesas;
    expect(digital).toMatchObject({ nome: 'Digital', sigla: 'DG', supervisor: '' });
    expect(plantao).toMatchObject({ nome: 'Plantão', sigla: 'PLA', supervisor: 'Joana Sousa', centro: 'SUP' });
    expect(plantao.lugares.E1.whatsapp.situacao).toBe('BANIDO');
  });

  it('planilha sem equipes é recusada', () => {
    expect(() => importarPlanilhaWhatsapp(montarGrade({ A1: 'qualquer coisa' }), AGORA)).toThrow(
      'Não encontrei nenhuma equipe ("Nº EQUIPE - ...") na planilha.'
    );
  });
});

describe('leitura do arquivo', () => {
  it('posições absolutas mesmo quando a planilha começa em D14', () => {
    const aba = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.sheet_add_aoa(aba, [[''], ['STATUS DOS WHATSAPP DO COMERCIAL 1']], { origin: 'E33' });
    aba['!ref'] = 'D14:Q84';
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, aba, 'Planilha1');
    const lido = XLSX.read(XLSX.write(livro, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
    expect(gradeDaPlanilha(lido)[33][4]).toBe('STATUS DOS WHATSAPP DO COMERCIAL 1');
  });
});

describe('planilha de resumo', () => {
  const { mapa } = importarPlanilhaWhatsapp(PLANILHA, AGORA);

  const gerar = async (): Promise<{ livro: Workbook; buffer: ArrayBuffer }> => {
    const gerado = await gerarPlanilhaWhatsapp(mapa, AGORA);
    const buffer = (await gerado.xlsx.writeBuffer()) as ArrayBuffer;
    const ExcelJS = (await import('exceljs')).default;
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(buffer);
    return { livro, buffer };
  };

  const celulas = (livro: Workbook): Cell[] => {
    const lista: Cell[] = [];
    livro.worksheets[0].eachRow((linha) => linha.eachCell((c) => lista.push(c)));
    return lista;
  };
  const achar = (livro: Workbook, texto: string): Cell => {
    const c = celulas(livro).find((x) => x.value === texto);
    if (!c) throw new Error(`não achei "${texto}"`);
    return c;
  };
  const corDaFonte = (c: Cell) => c.font?.color?.argb;

  it('nome do arquivo com a data', () => {
    expect(nomeDaPlanilhaWhatsapp(AGORA)).toBe('relatorio_whatsapp_2026-10-27.xlsx');
  });

  it('títulos das salas e das equipes', async () => {
    const { livro } = await gerar();
    const titulo = achar(livro, 'STATUS DOS WHATSAPP DO COMERCIAL 1 — 27/10/2026 10:00');
    expect((titulo.fill as any).fgColor.argb).toBe('FFFFFF00');
    expect(titulo.font).toMatchObject({ size: 36, bold: true });
    expect(achar(livro, '1º EQUIPE - Joana Sousa').font).toMatchObject({ name: 'Arial', size: 20, bold: true });
    achar(livro, 'DIGITAL');
    achar(livro, '7º EQUIPE - (SEGUNDA ESPINHA AO CHEGAR NO COMERCIAL)');
    expect(livro.worksheets[0].getColumn('E').width).toBe(61);
  });

  it('situação longa encolhe para caber na coluna', async () => {
    const { livro } = await gerar();
    expect(achar(livro, 'RESTRINGIDO ATÉ 29/10 14:00').alignment).toMatchObject({ shrinkToFit: true });
  });

  it('cores de cada situação e da vaga vazia', async () => {
    const { livro } = await gerar();
    expect(corDaFonte(achar(livro, 'BANIDO'))).toBe('FFFF0000');
    expect(corDaFonte(achar(livro, 'OK'))).toBe('FF70AD47');
    expect(corDaFonte(achar(livro, 'NÃO TEM'))).toBe('FF808080');
    expect(corDaFonte(achar(livro, 'RESTRINGIDO ATÉ 29/10 14:00'))).toBe('FFBF8F00');
    expect(corDaFonte(achar(livro, 'VAZIO'))).toBe('FFFFD966');
    expect(corDaFonte(achar(livro, 'ANA ALVES'))).toBe('FF0070C0');
  });

  it('ida e volta: importar a planilha gerada devolve o mesmo mapa', async () => {
    const { buffer } = await gerar();
    const relido = importarPlanilhaWhatsapp(gradeDaPlanilha(XLSX.read(buffer, { type: 'array' })), AGORA).mapa;
    const semIds = (m: MapaWhatsapp) =>
      JSON.parse(JSON.stringify(m, (chave, valor) => (chave === 'id' ? undefined : valor)));
    expect(semIds(relido)).toEqual(semIds(mapa));
  });
});
