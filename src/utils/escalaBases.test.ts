import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { EscalaRegistro } from '../types/escala';
import {
  csvParaHistorico,
  gerarPlanilhaEscala,
  historicoParaCsv,
  importarPlanilhaEscala,
  mesclarHistorico,
  realizarSorteio,
  registrarSorteio,
  rodizio,
  textoDaEscala,
  RESERVA,
  SEM_LOTE,
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

  it('menos pessoas que bases: ninguém fica com duas, a que sobra é RESERVA', () => {
    const { atribuicoes } = rodizio(NOTAS, ['ANA', 'BRUNO', 'CARLA'], [], '2026-10-20');
    const pessoas = nomesDe(atribuicoes).filter((n) => n !== RESERVA);
    expect(new Set(pessoas).size).toBe(3);
    expect(nomesDe(atribuicoes).filter((n) => n === RESERVA)).toHaveLength(1);
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

describe('título da escala', () => {
  const resultado = realizarSorteio({ bases: NOTAS, pessoas: PESSOAS }, [], '2026-11-11', []);

  it('o texto para o chat começa com "ESCALA DE BASES — ATIVO", sem o 2', () => {
    expect(textoDaEscala(resultado).split('\n')[0]).toBe('ESCALA DE BASES — ATIVO');
  });

  it('a planilha tem o mesmo título', async () => {
    const livro = await gerarPlanilhaEscala(resultado, [], NOTAS);
    expect(livro.getWorksheet('Escala')!.getCell('A1').value).toBe('ESCALA DE BASES — ATIVO');
  });
});

describe('quinta base, reserva do dia e lote acabou', () => {
  const CINCO = [...NOTAS, 'INSS - LOTE - 5 - C6'];
  const SEMANA = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];
  const cadastro = (semLote: string[] = []) => ({ bases: CINCO, pessoas: PESSOAS, semLote });

  const semana = (inicio: EscalaRegistro[] = []) => {
    let historico = inicio;
    return SEMANA.map((data) => {
      const r = realizarSorteio(cadastro(), historico, data, []);
      historico = registrarSorteio(historico, r);
      return r;
    });
  };

  it('5 bases e 4 equipes: na semana ninguém repete base e a reserva muda todo dia', () => {
    const dias = semana(dia('2026-11-20', ['ANA', 'BRUNO', 'CARLA', 'DIEGO', RESERVA], CINCO));
    for (const p of PESSOAS) {
      const bases = dias.map((r) => r.atribuicoes.find((a) => a.responsavel === p)?.base);
      expect(bases.every(Boolean), p).toBe(true);
      expect(new Set(bases).size, p).toBe(5);
    }
    const reservas = dias.map((r) => r.atribuicoes.find((a) => a.responsavel === RESERVA)!.base);
    expect(new Set(reservas).size).toBe(5);
    expect(dias[0].avisos.join(' ')).not.toMatch(/mais de uma base/);
  });

  it('sem histórico também: a roda tem 5 posições', () => {
    const dias = semana();
    for (const p of PESSOAS) expect(new Set(dias.map((r) => r.atribuicoes.find((a) => a.responsavel === p)!.base)).size).toBe(5);
  });

  it('lote acabou: a equipe da base vai para a reserva do dia e a base fica SEM LOTE', () => {
    const antes = realizarSorteio(cadastro(), [], SEMANA[0], []);
    const daEquipe = antes.atribuicoes.find((a) => a.responsavel === 'ANA')!.base;
    const reserva = antes.atribuicoes.find((a) => a.responsavel === RESERVA)!.base;
    const depois = realizarSorteio(cadastro([daEquipe]), [], SEMANA[0], []);
    expect(depois.atribuicoes.find((a) => a.base === daEquipe)!.responsavel).toBe(SEM_LOTE);
    expect(depois.atribuicoes.find((a) => a.base === reserva)!.responsavel).toBe('ANA');
    expect(depois.avisos.join(' ')).toMatch(/ANA.*reserva/i);
  });

  it('lote acabou sem reserva livre: aviso e a equipe fica sem base', () => {
    const r0 = realizarSorteio(cadastro(), [], SEMANA[0], []);
    const daAna = r0.atribuicoes.find((a) => a.responsavel === 'ANA')!.base;
    const reserva = r0.atribuicoes.find((a) => a.responsavel === RESERVA)!.base;
    const r = realizarSorteio(cadastro([daAna, reserva]), [], SEMANA[0], []);
    expect(r.semBase).toContain('ANA');
    expect(r.avisos.join(' ')).toMatch(/sem reserva.*lote novo/i);
  });

  it('base sem lote nos dias seguintes: a roda continua contando os dias certos', () => {
    let historico = dia('2026-11-20', ['ANA', 'BRUNO', 'CARLA', 'DIEGO', RESERVA], CINCO);
    const semLote = [CINCO[1]];
    const comSemLote = SEMANA.map((data) => {
      const r = realizarSorteio(cadastro(semLote), historico, data, []);
      historico = registrarSorteio(historico, r);
      return r;
    });
    const normal = semana(dia('2026-11-20', ['ANA', 'BRUNO', 'CARLA', 'DIEGO', RESERVA], CINCO));
    // Quem não caiu na base sem lote fica exatamente onde ficaria
    comSemLote.forEach((r, i) => {
      for (const a of normal[i].atribuicoes) {
        if (a.base === CINCO[1] || a.responsavel === RESERVA) continue;
        expect(r.atribuicoes.find((x) => x.base === a.base)!.responsavel, `${SEMANA[i]} ${a.base}`).toBe(a.responsavel);
      }
    });
  });

  it('ao cadastrar a 5ª base, a roda continua de onde parou (dia antigo sem a base nova conta como reserva)', () => {
    const historico = [...dia('2026-11-20', ['CARLA', 'DIEGO', 'ANA', 'BRUNO']), ...dia('2026-11-23', ['BRUNO', 'CARLA', 'DIEGO', 'ANA'])];
    const r = realizarSorteio(cadastro(), historico, '2026-11-24', []);
    // 23/11 = [BRUNO, CARLA, DIEGO, ANA, (reserva)]; cada um anda uma posição
    expect(nomesDe(r.atribuicoes)).toEqual([RESERVA, 'BRUNO', 'CARLA', 'DIEGO', 'ANA']);
  });

  it('texto do chat: reserva e sem lote em linhas próprias', () => {
    const r0 = realizarSorteio(cadastro(), [], SEMANA[0], []);
    const daAna = r0.atribuicoes.find((a) => a.responsavel === 'ANA')!.base;
    const texto = textoDaEscala(realizarSorteio(cadastro([daAna]), [], SEMANA[0], []));
    expect(texto).toContain(`Sem lote: ${daAna}`);
    expect(texto).not.toContain(`: ${RESERVA}`);
    expect(texto).not.toContain(`: ${SEM_LOTE}`);
    const semNada = textoDaEscala(r0);
    expect(semNada).toMatch(/\nReserva: INSS/);
  });
});
