import { describe, expect, it } from 'vitest';
import { EventoWhatsapp, MapaWhatsapp } from '../types/whatsapp';
import { adicionarCelularNoMapa, alterarEstadoDaVaga, corDaCapinha, ligarBaia, novoCelular, removerCelularNoMapa } from './celulares';
import { alterarLugarNoMapa, estado, mapaInicial } from './whatsappBaias';
import { gravarAlteracao, numerosDoMapa, podarHistorico, registrarMudancas } from './whatsappHistorico';

const AGORA = new Date('2026-10-28T10:00:00');
const NOMES = ['ANA', 'BIA', 'CAIO', 'DUDA', 'EVA', 'FABIO', 'GABI', 'HUGO'];

const semCelular = (): MapaWhatsapp => {
  const mapa = mapaInicial(AGORA);
  const op1 = mapa.salas[0].mesas[0];
  op1.supervisor = 'JOANA';
  ['E1', 'E2', 'E3', 'E4', 'D1', 'D2', 'D3', 'D4'].forEach((p, i) => (op1.lugares[p].operador = NOMES[i]));
  return mapa;
};

const comMotorola = () => {
  const base = semCelular();
  const op1 = base.salas[0].mesas[0];
  const celular = novoCelular({ cor: 'Azul', hex: corDaCapinha('Azul'), apelido: '', marca: 'MOTOROLA', usuarios: 4, mesaId: op1.id }, base, AGORA);
  return { mapa: adicionarCelularNoMapa(base, celular, AGORA), celular, op1 };
};

const ids = (m: MapaWhatsapp) => ({ salaId: m.salas[0].id, mesaId: m.salas[0].mesas[0].id });

describe('números do mapa', () => {
  it('baias sem vaga, supervisor e vagas (ligadas e backup) com o retrato de cada um', () => {
    const { mapa, celular, op1 } = comMotorola();
    const numeros = numerosDoMapa(mapa);
    expect(numeros.get(`l:${op1.id}:SUP`)).toEqual({ situacao: 'OK', operador: 'JOANA', codigo: 'OP1-SUP', equipe: 'OP1', celular: '', vaga: '' });
    expect(numeros.has(`l:${op1.id}:E1`)).toBe(false);
    const naE1 = celular.vagas.find((v) => v.baia === 'E1')!;
    expect(numeros.get(`v:${celular.id}:${naE1.id}`)).toEqual({
      situacao: 'OK', operador: 'ANA', codigo: 'OP1-E1', equipe: 'OP1', celular: 'Azul', vaga: 'Proprietário · Messenger 1',
    });
    const backup = celular.vagas.find((v) => v.baia === null)!;
    expect(numeros.get(`v:${celular.id}:${backup.id}`)).toMatchObject({ operador: '', codigo: '', equipe: 'OP1', celular: 'Azul' });
  });

  it('supervisor sem WhatsApp não é número', () => {
    const mapa = semCelular();
    mapa.salas[0].mesas[0].whatsappSupervisor = 'NAO_TEM';
    expect(numerosDoMapa(mapa).has(`l:${mapa.salas[0].mesas[0].id}:SUP`)).toBe(false);
  });
});

describe('registrar mudanças', () => {
  it('baia sem celular OK → BANIDO pelo painel', () => {
    const antes = semCelular();
    const { salaId, mesaId } = ids(antes);
    const depois = alterarLugarNoMapa(antes, salaId, mesaId, 'E1', { whatsapp: estado('BANIDO', AGORA) }, AGORA);
    expect(registrarMudancas(antes, depois, AGORA).historico).toEqual([
      { em: AGORA.toISOString(), chave: `l:${mesaId}:E1`, tipo: 'SITUACAO', de: 'OK', para: 'BANIDO', codigo: 'OP1-E1', operador: 'ANA', equipe: 'OP1', celular: '', vaga: '' },
    ]);
  });

  it('vaga ligada banida: o evento é do número (a vaga) com o celular', () => {
    const { mapa, celular } = comMotorola();
    const naE1 = celular.vagas.find((v) => v.baia === 'E1')!;
    const depois = alterarEstadoDaVaga(mapa, celular.id, naE1.id, estado('BANIDO', AGORA), AGORA);
    const [e] = registrarMudancas(mapa, depois, AGORA).historico;
    expect(e).toMatchObject({ chave: `v:${celular.id}:${naE1.id}`, tipo: 'SITUACAO', de: 'OK', para: 'BANIDO', celular: 'Azul', vaga: 'Proprietário · Messenger 1', codigo: 'OP1-E1' });
  });

  it('trocar o operador da baia gera OPERADOR', () => {
    const antes = semCelular();
    const { salaId, mesaId } = ids(antes);
    const depois = alterarLugarNoMapa(antes, salaId, mesaId, 'E1', { operador: 'BRUNA' }, AGORA);
    expect(registrarMudancas(antes, depois, AGORA).historico).toEqual([
      expect.objectContaining({ tipo: 'OPERADOR', de: 'ANA', para: 'BRUNA', codigo: 'OP1-E1', operador: 'BRUNA' }),
    ]);
  });

  it('pôr o backup na baia banida: nenhuma queda, só troca de operador das duas vagas', () => {
    const { mapa, celular } = comMotorola();
    const naE1 = celular.vagas.find((v) => v.baia === 'E1')!;
    const banido = alterarEstadoDaVaga(mapa, celular.id, naE1.id, estado('BANIDO', AGORA), AGORA);
    const backup = celular.vagas.find((v) => v.grupo === 'Usuário 2' && v.rotulo === 'Messenger 1')!;
    const { mapa: depois } = ligarBaia(banido, celular.id, backup.id, 'E1', AGORA);
    const eventos = registrarMudancas(banido, depois, AGORA).historico;
    expect(eventos.filter((e) => e.tipo === 'SITUACAO')).toEqual([]);
    expect(eventos.map((e) => [e.chave, e.tipo, e.de, e.para])).toEqual([
      [`v:${celular.id}:${naE1.id}`, 'OPERADOR', 'ANA', ''],
      [`v:${celular.id}:${backup.id}`, 'OPERADOR', '', 'ANA'],
    ]);
  });

  it('remover o celular: as vagas SAEM e as baias ENTRAM como números próprios (NÃO TEM)', () => {
    const { mapa, celular, op1 } = comMotorola();
    const eventos = registrarMudancas(mapa, removerCelularNoMapa(mapa, celular.id, AGORA), AGORA).historico;
    expect(eventos.filter((e) => e.tipo === 'SAIU')).toHaveLength(15);
    const entrou = eventos.filter((e) => e.tipo === 'ENTROU');
    expect(entrou).toHaveLength(8);
    expect(entrou[0]).toMatchObject({ chave: `l:${op1.id}:E1`, de: '', para: 'NAO_TEM', operador: 'ANA' });
    expect(eventos.find((e) => e.tipo === 'SAIU')).toMatchObject({ de: 'OK', para: '', celular: 'Azul' });
    expect(eventos.filter((e) => e.tipo === 'SITUACAO')).toEqual([]);
  });

  it('com manutenção aberta, o evento leva o id dela', () => {
    const antes: MapaWhatsapp = {
      ...semCelular(),
      manutencaoAtual: { id: 'man1', inicio: AGORA.toISOString(), fim: null, janela: 'MANHA', conferidos: [], acoes: [], observacao: '', texto: '' },
    };
    const { salaId, mesaId } = ids(antes);
    const depois = alterarLugarNoMapa(antes, salaId, mesaId, 'E1', { whatsapp: estado('BANIDO', AGORA) }, AGORA);
    expect(registrarMudancas(antes, depois, AGORA).historico[0].manutencaoId).toBe('man1');
  });

  it('nada mudou: histórico igual', () => {
    const mapa = semCelular();
    expect(registrarMudancas(mapa, { ...mapa }, AGORA).historico).toBe(mapa.historico);
  });

  it('relógio voltou: o evento fica com a data do último', () => {
    const antes = semCelular();
    const ultimo: EventoWhatsapp = { em: '2026-10-28T13:00:00.000Z', chave: 'x', tipo: 'SITUACAO', de: 'OK', para: 'BANIDO', codigo: '', operador: '', equipe: '', celular: '', vaga: '' };
    antes.historico = [ultimo];
    const { salaId, mesaId } = ids(antes);
    const cedo = new Date('2026-10-28T12:00:00.000Z');
    const depois = alterarLugarNoMapa(antes, salaId, mesaId, 'E1', { whatsapp: estado('BANIDO', cedo) }, cedo);
    expect(registrarMudancas(antes, depois, cedo).historico[1].em).toBe(ultimo.em);
  });
});

describe('poda de 12 meses', () => {
  const evento = (em: string): EventoWhatsapp => ({ em, chave: 'x', tipo: 'SITUACAO', de: 'OK', para: 'BANIDO', codigo: '', operador: '', equipe: '', celular: '', vaga: '' });
  const manutencao = (inicio: string) => ({ id: inicio, inicio, fim: inicio, janela: 'MANHA' as const, conferidos: [], acoes: [], observacao: '', texto: '' });

  it('tira o que tem mais de 12 meses e move o início do histórico', () => {
    const mapa: MapaWhatsapp = {
      ...semCelular(),
      inicioDoHistorico: '2025-01-01T00:00:00.000Z',
      historico: [evento('2025-09-01T10:00:00.000Z'), evento('2025-12-01T10:00:00.000Z')],
      manutencoes: [manutencao('2025-09-01T10:00:00.000Z'), manutencao('2025-12-01T10:00:00.000Z')],
    };
    const podado = podarHistorico(mapa, AGORA);
    expect(podado.historico.map((e) => e.em)).toEqual(['2025-12-01T10:00:00.000Z']);
    expect(podado.manutencoes.map((m) => m.inicio)).toEqual(['2025-12-01T10:00:00.000Z']);
    const limite = new Date(AGORA);
    limite.setMonth(limite.getMonth() - 12);
    expect(podado.inicioDoHistorico).toBe(limite.toISOString());
  });

  it('sem nada velho, o mapa volta igual', () => {
    const mapa = { ...semCelular(), historico: [evento('2026-10-01T10:00:00.000Z')] };
    expect(podarHistorico(mapa, AGORA)).toBe(mapa);
  });

  it('gravarAlteracao registra e poda', () => {
    const antes = { ...semCelular(), historico: [evento('2025-01-01T10:00:00.000Z')] };
    const { salaId, mesaId } = ids(antes);
    const depois = alterarLugarNoMapa(antes, salaId, mesaId, 'E1', { whatsapp: estado('BANIDO', AGORA) }, AGORA);
    expect(gravarAlteracao(antes, depois, AGORA).historico.map((e) => e.tipo)).toEqual(['SITUACAO']);
  });
});
