import { describe, expect, it } from 'vitest';
import { descrever } from './frases.ts';
import { INSTRUCAO, gerarComentarios, provedoresDoAmbiente, type Provedor } from './ia.ts';

const linha = (nome: string, posicao: string, projetando: number) => ({ nome, posicao, projetando, portabilidade: projetando ? 1000 : 0, andamento: 0, margemCartao: 0 });
const ENTRADA = {
  vendedores: descrever([linha('ANA', '1º', 1.2), linha('BRUNO', '2º', 0.5), linha('CARLA', '3º', 0)]),
  supervisores: descrever([linha('EQUIPE A', '1º', 0.8)]),
};

const ok = (nome: Provedor['nome'], prefixo = ''): Provedor => ({
  nome,
  gerar: async (e) => ({
    vendedores: e.vendedores.map((d) => `${d.nome}, ${prefixo}frase de ${nome}.`),
    supervisores: e.supervisores.map((d) => `${d.nome}, ${prefixo}equipe de ${nome}.`),
  }),
});
const falha = (nome: Provedor['nome'], msg: string): Provedor => ({ nome, gerar: async () => { throw new Error(msg); } });

describe('ordem das IAs', () => {
  it('ChatGPT respondeu: usa o ChatGPT', async () => {
    const r = await gerarComentarios(ENTRADA, [ok('chatgpt'), ok('claude')]);
    expect(r.provedor).toBe('chatgpt');
    expect(r.vendedores[0]).toBe('Ana, frase de chatgpt.');
    expect(r.avisos).toEqual([]);
  });

  it('ChatGPT sem limite: Claude escreve e a tela recebe o aviso', async () => {
    const r = await gerarComentarios(ENTRADA, [falha('chatgpt', '429 insufficient_quota'), ok('claude')]);
    expect(r.provedor).toBe('claude');
    expect(r.supervisores[0]).toBe('Equipe, equipe de claude.');
    expect(r.avisos).toEqual(['ChatGPT sem limite ou fora do ar; comentários feitos pelo Claude.']);
  });

  it('os dois falham: frases prontas', async () => {
    const r = await gerarComentarios(ENTRADA, [falha('chatgpt', 'x'), falha('claude', 'y')]);
    expect(r.provedor).toBe('frases');
    expect(r.vendedores.map((f) => f.split(',')[0])).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(r.avisos.join(' ')).toMatch(/frases prontas/);
  });

  it('nenhum provedor (chaves ausentes ou desligados): frases prontas sem aviso de falha', async () => {
    const r = await gerarComentarios(ENTRADA, []);
    expect(r.provedor).toBe('frases');
  });

  it('quantidade de frases diferente da de pessoas conta como falha', async () => {
    const curto: Provedor = { nome: 'chatgpt', gerar: async () => ({ vendedores: ['Ana, só uma.'], supervisores: ['Equipe, ok.'] }) };
    expect((await gerarComentarios(ENTRADA, [curto, ok('claude')])).provedor).toBe('claude');
  });

  it('demora acima do limite conta como falha', async () => {
    const lento: Provedor = { nome: 'chatgpt', gerar: () => new Promise((r) => setTimeout(() => r({ vendedores: [], supervisores: [] }), 200)) };
    expect((await gerarComentarios(ENTRADA, [lento, ok('claude')], 50)).provedor).toBe('claude');
  });

  it('frase com posição é trocada por pronta', async () => {
    const r = await gerarComentarios(ENTRADA, [ok('chatgpt', 'no 1º lugar, ')]);
    expect(r.vendedores.every((f) => !/º/.test(f))).toBe(true);
    expect(r.avisos.join(' ')).toMatch(/trocad/);
  });
});

describe('provedores pelo ambiente e pela configuração', () => {
  it('só os ligados e com chave', () => {
    const env = { OPENAI_API_KEY: 'x', ANTHROPIC_API_KEY: 'y' };
    expect(provedoresDoAmbiente({ usar_chatgpt: true, usar_claude: true }, env).map((p) => p.nome)).toEqual(['chatgpt', 'claude']);
    expect(provedoresDoAmbiente({ usar_chatgpt: true, usar_claude: false }, env).map((p) => p.nome)).toEqual(['chatgpt']);
    expect(provedoresDoAmbiente({ usar_chatgpt: true, usar_claude: true }, { ANTHROPIC_API_KEY: 'y' }).map((p) => p.nome)).toEqual(['claude']);
    expect(provedoresDoAmbiente({ usar_chatgpt: true, usar_claude: true }, {})).toEqual([]);
  });

  it('as instruções proíbem números, posições e valores', () => {
    expect(INSTRUCAO).toMatch(/NÃO cite valores, números, porcentagens, posições/);
  });
});
