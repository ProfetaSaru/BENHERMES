import { describe, expect, it } from 'vitest';
import { ativosDoRanking, diferencaDeListas } from './argusAtivos';

const ARGUS = [
  'Ana Souza', // exato (maiúsculas/acentos à parte)
  'BRUNA LIMA', // a Argus tem o nome mais curto
  'CARLA SILVA SOUZA', // dois "CARLA SILVA..." na Argus: ambíguo
  'CARLA SILVA MENDES',
  'DAIANE KAUANI ALVES', // uma letra diferente
  'EDU RAMOS DIAS', // mesmo primeiro nome, outra pessoa
  'GABRIEL COSTA',
];

describe('quem entra no ranking pelos operadores ativos da Argus', () => {
  it('liga nome igual, nome mais curto na Argus e nome com uma letra diferente; deixa fora o resto', () => {
    const r = ativosDoRanking(
      ['ANA SOUZA', 'BRUNA LIMA DOS SANTOS GOMES', 'CARLA SILVA', 'DAIANE KAUANY ALVES', 'EDU NASCIMENTO', 'FABIO ROCHA'],
      ARGUS
    );
    expect(r.ativos).toEqual(['ANA SOUZA', 'BRUNA LIMA DOS SANTOS GOMES', 'DAIANE KAUANY ALVES']);
    expect(r.ligacoes).toEqual([
      { esteira: 'BRUNA LIMA DOS SANTOS GOMES', argus: 'BRUNA LIMA', como: 'palavras' },
      { esteira: 'DAIANE KAUANY ALVES', argus: 'DAIANE KAUANI ALVES', como: 'parecido' },
    ]);
    expect(r.fora.map((f) => f.esteira)).toEqual(['CARLA SILVA', 'EDU NASCIMENTO', 'FABIO ROCHA']);
    expect(r.fora[0].sugestoes).toEqual(['CARLA SILVA MENDES', 'CARLA SILVA SOUZA']);
    expect(r.fora[1].sugestoes).toEqual(['EDU RAMOS DIAS']);
  });

  it('cada operador da Argus vale para uma pessoa só: o nome igual tem preferência', () => {
    const r = ativosDoRanking(['GABRIEL COSTA', 'GABRIEL COSTA LIMA'], ARGUS);
    expect(r.ativos).toEqual(['GABRIEL COSTA']);
    expect(r.fora.map((f) => f.esteira)).toEqual(['GABRIEL COSTA LIMA']);
  });

  it('ligação manual e "não é a mesma pessoa" ficam acima da regra; incluir sempre entra sem a Argus', () => {
    const r = ativosDoRanking(['FABIO ROCHA', 'DAIANE KAUANY ALVES', 'DIGITAL 1'], ARGUS, {
      vinculos: { 'fábio rocha': 'Gabriel Costa', 'DAIANE KAUANY ALVES': '' },
      incluirSempre: ['digital 1'],
    });
    expect(r.ativos).toEqual(['FABIO ROCHA', 'DIGITAL 1']);
    expect(r.ligacoes).toEqual([{ esteira: 'FABIO ROCHA', argus: 'GABRIEL COSTA', como: 'manual' }]);
    expect(r.fora.map((f) => f.esteira)).toEqual(['DAIANE KAUANY ALVES']);
  });

  it('ligação manual para alguém que saiu da Argus não põe a pessoa no ranking', () => {
    const r = ativosDoRanking(['FABIO ROCHA'], ARGUS, { vinculos: { 'FABIO ROCHA': 'NINGUEM MAIS' } });
    expect(r.ativos).toEqual([]);
  });
});

describe('quem entrou e quem saiu da Argus desde o ranking anterior', () => {
  it('compara sem diferenciar maiúsculas, acentos e espaços', () => {
    expect(diferencaDeListas(['Ana Souza', 'BRUNA LIMA'], ['ANA  SOUZA', 'Joana Dárc'])).toEqual({ entraram: ['JOANA DARC'], sairam: ['BRUNA LIMA'] });
  });
});
