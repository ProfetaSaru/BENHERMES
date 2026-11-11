import { describe, expect, it } from 'vitest';
import { legendaDoDia, tipoDoDia } from './legenda';

describe('tipo do dia', () => {
  it('dia da semana, último e primeiro dia útil do mês', () => {
    expect(tipoDoDia('2026-11-09', [])).toBe('segunda');
    expect(tipoDoDia('2026-11-10', [])).toBe('terca');
    expect(tipoDoDia('2026-11-11', [])).toBe('quarta');
    expect(tipoDoDia('2026-11-12', [])).toBe('quinta');
    expect(tipoDoDia('2026-11-13', [])).toBe('sexta');
    expect(tipoDoDia('2026-11-30', [])).toBe('fechamento');
    expect(tipoDoDia('2026-12-01', [])).toBe('balanco');
  });

  it('feriado local no fim do mês adianta o fechamento (Review Focus 1)', () => {
    expect(tipoDoDia('2026-11-27', ['2026-11-30'])).toBe('fechamento');
    expect(tipoDoDia('2026-11-27', [])).toBe('sexta');
  });

  it('feriado no começo do mês adia o balanço', () => {
    expect(tipoDoDia('2026-12-02', ['2026-12-01'])).toBe('balanco');
  });
});

describe('legenda do dia', () => {
  it('segunda: início da semana e "uma excelente semana"', () => {
    const t = legendaDoDia('2026-11-09', []);
    expect(t).toContain('segunda-feira');
    expect(t).toContain('uma excelente semana');
  });

  it('sexta: "excelente final de semana"', () => {
    expect(legendaDoDia('2026-11-13', [])).toContain('excelente final de semana');
  });

  it('último dia útil: fechamento com o nome do mês', () => {
    const t = legendaDoDia('2026-11-30', []);
    expect(t).toContain('fechamento');
    expect(t).toContain('novembro');
  });

  it('primeiro dia útil: balanço do mês anterior no passado', () => {
    expect(legendaDoDia('2026-12-01', [])).toContain('Novembro passou');
  });

  it('formato fixo: abertura, 4 parágrafos, fechamento e nenhum número', () => {
    const dias = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-30', '2026-12-01'];
    for (const dia of dias) {
      for (const v of [0, 1, 2, 3]) {
        const t = legendaDoDia(dia, [], v);
        expect(t.startsWith('Bom dia, campeões da BenConsig! 🚀'), `${dia} v${v}`).toBe(true);
        expect(t.endsWith('🏆💼'), `${dia} v${v}`).toBe(true);
        expect(t.split('\n\n'), `${dia} v${v}`).toHaveLength(4);
        expect(/\d/.test(t), `${dia} v${v}`).toBe(false);
      }
    }
  });

  it('mesma data dá o mesmo texto; "Outra versão" muda', () => {
    expect(legendaDoDia('2026-11-11', [])).toBe(legendaDoDia('2026-11-11', []));
    expect(legendaDoDia('2026-11-11', [], 1)).not.toBe(legendaDoDia('2026-11-11', []));
  });
});
