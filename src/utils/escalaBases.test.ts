import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { EscalaRegistro } from '../types/escala';
import {
  csvParaHistorico,
  historicoParaCsv,
  importarPlanilhaEscala,
  mesclarHistorico,
  realizarSorteio,
  registrarSorteio,
  rodizio,
} from './escalaBases';

// Mesmos casos do tests/test_escala_bases.py do BENZAITEN (nomes fictícios)
const NOTAS = ['INSS - LOTE - 1 - NOTA 0', 'INSS - LOTE - 1 - NOTA 1', 'INSS - LOTE - 1 - NOTA 2', 'INSS - LOTE - 1 - NOTA 3'];
const PESSOAS = ['ANA', 'BRUNO', 'CARLA', 'DIEGO'];

const dia = (data: string, nomes: string[], bases = NOTAS): EscalaRegistro[] =>
  nomes.map((responsavel, i) => ({ data, base: bases[i], responsavel }));
const nomesDe = (atribuicoes: { responsavel: string }[]) => atribuicoes.map((a) => a.responsavel);

// O caso que motivou o rodízio: a mesma pessoa na NOTA 0 nos dias 19 e 21
const CASO_REAL = [
  ...dia('2026-10-16', ['BRUNO', 'DIEGO', 'CARLA', 'ANA']),
  ...dia('2026-10-19', ['ANA', 'BRUNO', 'DIEGO', 'CARLA']),
  ...dia('2026-10-20', ['DIEGO', 'CARLA', 'ANA', 'BRUNO']),
  ...dia('2026-10-21', ['ANA', 'BRUNO', 'CARLA', 'DIEGO']),
];

const diaSeguinte = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

describe('rodízio da escala', () => {
  it('cada pessoa anda uma base para frente', () => {
    const { atribuicoes, avisos } = rodizio(NOTAS, PESSOAS, CASO_REAL, '2026-10-22');
    expect(nomesDe(atribuicoes)).toEqual(['DIEGO', 'ANA', 'BRUNO', 'CARLA']);
    expect(avisos).toEqual([]);
  });

  it('ninguém repete base antes de passar por todas', () => {
    let historico = [...CASO_REAL];
    let data = '2026-10-22';
    const vistas: Record<string, string[]> = Object.fromEntries(PESSOAS.map((p) => [p, []]));
    for (let i = 0; i < 8; i++) {
      const { atribuicoes } = rodizio(NOTAS, PESSOAS, historico, data);
      atribuicoes.forEach((a) => vistas[a.responsavel].push(a.base));
      historico = [...historico, ...atribuicoes.map((a) => ({ data, ...a }))];
      data = diaSeguinte(data);
    }
    for (const sequencia of Object.values(vistas)) {
      expect([...sequencia.slice(0, 4)].sort()).toEqual(NOTAS);
      expect(sequencia.slice(4)).toEqual(sequencia.slice(0, 4));
    }
  });

  it('conta sorteios, não dias do calendário (sexta -> segunda é um passo)', () => {
    const sexta = dia('2026-10-16', PESSOAS);
    expect(nomesDe(rodizio(NOTAS, PESSOAS, sexta, '2026-10-19').atribuicoes)).toEqual(['DIEGO', 'ANA', 'BRUNO', 'CARLA']);
  });

  it('sem histórico começa pela ordem do cadastro', () => {
    expect(nomesDe(rodizio(NOTAS, PESSOAS, [], '2026-10-20').atribuicoes)).toEqual(PESSOAS);
  });

  it('ausente: a base vai para quem não a teve ontem, e a pessoa retoma a posição', () => {
    const faltou = rodizio(NOTAS, PESSOAS, CASO_REAL, '2026-10-22', ['ana']);
    expect(nomesDe(faltou.atribuicoes)).not.toContain('ANA');
    expect(faltou.atribuicoes[1].responsavel).not.toBe('BRUNO'); // BRUNO teve a NOTA 1 em 21/10
    expect(faltou.avisos[0]).toContain('ANA está ausente');

    const historico = [...CASO_REAL, ...faltou.atribuicoes.map((a) => ({ data: '2026-10-22', ...a }))];
    expect(nomesDe(rodizio(NOTAS, PESSOAS, historico, '2026-10-23').atribuicoes)).toEqual(['CARLA', 'DIEGO', 'ANA', 'BRUNO']);
  });

  it('pessoa nova entra no fim da roda', () => {
    expect(nomesDe(rodizio(NOTAS, [...PESSOAS, 'ELISA'], CASO_REAL, '2026-10-22').atribuicoes)).toEqual([
      'ELISA',
      'ANA',
      'BRUNO',
      'CARLA',
    ]);
  });

  it('menos pessoas que bases: diferença máxima de uma base', () => {
    const contagem: Record<string, number> = {};
    rodizio(NOTAS, ['ANA', 'BRUNO', 'CARLA'], [], '2026-10-20').atribuicoes.forEach(
      (a) => (contagem[a.responsavel] = (contagem[a.responsavel] ?? 0) + 1)
    );
    expect(Math.max(...Object.values(contagem)) - Math.min(...Object.values(contagem))).toBeLessThanOrEqual(1);
  });

  it('sem bases ou com todos ausentes dá erro', () => {
    expect(() => rodizio([], PESSOAS, [], '2026-10-20')).toThrow();
    expect(() => rodizio(NOTAS, PESSOAS, [], '2026-10-20', PESSOAS)).toThrow();
  });

  it('avisa feriado nacional e feriado local cadastrado', () => {
    const cadastro = { bases: NOTAS, pessoas: PESSOAS };
    expect(realizarSorteio(cadastro, [], '2026-04-03', []).avisos.join()).toContain('Sexta-feira Santa');
    const local = realizarSorteio(cadastro, [], '2026-02-17', [], [{ data: '2026-02-17', descricao: 'Carnaval' }]);
    expect(local.avisos.join()).toContain('Carnaval');
  });

  it('refazer o mesmo dia substitui sem duplicar', () => {
    const r = realizarSorteio({ bases: NOTAS, pessoas: PESSOAS }, CASO_REAL, '2026-10-21', []);
    expect(registrarSorteio(CASO_REAL, r).filter((x) => x.data === '2026-10-21')).toHaveLength(4);
  });
});

describe('histórico e importação da escala', () => {
  it('CSV no formato do BENZAITEN, ida e volta', () => {
    const csv = historicoParaCsv(CASO_REAL);
    expect(csv.split('\r\n')[0]).toBe('Data;Base;Responsavel');
    expect(csvParaHistorico('﻿' + csv)).toEqual(CASO_REAL);
  });

  it('importar não sobrescreve dias que já existem', () => {
    const { historico, diasNovos } = mesclarHistorico(dia('2026-10-21', ['ZÉ', 'ZÉ', 'ZÉ', 'ZÉ']), CASO_REAL);
    expect(diasNovos).toBe(3);
    expect(historico.find((r) => r.data === '2026-10-21')?.responsavel).toBe('ZÉ');
  });

  it('lê a planilha antiga Escala_Bases_Ativo2.xlsm (cadastro e histórico)', () => {
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      livro,
      XLSX.utils.aoa_to_sheet([['CADASTRO'], [], [], ['Base', '', 'Pessoa'], ['BASE A', '', 'ANA'], ['BASE B', '', 'BRUNO'], [' BASE A ', '', 'ana']]),
      'Cadastro'
    );
    const serial = (Date.UTC(2026, 9, 20) - Date.UTC(1899, 11, 30)) / 86400000;
    XLSX.utils.book_append_sheet(
      livro,
      XLSX.utils.aoa_to_sheet([['ESCALA'], ['Data', 'BASE A', 'BASE B'], [serial, 'ANA', 'BRUNO'], ['19/10/2026', 'BRUNO', 'ANA'], ['total', 'x', 'y']]),
      'Escala'
    );
    const lido = XLSX.read(XLSX.write(livro, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
    const { cadastro, registros } = importarPlanilhaEscala(lido);
    expect(cadastro).toEqual({ bases: ['BASE A', 'BASE B'], pessoas: ['ANA', 'BRUNO'] });
    expect(registros.map((r) => r.data)).toEqual(['2026-10-20', '2026-10-20', '2026-10-19', '2026-10-19']);
  });
});
