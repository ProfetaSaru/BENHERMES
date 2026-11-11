import { describe, expect, it } from 'vitest';
import { ConfigRanking } from '../../types/ranking';
import { diasUteis, gerarRelatorio, lerEsteira, normalizar, numeroBr, qualEsteira, separarEsteiras } from './calculo';

const FERIADOS = ['2026-11-02', '2026-11-20'];
const DIA = '2026-11-11';

const CONFIG: ConfigRanking = {
  metas: {
    clt: { meta_vendedor: 450000, meta_bonus_vendedor: 350000, meta_supervisor: 2800000, meta_bonus_supervisor: 2000000, meta_cartao: 5 },
    estagio: { meta_vendedor: 350000, meta_bonus_vendedor: 250000, meta_supervisor: 2400000, meta_bonus_supervisor: 1600000, meta_cartao: 5 },
    meta_geral: 7600000,
  },
  emoji_destaque: '🏆',
  feriados: FERIADOS,
  vendedores_clt: ['brúno'],
  supervisores_clt: [],
  renomear_supervisores: { 'CAIO - URA': 'CAIO RAMOS' },
  funcionarios_ativos: ['Ana', 'BRUNO', 'carla', 'DIEGO', 'EVA'],
  ia: { usar_chatgpt: true, usar_claude: true },
};

const CAB = 'Proposta;Etapa;Produto;Agente;Equipe;Valor Contrato';
const csv = (...linhas: string[]) => [CAB, ...linhas].join('\n');

// Pagamento: ANA 100 mil (proposta 1), BRUNO 200 mil + cartão 5 mil, EVA só cartão, FABIO 50 mil (fora dos ativos)
const PAGAMENTO = csv(
  '1;Pago;PORTABILIDADE;ANA - 10;EQUIPE A;100.000,00',
  '2;Pago;PORTABILIDADE;BRUNO - 11;EQUIPE A;200.000,00',
  '3;Pago;CARTAO;BRUNO - 11;EQUIPE A;5.000,00',
  '4;Pago;CARTAO BENEFICIO;EVA - 14;  caio - ura ;2.000,00',
  '5;Pago;PORTABILIDADE;FABIO - 15;CAIO - URA;50.000,00',
  '6;Reprovado;PORTABILIDADE;ANA - 10;EQUIPE A;999.999,00'
);
// Andamento: proposta 1 repetida (ignorada), ANA 20 mil, CARLA 5 mil, DIEGO 3 mil (DIEGO aparece por último)
const ANDAMENTO = csv(
  '1;Andamento;PORTABILIDADE;ANA - 10;EQUIPE A;100.000,00',
  '7;Andamento;PORTABILIDADE;ANA - 10;EQUIPE A;20.000,00',
  '8;Andamento;PORTABILIDADE;CARLA - 12;CAIO - URA;5.000,00',
  '9;Andamento;PORTABILIDADE;DIEGO - 13;CAIO - URA;3.000,00'
);

const relatorio = () => gerarRelatorio(lerEsteira(ANDAMENTO).linhas, lerEsteira(PAGAMENTO).linhas, CONFIG, DIA);

describe('utilidades', () => {
  it('dias úteis passados e do mês (com os feriados)', () => {
    expect(diasUteis(DIA, FERIADOS)).toEqual([6, 19]);
    // 1º do mês: como a macro, conta o mês anterior inteiro (Review Focus 1)
    expect(diasUteis('2026-12-01', FERIADOS)).toEqual([19, 19]);
  });

  it('números no formato brasileiro e nomes normalizados', () => {
    expect(numeroBr('11.233,99')).toBeCloseTo(11233.99, 2);
    expect(numeroBr('11233.99')).toBeCloseTo(11233.99, 2);
    expect(numeroBr('')).toBe(0);
    expect(numeroBr(undefined)).toBe(0);
    expect(normalizar(' Débora   lúcia ')).toBe('DEBORA LUCIA');
  });
});

describe('leitura das esteiras', () => {
  it('BOM, espaços no cabeçalho e na etapa (Review Focus 3)', () => {
    const { linhas, faltando } = lerEsteira('﻿Proposta;Etapa ;Produto;Agente;Equipe;Valor Contrato\n1;Pago ;PORT;ANA - 1;EQ;1.000,00\n');
    expect(faltando).toEqual([]);
    expect(linhas[0].Proposta).toBe('1');
    expect(linhas[0].Etapa).toBe('Pago ');
    expect(qualEsteira(linhas)).toBe('pagamento');
  });

  it('coluna faltando e qual é cada esteira', () => {
    expect(lerEsteira('Proposta;Etapa;Produto;Agente;Equipe\n1;Pago;P;A;E').faltando).toEqual(['Valor Contrato']);
    expect(qualEsteira(lerEsteira(ANDAMENTO).linhas)).toBe('andamento');
    expect(qualEsteira(lerEsteira(CAB).linhas)).toBeNull();
  });
});

describe('qual é cada esteira (Review final #1)', () => {
  const esteira = (etapas: string[]) => etapas.map((Etapa, i) => ({ Proposta: String(i), Etapa }));

  it('a esteira de Andamento com alguns "Pago" continua sendo de andamento (etapa que mais aparece)', () => {
    expect(qualEsteira(esteira(['Andamento', 'Andamento', 'Pago', 'Cancelado']))).toBe('andamento');
    expect(qualEsteira(esteira(['Pago', 'Pago', 'Andamento', 'Reprovado']))).toBe('pagamento');
  });

  it('as duas juntas: a que tem mais Andamento proporcionalmente é a de andamento', () => {
    const andamento = { nome: 'a.csv', linhas: esteira(['Pago', 'Pago', 'Andamento', 'Cancelado']) };
    const pagamento = { nome: 'p.csv', linhas: esteira(['Pago', 'Pago', 'Pago', 'Pago', 'Reprovado']) };
    expect(separarEsteiras([pagamento, andamento]).map((e) => [e.nome, e.tipo])).toEqual([
      ['p.csv', 'pagamento'],
      ['a.csv', 'andamento'],
    ]);
    expect(separarEsteiras([andamento]).map((e) => e.tipo)).toEqual(['pagamento']);
  });
});

describe('ranking', () => {
  it('vendedores: só ativos, CLT pelo nome com acento, empate dividido, quem só tem cartão fica fora', () => {
    const r = relatorio();
    expect(r.vendedores.map((l) => [l.posicao, l.nome])).toEqual([
      ['1º', 'BRUNO   🏆'],
      ['2º', 'ANA'],
      ['3º', 'DIEGO'],
      ['3º', 'CARLA'],
    ]);
  });

  it('valores do vendedor CLT (faixa máxima com extra) e do estágio', () => {
    const [bruno, ana] = relatorio().vendedores;
    expect(bruno.portabilidade).toBe(200000);
    expect(bruno.projetando).toBeCloseTo(1.4074074, 6);
    expect(bruno.potencial).toBeCloseTo(3540, 6);
    expect(bruno.margemCartao).toBe(1);
    expect(bruno.elegivel).toBe(false);
    expect(ana.portabilidade).toBe(100000);
    expect(ana.andamento).toBe(20000);
    expect(ana.projetando).toBeCloseTo(0.9047619, 6);
    expect(ana.potencial).toBeCloseTo(380, 6);
    expect(ana.projecao).toBe(110000);
  });

  it('supervisores pela equipe, renomeados sem diferenciar maiúsculas e espaços', () => {
    const [a, caio] = relatorio().supervisores;
    expect([a.posicao, a.nome, caio.posicao, caio.nome]).toEqual(['1º', 'EQUIPE A', '2º', 'CAIO RAMOS']);
    expect(a.potencial).toBeCloseTo(1770, 6);
    expect(caio.portabilidade).toBe(50000);
    expect(caio.andamento).toBe(8000);
    expect(caio.margemCartao).toBe(1);
    expect(caio.potencial).toBeCloseTo(309, 6);
  });

  it('total geral', () => {
    const t = relatorio().total;
    expect(t.portabilidade).toBe(350000);
    expect(t.projetando).toBeCloseTo(0.1458333, 6);
    expect(t.potencial).toBeCloseTo(3540 + 380 + 1770 + 309, 6);
    expect(t.margemCartao).toBe(2);
    expect(t.andamento).toBe(28000);
    expect(t.projecao).toBe(364000);
    expect(t.elegiveis).toBe(0);
  });

  it('elegível, faixa do estágio com extra e destaque', () => {
    const pag = csv('1;Pago;PORT;GABI - 1;EQ;520.000,00');
    const r = gerarRelatorio([], lerEsteira(pag).linhas, { ...CONFIG, funcionarios_ativos: ['GABI'] }, DIA);
    const [gabi] = r.vendedores;
    // projetando = 520000 / (350000 * 6/19) ≥ 500/350: taxa 0,003 e extra de 1000
    expect(gabi.projetando).toBeCloseTo((520000 * 19) / (350000 * 6), 6);
    expect(gabi.potencial).toBeCloseTo((350000 * gabi.projetando * 0.003 + 1000) * 1.2, 6);
    expect(gabi.elegivel).toBe(true);
    expect(gabi.nome).toBe('GABI   🏆');
    expect(r.total.elegiveis).toBe(1); // a equipe (520 mil) não chega à meta de bônus do supervisor
  });

  it('lista de ativos vazia: todos entram', () => {
    const r = gerarRelatorio(lerEsteira(ANDAMENTO).linhas, lerEsteira(PAGAMENTO).linhas, { ...CONFIG, funcionarios_ativos: [] }, DIA);
    expect(r.vendedores.map((l) => l.nome.split(' ')[0])).toContain('FABIO');
  });

  it('títulos e cabeçalho da projeção', () => {
    const r = relatorio();
    expect(r.tituloVendedor).toBe('RANKING GERAL DE CONTRATOS PAGOS - VENDEDOR - DE 01/11/2026 A 11/11/2026');
    expect(r.tituloSupervisor).toBe('RANKING GERAL DE CONTRATOS PAGOS - SUPERVISOR - DE 01/11/2026 A 11/11/2026');
    expect(r.cabecalhoProjecao).toBe('PORT. PROJEÇÃO - 18/11/2026');
    expect(r.metaCartao).toBe(5);
    expect(r.dia).toBe(DIA);
  });
});
