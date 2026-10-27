import { describe, expect, it } from 'vitest';
import { FormatoMesa, ajustarLugares, codigoDoLugar, posicoesAtivas, posicoesDaMesa } from './mapaMesas';

const mesa = (mudanca: Partial<FormatoMesa> = {}): FormatoMesa => ({
  sigla: 'OP1',
  esq: 4,
  dir: 4,
  centro: 'SUPSUB',
  inicio: 'sup',
  desativadas: [],
  ...mudanca,
});

describe('códigos dos lugares', () => {
  it('sigla e posição com hífen, como no protótipo de chamados', () => {
    expect(codigoDoLugar('OP1', 'E3')).toBe('OP1-E3');
    expect(codigoDoLugar('DG', 'SUB')).toBe('DG-SUB');
  });
});

describe('posições da mesa', () => {
  it('4 + 4 com supervisor e backup, baia 1 perto do supervisor', () => {
    expect(posicoesDaMesa(mesa())).toEqual({
      centro: ['SUP', 'SUB'],
      esquerda: ['E1', 'E2', 'E3', 'E4'],
      direita: ['D1', 'D2', 'D3', 'D4'],
    });
  });

  it('baia 1 pela porta: a ordem de exibição se inverte', () => {
    const { esquerda, direita } = posicoesDaMesa(mesa({ inicio: 'porta' }));
    expect(esquerda).toEqual(['E4', 'E3', 'E2', 'E1']);
    expect(direita).toEqual(['D4', 'D3', 'D2', 'D1']);
  });

  it('sem ninguém no centro e lados de tamanhos diferentes', () => {
    const p = posicoesDaMesa(mesa({ centro: 'NENHUM', esq: 5, dir: 3 }));
    expect(p.centro).toEqual([]);
    expect(p.esquerda).toHaveLength(5);
    expect(p.direita).toEqual(['D1', 'D2', 'D3']);
  });

  it('posições ativas não incluem as desativadas', () => {
    const ativas = posicoesAtivas(mesa({ desativadas: ['E4'] }));
    expect(ativas).not.toContain('E4');
    expect(ativas.slice(0, 3)).toEqual(['SUP', 'SUB', 'E1']);
    expect(ativas).toHaveLength(9);
  });
});

describe('mudar o formato da mesa', () => {
  const criar = (posicao: string) => ({ operador: '', posicao });
  const lugaresDe = (f: FormatoMesa) => Object.fromEntries(posicoesAtivas(f).map((p) => [p, { operador: p, posicao: p }]));

  it('diminuir: avisa quem sai e mantém quem fica', () => {
    const antes = lugaresDe(mesa());
    const { lugares, removidos } = ajustarLugares(antes, mesa({ esq: 3, centro: 'SUP' }), criar);
    expect(removidos).toEqual(['SUB', 'E4']);
    expect(lugares.E1).toBe(antes.E1);
    expect(Object.keys(lugares)).not.toContain('E4');
  });

  it('aumentar: cria só as posições novas', () => {
    const antes = lugaresDe(mesa());
    const { lugares, removidos } = ajustarLugares(antes, mesa({ esq: 5 }), criar);
    expect(removidos).toEqual([]);
    expect(lugares.E5).toEqual(criar('E5'));
    expect(lugares.D4).toBe(antes.D4);
  });
});
