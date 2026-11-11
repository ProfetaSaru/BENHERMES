import { describe, expect, it } from 'vitest';
import { conferirFrases, descrever, frasePronta, fraseValida, type Descricao } from './frases';

const linha = (nome: string, posicao: string, projetando: number, portabilidade = 1000, andamento = 0, margemCartao = 0) => ({
  nome,
  posicao,
  projetando,
  portabilidade,
  andamento,
  margemCartao,
});

describe('descrever (o que vai para a IA)', () => {
  it('primeiro nome sem o emoji, posição de N, projetando com 2 casas, situação e esteira', () => {
    const [a, b, c, d] = descrever([
      linha('AMANDA ALVES DA SILVA   🏆', '1º', 1.4567, 200000, 60000, 2),
      linha('BRUNO', '2º', 0.75, 100000, 1000),
      linha('CARLA SOUZA', '3º', 0.2, 30000),
      linha('DIEGO', '4º', 0, 0),
    ]);
    expect(a).toEqual({ nome: 'Amanda', posicao: '1º de 4', projetando: 1.46, situacao: 'batendo a meta', esteira: 'esteira em andamento cheia', vendeu_cartao_ou_margem: true });
    expect([b.situacao, b.esteira]).toEqual(['perto da meta', 'pouca coisa em andamento']);
    expect([c.nome, c.situacao, c.esteira]).toEqual(['Carla', 'abaixo da meta', 'esteira vazia']);
    expect(d.situacao).toBe('sem nenhum contrato pago');
  });
});

describe('conferência das frases', () => {
  it('recusa números, posições, porcentagens, valores, vazio e mais de 18 palavras', () => {
    expect(fraseValida('Ana, mantenha o ritmo e não deixe ninguém passar.')).toBe(true);
    for (const ruim of ['Ana, 3º lugar ainda é pouco.', 'Ana bateu 120 da meta.', 'Ana, já são R$ dez mil.', 'Ana, cem %.', 'Ana, a 2ª colocação.', '  ', 'Ana ' + 'muito '.repeat(18)]) {
      expect(fraseValida(ruim), ruim).toBe(false);
    }
  });

  it('troca frase repetida e frase inválida por frases prontas (Review Focus 4)', () => {
    const ds: Descricao[] = descrever([linha('ANA', '1º', 1.2), linha('BRUNO', '2º', 0), linha('CARLA', '2º', 0)]);
    const { frases, trocadas } = conferirFrases(ds, ['Ana, siga no topo.', 'Bruno, acorde.', 'Bruno, acorde.']);
    expect(trocadas).toBe(1);
    expect(frases[0]).toBe('Ana, siga no topo.');
    expect(frases[2]).not.toBe('Bruno, acorde.');
    expect(frases[2].startsWith('Carla')).toBe(true);
    const comNumero = conferirFrases(ds, ['Ana, 1º lugar!', 'Bruno, acorde.', 'Carla, levante.']);
    expect(comNumero.trocadas).toBe(1);
    expect(fraseValida(comNumero.frases[0])).toBe(true);
    expect(comNumero.frases[0].startsWith('Ana')).toBe(true);
  });

  it('lista de frases menor que a de pessoas: completa com prontas', () => {
    const ds = descrever([linha('ANA', '1º', 1.2), linha('BRUNO', '2º', 0.5)]);
    const { frases, trocadas } = conferirFrases(ds, ['Ana, siga no topo.']);
    expect(frases).toHaveLength(2);
    expect(trocadas).toBe(1);
    expect(frases[1].startsWith('Bruno')).toBe(true);
  });
});

describe('frases prontas', () => {
  const nomes = Array.from({ length: 30 }, (_, i) => `PESSOA${String.fromCharCode(65 + (i % 26))}${i >= 26 ? 'X' : ''}`);
  const situacoes = [1.5, 0.9, 0.4, 0];

  it('começam pelo primeiro nome, são válidas e não se repetem em 30 pessoas', () => {
    for (const tipo of ['vendedor', 'supervisor'] as const) {
      const ds = descrever(nomes.map((n, i) => linha(n, `${i + 1}º`, situacoes[i % 4], situacoes[i % 4] ? 1000 : 0)));
      const usadas = new Set<string>();
      const frases = ds.map((d, i) => frasePronta(d, i, ds.length, usadas, tipo));
      frases.forEach((f, i) => {
        expect(f.startsWith(ds[i].nome)).toBe(true);
        expect(fraseValida(f), f).toBe(true);
      });
      expect(new Set(frases.map((f, i) => f.slice(ds[i].nome.length))).size).toBe(30);
    }
  });

  it('todos zerados: ninguém repete', () => {
    const ds = descrever(nomes.map((n) => linha(n, '5º', 0, 0)));
    const usadas = new Set<string>();
    const frases = ds.map((d, i) => frasePronta(d, i, ds.length, usadas));
    expect(new Set(frases.map((f, i) => f.slice(ds[i].nome.length))).size).toBe(30);
  });

  it('supervisor fala da equipe', () => {
    const [d] = descrever([linha('EQUIPE A', '1º', 1.2)]);
    expect(frasePronta(d, 0, 1, new Set(), 'supervisor')).toMatch(/equipe|time/i);
  });
});
