import { describe, expect, it } from 'vitest';
import {
  brParaIso,
  diaDaSemana,
  diaUtilAnterior,
  domingoDePascoa,
  feriado,
  feriadoNacional,
  feriadosNacionaisDoAno,
  normalizarNome,
} from './calendario';

describe('calendário', () => {
  it('calcula a Páscoa e a Sexta-feira Santa', () => {
    expect(domingoDePascoa(2025)).toBe('2025-04-20');
    expect(domingoDePascoa(2026)).toBe('2026-04-05');
    expect(feriadoNacional('2026-04-03')).toBe('Sexta-feira Santa');
  });

  it('conhece os feriados nacionais fixos', () => {
    expect(feriadoNacional('2026-11-20')).toContain('Consciência');
    expect(feriadoNacional('2026-10-21')).toBeNull();
    expect(feriadosNacionaisDoAno(2026)).toHaveLength(10);
  });

  it('dia útil anterior: segunda -> sexta e pula feriados nacionais', () => {
    expect(diaUtilAnterior('2026-10-20')).toBe('2026-10-19');
    expect(diaUtilAnterior('2026-10-19')).toBe('2026-10-16');
    expect(diaUtilAnterior('2026-11-03')).toBe('2026-10-30'); // 02/11 Finados
    expect(diaUtilAnterior('2026-04-06')).toBe('2026-04-02'); // Sexta-feira Santa
  });

  it('dia útil anterior também pula os feriados locais cadastrados', () => {
    const locais = [{ data: '2026-02-17', descricao: 'Carnaval' }];
    expect(diaUtilAnterior('2026-02-18', locais)).toBe('2026-02-16');
    expect(feriado('2026-02-17', locais)).toBe('Carnaval');
    expect(feriado('2026-02-17')).toBeNull();
  });

  it('datas e nomes', () => {
    expect(brParaIso('31/02/2026')).toBeNull();
    expect(brParaIso('1/2/2026')).toBe('2026-02-01');
    expect(diaDaSemana('2026-10-21')).toBe('quarta-feira');
    expect(normalizarNome('  José   da Conceição ')).toBe('JOSE DA CONCEICAO');
  });
});
