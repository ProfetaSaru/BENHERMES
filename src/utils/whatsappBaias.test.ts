import { describe, expect, it } from 'vitest';
import { MapaWhatsapp } from '../types/whatsapp';
import {
  carregarMapa,
  corDoCelular,
  estado,
  exportarMapa,
  importarMapa,
  mapaInicial,
  mudarSituacao,
  novaMesa,
  restricaoVencida,
  restringir,
  resumoDaSala,
  resumoGeral,
  siglaValida,
  tempoRestante,
} from './whatsappBaias';

const AGORA = new Date('2026-10-27T10:00:00');
const depois = (minutos: number) => new Date(AGORA.getTime() + minutos * 60_000);

describe('mapa inicial', () => {
  it('uma sala, a 1º Equipe 4 + 4 com supervisor e backup e os 6 celulares, tudo OK', () => {
    const mapa = mapaInicial(AGORA);
    expect(mapa.salas.map((s) => s.nome)).toEqual(['Comercial 1']);
    const mesa = mapa.salas[0].mesas[0];
    expect(mesa).toMatchObject({ nome: '1º Equipe', sigla: 'OP1', esq: 4, dir: 4, centro: 'SUPSUB', inicio: 'sup' });
    expect(Object.keys(mesa.lugares)).toEqual(['SUP', 'SUB', 'E1', 'E2', 'E3', 'E4', 'D1', 'D2', 'D3', 'D4']);
    expect(mapa.celulares.map((c) => c.cor)).toEqual(['VERDE', 'AZUL', 'VERMELHO', 'CIANO', 'PRETO', 'ROXO']);
    expect(resumoGeral(mapa, AGORA)).toEqual({ ok: 10, banido: 0, restringido: 0, vencidas: 0, naoTem: 0, vagasVazias: 8 });
  });

  it('cor de celular desconhecida fica cinza', () => {
    expect(corDoCelular('verde')).toBe('#00B050');
    expect(corDoCelular('DOURADO')).toBe('#808080');
  });
});

describe('situação do WhatsApp', () => {
  it('mudar grava a data; repetir a mesma situação não mexe em nada', () => {
    const ok = estado('OK', AGORA);
    const banido = mudarSituacao(ok, 'BANIDO', depois(5));
    expect(banido).toEqual({ situacao: 'BANIDO', mudouEm: depois(5).toISOString() });
    expect(mudarSituacao(ok, 'OK', depois(5))).toBe(ok);
  });

  it('restringir em horas e em dias', () => {
    expect(restringir(24, 'horas', AGORA).restritoAte).toBe(new Date('2026-10-28T10:00:00').toISOString());
    expect(restringir(3, 'dias', AGORA)).toMatchObject({
      situacao: 'RESTRINGIDO',
      restritoAte: depois(72 * 60).toISOString(),
      mudouEm: AGORA.toISOString(),
    });
  });

  it('tempo de restrição inválido é recusado', () => {
    for (const quantidade of [0, -1, NaN, Infinity]) {
      expect(() => restringir(quantidade, 'horas', AGORA)).toThrow('Informe um tempo maior que zero.');
    }
  });

  it('tempo restante e restrição vencida', () => {
    expect(tempoRestante(restringir(27, 'horas', AGORA), AGORA)).toBe('1d 3h');
    expect(tempoRestante(restringir(320, 'horas', AGORA), depois(320 * 60 - 320))).toBe('5h 20min');
    expect(tempoRestante(restringir(1, 'horas', AGORA), depois(15))).toBe('45min');
    const r = restringir(1, 'horas', AGORA);
    expect(restricaoVencida(r, depois(59))).toBe(false);
    expect(restricaoVencida(r, depois(60))).toBe(true);
    expect(tempoRestante(r, depois(61))).toBe('');
    expect(tempoRestante(estado('OK', AGORA), AGORA)).toBe('');
  });
});

describe('resumo', () => {
  it('conta situações e vagas vazias, sem as baias desativadas', () => {
    const mapa = mapaInicial(AGORA);
    const mesa = mapa.salas[0].mesas[0];
    mesa.lugares.E1 = { operador: 'ANA', whatsapp: estado('BANIDO', AGORA) };
    mesa.lugares.E2 = { operador: 'BRUNO', whatsapp: restringir(1, 'horas', AGORA) };
    mesa.lugares.D1 = { operador: 'CARLA', whatsapp: estado('NAO_TEM', AGORA) };
    mesa.desativadas = ['D4'];
    expect(resumoDaSala(mapa.salas[0], depois(120))).toEqual({
      ok: 6,
      banido: 1,
      restringido: 1,
      vencidas: 1,
      naoTem: 1,
      vagasVazias: 4,
    });
  });
});

describe('sigla da mesa', () => {
  const mapa = mapaInicial(AGORA);
  const op1 = mapa.salas[0].mesas[0];

  it('vazia, com espaço ou repetida é recusada', () => {
    expect(siglaValida('', mapa)).toMatch(/sigla/i);
    expect(siglaValida('OP 1', mapa)).toMatch(/letras|números/i);
    expect(siglaValida('op1', mapa)).toMatch(/já/i);
  });

  it('a própria mesa e siglas novas passam', () => {
    expect(siglaValida('OP1', mapa, op1.id)).toBeNull();
    expect(siglaValida('dg', mapa)).toBeNull();
  });
});

describe('arquivo do mapa (.json)', () => {
  const mapa: MapaWhatsapp = mapaInicial(AGORA);
  mapa.salas[0].mesas.push(novaMesa({ nome: 'Digital', sigla: 'DG', supervisor: '', esq: 5, dir: 5, centro: 'NENHUM', inicio: 'porta' }, AGORA));
  mapa.salas[0].mesas[0].lugares.E3 = { operador: 'DIEGO', whatsapp: restringir(2, 'dias', AGORA) };

  it('exportar e importar devolve o mesmo mapa', () => {
    const texto = exportarMapa(mapa, AGORA);
    expect(JSON.parse(texto)).toMatchObject({ tipo: 'benhermes-whatsapp-baias', versao: 1, exportadoEm: AGORA.toISOString() });
    expect(importarMapa(texto)).toEqual(mapa);
  });

  it('arquivo inválido é recusado com mensagem', () => {
    const errado = JSON.parse(exportarMapa(mapa, AGORA));
    expect(() => importarMapa('x')).toThrow();
    expect(() => importarMapa('{}')).toThrow();
    expect(() => importarMapa(JSON.stringify({ ...errado, tipo: 'outra-coisa' }))).toThrow();
    errado.salas[0].mesas[0].lugares.E1.whatsapp.situacao = 'TALVEZ';
    expect(() => importarMapa(JSON.stringify(errado))).toThrow();
  });

  it('dados salvos corrompidos abrem o mapa inicial', () => {
    for (const texto of [null, 'lixo', '{"versao":0}']) {
      expect(carregarMapa(texto, AGORA)).toEqual({ ...mapaInicial(AGORA), salas: expect.any(Array) });
      expect(carregarMapa(texto, AGORA).salas[0].mesas[0].sigla).toBe('OP1');
    }
    const salvo = JSON.stringify(mapa);
    expect(carregarMapa(salvo, AGORA)).toEqual(mapa);
  });
});
