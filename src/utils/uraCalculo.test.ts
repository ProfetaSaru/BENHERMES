import { describe, expect, it } from 'vitest';
import { ArquivoCarregado, LinhaRelatorio, RegistroHistoricoUra } from '../types/relatorioUra';
import {
  calcularRelatorio,
  corDaMeta,
  metasAutomaticas,
  operadoraDaTarifacao,
  registrarNoHistorico,
  totaisDasTarifacoes,
} from './uraCalculo';
import { cadastroDaExportacao, comoDicionarios, tipoDoArquivo } from './uraLeitura';
import { colunasDoRelatorio, estiloDaCelula, SEMAFORO } from './uraExportacao';

/**
 * Mesmo cenário fictício e mesmos números esperados do tests/test_relatorio_ura.py do BENZAITEN:
 * ANA e BRUNO (equipe Sup), CARLA (equipe Chefe), DIEGO inativo (ex-colaborador).
 * Na tarifação, CARLA aparece como "KARLA" (ligada pelos apelidos).
 */
const arquivo = (nome: string, linhas: string[][]): ArquivoCarregado => {
  const tipo = tipoDoArquivo(linhas[0]);
  if (!tipo) throw new Error(`tipo não reconhecido: ${nome}`);
  return { id: nome, nome, tipo, linhas: comoDicionarios(linhas[0], linhas.slice(1)) };
};

const OPERADORES = arquivo('OPERADORES.csv', [
  ['', 'Cód. Usuário', '? Nome', 'CPF', 'Supervisor(es)', 'Status'],
  ['', '1', 'ANA ALVES', '', '(1) SUP UM', 'ATIVO'],
  ['', '2', 'BRUNO BRITO', '', '(1) SUP UM', 'ATIVO'],
  ['', '3', 'CARLA CRUZ', '', '(1) CHEFE DOIS', 'ATIVO'],
  ['', '4', 'DIEGO DIAS', '', '(1) CHEFE DOIS', 'INATIVO'],
]);
const ARQUIVOS = [
  OPERADORES,
  arquivo('tme_tma.csv', [
    ['Data', 'Operador', 'Supervisor', 'TME', 'TMA'],
    ['19/10/2026', 'ANA ALVES', 'SUP UM', '00:01:00', '00:02:00'],
    ['19/10/2026', 'BRUNO BRITO', 'SUP UM', '00:00:30', '00:00:40'],
    ['19/10/2026', 'CARLA CRUZ', 'CHEFE DOIS', '00:00:20', '00:00:50'],
    ['', '- TOTAL GERAL -', 'SUP UM', '00:00:37', '00:01:10'],
  ]),
  arquivo('tme_tma_antigo.csv', [
    ['Data', 'Operador', 'Supervisor', 'TME', 'TMA'],
    ['16/10/2026', 'ANA ALVES', 'SUP UM', '09:00:00', '09:00:00'],
  ]),
  arquivo('leads.csv', [
    ['Data', 'Operador', 'Supervisor', 'Leads. Atend.'],
    ['19/10/2026', 'ANA ALVES', 'SUP UM', '30'],
    ['19/10/2026', 'BRUNO BRITO', 'SUP UM', '10'],
    ['19/10/2026', 'CARLA CRUZ', 'CHEFE DOIS', ''],
    ['', '- TOTAL GERAL -', 'SUP UM', '40'],
  ]),
  arquivo('VENDITORE.csv', [
    ['Descrição', 'Valor R$', 'Qtde. Lig', 'Minutos'],
    ['<LIGAÇÕES SEM DERIVAÇÃO P/ OPERADOR>', '100,00', '500', '10'],
    ['ANA ALVES', '1,50', '10', '5'],
    ['OPER VIRTUAL 1', '30,00', '100', '50'],
    ['OPERADOR VIRTUAL - DTMF', '10,00', '50', '20'],
    ['DIEGO DIAS', '2,00', '5', '1'],
    ['ZECA FANTASMA', '0,70', '3', '1'],
  ]),
  arquivo('4NET.csv', [
    ['Descrição', 'Valor R$', 'Qtde. Lig', 'Minutos'],
    ['<LIGAÇÕES SEM DERIVAÇÃO P/ OPERADOR>', '20,50', '100', '5'],
    ['BRUNO BRITO', '1.000,25', '10', '5'],
    ['KARLA CRUZ', '3,00', '10', '5'],
  ]),
  arquivo('esteira.csv', [
    ['Proposta', 'Data/Hora', 'Etapa', 'CPF', 'Agente', 'Valor Contrato'],
    ['', '19/10/2026 09:00:00', 'Pago', 'CLIENTE-000001', 'CARLA CRUZ', '5000,00'],
    ['', '19/10/2026 10:00:00', 'Andamento', 'CLIENTE-000001', 'CARLA CRUZ', '1000,00'],
    ['', '19/10/2026 11:00:00', 'Pendente', 'CLIENTE-000002', 'CARLA CRUZ', '500,00'],
    ['', '19/10/2026 12:00:00', 'Cancelado', 'CLIENTE-000003', 'CARLA CRUZ', '9999,00'],
    ['', '19/10/2026 13:00:00', 'Pago', 'CLIENTE-000004', 'BRUNO BRITO', '6500,00'],
    ['', '18/10/2026 13:00:00', 'Pago', 'CLIENTE-000005', 'ANA ALVES', '7777,00'],
    ['', '19/10/2026 14:00:00', 'Pago', 'CLIENTE-000006', 'DIEGO DIAS', '300,00'],
  ]),
];

const gerar = (historico: RegistroHistoricoUra[] = [], valoresReais?: Record<string, number>) =>
  calcularRelatorio({
    dia: '2026-10-19',
    arquivos: ARQUIVOS,
    cadastro: cadastroDaExportacao(OPERADORES.linhas),
    apelidos: [{ noSistema: 'KARLA CRUZ', oficial: 'CARLA CRUZ' }],
    historico,
    diaAnterior: '2026-10-16',
    valoresReais,
  });

const linha = (linhas: LinhaRelatorio[], nome: string) => linhas.find((l) => l.nome === nome)!;

describe('relatório da URA (mesmos números do BENZAITEN)', () => {
  const r = gerar();

  it('TMA, TMO e leads só do dia (o arquivo de 16/10 é ignorado)', () => {
    const ana = linha(r.linhas, 'ANA ALVES');
    expect([ana.tma, ana.tmo, ana.leads]).toEqual([120, 60, 30]);
    expect(r.arquivos.some((a) => a.observacao.includes('IGNORADO: é de 16/10/2026'))).toBe(true);
  });

  it('custos das duas tarifações e rateio dos robôs pelos leads', () => {
    expect(r.custoRobos).toBeCloseTo(40);
    expect(r.semDerivacao).toBeCloseTo(120.5);
    expect(linha(r.linhas, 'ANA ALVES').custo).toBeCloseTo(1.5 + 30);
    expect(linha(r.linhas, 'BRUNO BRITO').custo).toBeCloseTo(1000.25 + 10);
    expect(linha(r.linhas, 'CARLA CRUZ').custo).toBeCloseTo(3); // veio como KARLA (apelido)
  });

  it('ex-colaborador e nome desconhecido ficam de fora, com aviso', () => {
    expect(r.exColaboradores).toEqual({ 'DIEGO DIAS': ['Tarifação', 'Vanguard'] });
    expect(r.semVinculo).toEqual({ 'ZECA FANTASMA': ['Tarifação'] });
    expect(r.custoIgnorado).toBeCloseTo(2.7);
    expect(r.vendasIgnoradas).toBeCloseTo(300);
  });

  it('vendas (Pago, Andamento, Pendente) e clientes únicos (Pago, Andamento)', () => {
    const carla = linha(r.linhas, 'CARLA CRUZ');
    expect(carla.vendas).toBeCloseTo(6500);
    expect(carla.clientes).toBe(1);
    expect(linha(r.linhas, 'ANA ALVES').vendas).toBe(0); // venda de 18/10 não entra
  });

  it('ordem por vendas (desempate por leads), equipes e totais', () => {
    const nomes = r.linhas.map((l) => l.nome);
    expect(nomes.slice(0, 4)).toEqual(['BRUNO BRITO', 'CARLA CRUZ', 'ANA ALVES', '']);
    expect(nomes.slice(4, 6)).toEqual(['TOTAL EQUIPE - Chefe', 'TOTAL EQUIPE - Sup']);
    expect(nomes.slice(6)).toEqual(['TOTAL OPERADORES', 'LIGAÇÕES SEM DERIVAÇÃO P/ OPERADOR', 'TOTAL GERAL (c/ sem derivação)']);

    const sup = r.linhas[5];
    expect([sup.tma, sup.tmo, sup.leads]).toEqual([160, 90, 40]); // TMA/TMO da equipe = soma
    const [totalOp, semDer, total] = r.linhas.slice(6);
    expect(totalOp.custo).toBeCloseTo(31.5 + 1010.25 + 3);
    expect(totalOp.tma).toBeNull();
    expect(semDer.custo).toBeCloseTo(120.5);
    expect(total.custo).toBeCloseTo(totalOp.custo! + 120.5);
    expect(total.clientes).toBe(2);
    expect(total.custo_cpf).toBeCloseTo(total.custo! / 2);
    expect(total.prod_lead).toBeCloseTo(13000 / 40);
  });

  it('sem divisão por zero (custo por CPF e produção por lead)', () => {
    const ana = linha(r.linhas, 'ANA ALVES');
    expect([ana.custo_cpf, ana.prod_lead]).toEqual([0, 0]);
  });
});

describe('comparação com o dia anterior', () => {
  const anterior = registrarNoHistorico([], gerar()).map((x) => ({ ...x, data: '2026-10-16', leads: x.leads - 5 }));

  it('setas de leads, vendas e custo', () => {
    const r = gerar(anterior);
    expect(r.dataAnterior).toBe('2026-10-16');
    expect(linha(r.linhas, 'ANA ALVES')).toMatchObject({ d_leads: 5, d_vendas: 0, d_custo: 0 });
  });

  it('número desconhecido do dia anterior (NaN) fica sem seta e a coluna some', () => {
    const r = gerar(anterior.map((x) => ({ ...x, custo: NaN })));
    expect(linha(r.linhas, 'ANA ALVES').d_custo).toBeUndefined();
    expect(colunasDoRelatorio(r).map((c) => c.chave)).not.toContain('d_custo');
    expect(colunasDoRelatorio(r).map((c) => c.chave)).toContain('d_leads');
  });
});

describe('cores (semáforo)', () => {
  const operadores = [10, 20, 30, 40, 50, 60].map((leads, i) => ({ tipo: 'operador', nome: `OP ${i}`, leads, tma: i === 0 ? 0 : 60 * (i + 1) })) as LinhaRelatorio[];

  it('metas automáticas por terços: melhor terço verde, pior vermelho', () => {
    const metas = metasAutomaticas(operadores);
    expect(corDaMeta(60, 'leads', metas.leads)).toBe('verde');
    expect(corDaMeta(10, 'leads', metas.leads)).toBe('vermelho');
    expect(corDaMeta(35, 'leads', metas.leads)).toBe('amarelo');
    expect(corDaMeta(120, 'tma', metas.tma)).toBe('verde'); // TMA: menor é melhor
  });

  it('TMA zerado (sem desempenho) fica sem cor', () => {
    const metas = metasAutomaticas(operadores);
    const coluna = { titulo: 'TMA', chave: 'tma' as const, formato: 'tempo' as const };
    expect(estiloDaCelula(operadores[0], 0, coluna, metas).fundo).not.toBe(SEMAFORO.verde[0]);
  });

  it('meta preenchida à mão', () => {
    const meta = { sentido: 'menor' as const, verde: '00:01:30', vermelho: '00:03:00' };
    expect(corDaMeta(80, 'tma', meta)).toBe('verde');
    expect(corDaMeta(200, 'tma', meta)).toBe('vermelho');
    expect(corDaMeta(120, 'tma', meta)).toBe('amarelo');
  });
});

describe('valor real das tarifações (o Argus só estima)', () => {
  it('reconhece a operadora pelo nome do arquivo', () => {
    expect(operadoraDaTarifacao('VENDITORE.csv')).toBe('VENDITORE');
    expect(operadoraDaTarifacao('tarifacao_venditore 19-10.xlsx')).toBe('VENDITORE');
    expect(operadoraDaTarifacao('4net_19-10.csv')).toBe('4NET');
    expect(operadoraDaTarifacao('4 NET.csv')).toBe('4NET');
    expect(operadoraDaTarifacao('OUTRA.csv')).toBe('OUTRA');
  });

  it('total estimado de cada operadora (operadores, robôs, sem derivação e fora do cadastro)', () => {
    const totais = totaisDasTarifacoes(ARQUIVOS);
    expect(totais.map((t) => t.operadora)).toEqual(['VENDITORE', '4NET']);
    expect(totais[0].estimado).toBeCloseTo(100 + 1.5 + 30 + 10 + 2 + 0.7);
    expect(totais[1].estimado).toBeCloseTo(20.5 + 1000.25 + 3);
  });

  it('sem valor real, nada muda', () => {
    const r = gerar();
    expect(r.tarifacoes.map((t) => [t.operadora, t.real, t.fator])).toEqual([
      ['VENDITORE', null, 1],
      ['4NET', null, 1],
    ]);
  });

  it('corrige só a operadora informada, na mesma proporção', () => {
    const r = gerar([], { '4NET': 2047.5 }); // o dobro do estimado
    expect(linha(r.linhas, 'BRUNO BRITO').custo).toBeCloseTo(1000.25 * 2 + 10); // robôs da VENDITORE não mudam
    expect(linha(r.linhas, 'CARLA CRUZ').custo).toBeCloseTo(6);
    expect(linha(r.linhas, 'ANA ALVES').custo).toBeCloseTo(1.5 + 30);
    expect(r.semDerivacao).toBeCloseTo(100 + 41);
    expect(r.custoImportado).toBeCloseTo(144.2 + 2047.5);
    expect(r.tarifacoes[1]).toMatchObject({ operadora: '4NET', real: 2047.5, fator: 2 });
    expect(r.arquivos.find((a) => a.nome === '4NET.csv')?.observacao).toContain('corrigida');
  });

  it('robôs, sem derivação e fora do cadastro também são corrigidos; os custos continuam batendo', () => {
    const r = gerar([], { VENDITORE: 144.2 * 1.1 });
    expect(r.custoRobos).toBeCloseTo(44);
    expect(linha(r.linhas, 'ANA ALVES').custo).toBeCloseTo(1.65 + 33);
    expect(r.custoIgnorado).toBeCloseTo(2.97);
    expect(r.custoImportado - r.custoNoRelatorio - r.custoIgnorado).toBeCloseTo(0);
    expect(r.linhas.find((l) => l.tipo === 'total_geral')!.custo).toBeCloseTo(144.2 * 1.1 + 1023.75 - 2.97);
  });

  it('valor zerado é ignorado; valor muito diferente gera aviso', () => {
    expect(gerar([], { VENDITORE: 0 }).tarifacoes[0].real).toBeNull();
    expect(gerar([], { VENDITORE: 1000 }).avisos.join()).toContain('muito longe');
  });
});
