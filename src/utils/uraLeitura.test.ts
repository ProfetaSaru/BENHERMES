import { describe, expect, it } from 'vitest';
import {
  converterData,
  converterValorBr,
  lerCsv,
  limparCabecalho,
  nomeDaEquipe,
  tempoParaSegundos,
  tipoDoArquivo,
} from './uraLeitura';

// Mesmos casos do tests/test_relatorio_ura.py do BENZAITEN
describe('conversões do formato brasileiro', () => {
  it.each([
    ['R$ 1.234,56', 1234.56],
    ['10,50', 10.5],
    ['1,3', 1.3],
    ['633,0333', 633.0333],
    ['1.500', 1500],
    ['2.345.678,90', 2345678.9],
    ['1500.00', 1500],
    ['', 0],
    ['R$ -', 0],
    ['-2,5', -2.5],
    [7, 7],
  ])('valor %s -> %s', (texto, esperado) => {
    expect(converterValorBr(texto)).toBeCloseTo(esperado as number);
  });

  it('tempos e datas', () => {
    expect(tempoParaSegundos('00:01:04')).toBe(64);
    expect(tempoParaSegundos('01:02:05')).toBe(3725);
    expect(tempoParaSegundos('')).toBe(0);
    expect(tempoParaSegundos(64 / 86400)).toBe(64); // hora do Excel
    expect(converterData('19/10/2026 14:35:00')).toBe('2026-10-19');
    expect(converterData('2026-10-19')).toBe('2026-10-19');
    expect(converterData('- TOTAL GERAL -')).toBeNull();
  });
});

describe('leitura das exportações', () => {
  it('limpa o símbolo que o Argus coloca no cabeçalho', () => {
    expect(limparCabecalho('? Nome')).toBe('NOME');
    expect(limparCabecalho('↓ Nome')).toBe('NOME');
    expect(limparCabecalho('Cód. Usuário')).toBe('COD. USUARIO');
  });

  it('reconhece cada exportação pelas colunas', () => {
    expect(tipoDoArquivo(['Proposta', 'Data/Hora', 'Etapa', 'CPF', 'Agente', 'Valor Contrato'])).toBe('esteira');
    expect(tipoDoArquivo(['', '? Nome', 'CPF', 'Supervisor(es)', 'Status'])).toBe('operadores');
    expect(tipoDoArquivo(['Descrição', 'Valor R$', 'Qtde. Lig', 'Minutos'])).toBe('tarifacao');
    expect(tipoDoArquivo(['Data', 'Operador', 'Supervisor', 'TME', 'TMA'])).toBe('desempenho');
    expect(tipoDoArquivo(['Data', 'Operador', 'Supervisor', 'Leads. Atend.'])).toBe('leads');
    expect(tipoDoArquivo(['qualquer', 'coisa'])).toBeNull();
  });

  it('CSV com ; e aspas', () => {
    expect(lerCsv('"a";"b;c"\r\n"x ""y""";2\n')).toEqual([
      ['a', 'b;c'],
      ['x "y"', '2'],
    ]);
  });

  it('equipe é o primeiro nome do supervisor', () => {
    expect(nomeDaEquipe('(1) JOANA DE SÁ PRADO, (2) OUTRO')).toBe('Joana');
  });
});
