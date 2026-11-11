import { describe, expect, it } from 'vitest';
import { validarConfig } from './config';

const PACOTE = {
  _comentario: 'Equivale às abas GUIA e AUXILIAR da planilha.',
  metas: {
    clt: { meta_vendedor: 450000, meta_bonus_vendedor: 350000, meta_supervisor: 2800000, meta_bonus_supervisor: 2000000, meta_cartao: 5 },
    estagio: { meta_vendedor: 350000, meta_bonus_vendedor: 250000, meta_supervisor: 2400000, meta_bonus_supervisor: 1600000, meta_cartao: 5 },
    meta_geral: 7600000,
  },
  emoji_destaque: '🏆',
  feriados: ['2026-11-02', '2026-11-20'],
  vendedores_clt: ['ANA SOUZA'],
  supervisores_clt: [],
  renomear_supervisores: { 'CAIO - URA': 'CAIO RAMOS' },
  funcionarios_ativos: ['ANA SOUZA', 'BRUNO LIMA'],
};

describe('validar a configuração do ranking', () => {
  it('aceita o formato do config.json do pacote, ignora o comentário e liga as duas IAs', () => {
    const r = validarConfig(PACOTE);
    expect('config' in r).toBe(true);
    if (!('config' in r)) return;
    expect(r.config.ia).toEqual({ usar_chatgpt: true, usar_claude: true });
    expect((r.config as any)._comentario).toBeUndefined();
    expect(r.config.funcionarios_ativos).toEqual(['ANA SOUZA', 'BRUNO LIMA']);
  });

  it('mantém a escolha das IAs e usa 🏆 quando não há emoji', () => {
    const r = validarConfig({ ...PACOTE, emoji_destaque: undefined, ia: { usar_chatgpt: true, usar_claude: false } });
    expect('config' in r && r.config.ia.usar_claude).toBe(false);
    expect('config' in r && r.config.emoji_destaque).toBe('🏆');
  });

  it('campos da Argus: padrão vazio, guarda os informados e recusa formato errado', () => {
    const vazio = validarConfig(PACOTE);
    expect('config' in vazio && [vazio.config.incluir_sempre, vazio.config.vinculos_argus, vazio.config.argus_em]).toEqual([[], {}, null]);
    const cheio = validarConfig({
      ...PACOTE,
      incluir_sempre: [' DIGITAL 1 ', ''],
      vinculos_argus: { 'BRUNO LIMA SANTOS': 'BRUNO LIMA', 'CARLA DIAS': '' },
      argus_em: '2026-11-11T12:00:00.000Z',
    });
    expect('config' in cheio && [cheio.config.incluir_sempre, cheio.config.vinculos_argus, cheio.config.argus_em]).toEqual([
      ['DIGITAL 1'],
      { 'BRUNO LIMA SANTOS': 'BRUNO LIMA', 'CARLA DIAS': '' },
      '2026-11-11T12:00:00.000Z',
    ]);
    expect('erro' in validarConfig({ ...PACOTE, incluir_sempre: 'X' }) && validarConfig({ ...PACOTE, incluir_sempre: 'X' })).toMatchObject({ erro: expect.stringMatching(/incluir_sempre/) });
    expect(validarConfig({ ...PACOTE, vinculos_argus: { A: 1 } })).toMatchObject({ erro: expect.stringMatching(/vinculos_argus/) });
    expect(validarConfig({ ...PACOTE, argus_em: 'ontem' })).toMatchObject({ erro: expect.stringMatching(/argus_em/) });
  });

  it('recusa com mensagem que diz o campo', () => {
    const casos: [unknown, RegExp][] = [
      [{ ...PACOTE, metas: { ...PACOTE.metas, clt: { ...PACOTE.metas.clt, meta_vendedor: '450000' } } }, /metas\.clt\.meta_vendedor/],
      [{ ...PACOTE, feriados: ['02/11/2026'] }, /feriados/],
      [{ ...PACOTE, funcionarios_ativos: 'ANA' }, /funcionarios_ativos/],
      [{ ...PACOTE, renomear_supervisores: { A: 1 } }, /renomear_supervisores/],
      [{ ...PACOTE, metas: { ...PACOTE.metas, meta_geral: -1 } }, /meta_geral/],
      [null, /config/i],
    ];
    for (const [bruto, msg] of casos) {
      const r = validarConfig(bruto);
      expect('erro' in r && r.erro).toMatch(msg);
    }
  });
});
