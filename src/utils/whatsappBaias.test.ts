import { describe, expect, it } from 'vitest';
import { MapaWhatsapp } from '../types/whatsapp';
import {
  adicionarMesaNoMapa,
  adicionarSalaNoMapa,
  alternarDesativada,
  formatarMesa,
  removerMesaNoMapa,
  removerSalaNoMapa,
  renomearSalaNoMapa,
  alterarLugarNoMapa,
  alterarMesaNoMapa,
  carregarMapa,
  estado,
  exportarMapa,
  importarMapa,
  analiseAtrasada,
  migrarMapa,
  pedirAnalise,
  tempoDesde,
  lerMapaSalvo,
  mapaInicial,
  mudarSituacao,
  novaMesa,
  restricaoVencida,
  restringir,
  siglaValida,
  tempoRestante,
} from './whatsappBaias';

const AGORA = new Date('2026-10-27T10:00:00');
const depois = (minutos: number) => new Date(AGORA.getTime() + minutos * 60_000);

describe('mapa inicial', () => {
  it('versão 2: uma sala, a 1º Equipe 4 + 4 só com supervisor (no PC), sem celulares', () => {
    const mapa = mapaInicial(AGORA);
    expect(mapa.versao).toBe(2);
    expect(mapa.celulares).toEqual([]);
    expect(mapa.salas.map((s) => s.nome)).toEqual(['Comercial 1']);
    const mesa = mapa.salas[0].mesas[0];
    expect(mesa).toMatchObject({ nome: '1º Equipe', sigla: 'OP1', esq: 4, dir: 4, centro: 'SUP', inicio: 'sup', whatsappSupervisor: 'PC' });
    expect(Object.keys(mesa.lugares)).toEqual(['SUP', 'E1', 'E2', 'E3', 'E4', 'D1', 'D2', 'D3', 'D4']);
  });
});

describe('ciclo do banimento', () => {
  it('pedir análise grava a hora; "Em análise" não é escolhido direto', () => {
    expect(pedirAnalise(AGORA)).toEqual({
      situacao: 'ANALISE',
      analisePedidaEm: AGORA.toISOString(),
      mudouEm: AGORA.toISOString(),
    });
    expect(() => mudarSituacao(estado('BANIDO', AGORA), 'ANALISE', AGORA)).toThrow();
    expect(mudarSituacao(pedirAnalise(AGORA), 'PERMANENTE', depois(60)).situacao).toBe('PERMANENTE');
  });

  it('análise atrasada depois de 24 h', () => {
    const e = pedirAnalise(AGORA);
    expect(analiseAtrasada(e, depois(24 * 60 - 1))).toBe(false);
    expect(analiseAtrasada(e, depois(24 * 60))).toBe(true);
    expect(analiseAtrasada(estado('BANIDO', AGORA), depois(48 * 60))).toBe(false);
  });

  it('tempo desde', () => {
    const iso = AGORA.toISOString();
    expect(tempoDesde(iso, depois(45))).toBe('45min');
    expect(tempoDesde(iso, depois(180))).toBe('3h');
    expect(tempoDesde(iso, depois(26 * 60))).toBe('26h');
    expect(tempoDesde(iso, depois(72 * 60))).toBe('3d');
  });
});

describe('migração da versão 1', () => {
  const v1 = {
    versao: 1,
    atualizadoEm: AGORA.toISOString(),
    salas: [
      {
        id: 's1',
        nome: 'Comercial 1',
        mesas: [
          {
            id: 'm1', nome: '1º Equipe', sigla: 'OP1', supervisor: 'JOANA', esq: 1, dir: 1, centro: 'SUPSUB', inicio: 'sup', desativadas: [],
            lugares: {
              SUP: { operador: '', whatsapp: estado('NAO_TEM', AGORA) },
              SUB: { operador: '', whatsapp: estado('OK', AGORA) },
              E1: { operador: 'ANA', whatsapp: estado('BANIDO', AGORA) },
              D1: { operador: 'BRUNO', whatsapp: estado('OK', AGORA) },
            },
          },
          {
            id: 'm2', nome: '2º Equipe', sigla: 'OP2', supervisor: '', esq: 1, dir: 1, centro: 'SUP', inicio: 'sup', desativadas: [],
            lugares: {
              SUP: { operador: '', whatsapp: estado('OK', AGORA) },
              E1: { operador: '', whatsapp: estado('OK', AGORA) },
              D1: { operador: '', whatsapp: estado('OK', AGORA) },
            },
          },
        ],
      },
    ],
    celulares: [{ cor: 'AZUL', hex: '#00B0F0', messenger: estado('OK', AGORA), business: estado('BANIDO', AGORA) }],
  };

  it('remove o backup e os celulares antigos; supervisor NÃO TEM vira "sem WhatsApp"', () => {
    const m = migrarMapa(v1);
    expect(m.versao).toBe(2);
    expect(m.celulares).toEqual([]);
    const [m1, m2] = m.salas[0].mesas;
    expect(m1).toMatchObject({ centro: 'SUP', whatsappSupervisor: 'NAO_TEM' });
    expect(Object.keys(m1.lugares)).toEqual(['SUP', 'E1', 'D1']);
    expect(m1.lugares.E1).toEqual(v1.salas[0].mesas[0].lugares.E1);
    expect(m2.whatsappSupervisor).toBe('PC');
  });

  it('um .json da versão 1 é importado já migrado', () => {
    expect(importarMapa(JSON.stringify({ tipo: 'benhermes-whatsapp-baias', ...v1 }))).toEqual(migrarMapa(v1));
    expect(carregarMapa(JSON.stringify(v1), AGORA)).toEqual(migrarMapa(v1));
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
    expect(tempoRestante(restringir(2, 'dias', AGORA), AGORA)).toBe('2d');
    expect(tempoRestante(restringir(320, 'horas', AGORA), depois(320 * 60 - 320))).toBe('5h 20min');
    expect(tempoRestante(restringir(1, 'horas', AGORA), depois(15))).toBe('45min');
    const r = restringir(1, 'horas', AGORA);
    expect(restricaoVencida(r, depois(59))).toBe(false);
    expect(restricaoVencida(r, depois(60))).toBe(true);
    expect(tempoRestante(r, depois(61))).toBe('');
    expect(tempoRestante(estado('OK', AGORA), AGORA)).toBe('');
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
    expect(JSON.parse(texto)).toMatchObject({ tipo: 'benhermes-whatsapp-baias', versao: 2, exportadoEm: AGORA.toISOString() });
    expect(importarMapa(texto)).toEqual(mapa);
  });

  it('arquivo salvo com BOM (Bloco de Notas, Excel) também é aceito', () => {
    expect(importarMapa('\uFEFF' + exportarMapa(mapa, AGORA))).toEqual(mapa);
  });

  it('arquivo inválido é recusado com mensagem', () => {
    const errado = JSON.parse(exportarMapa(mapa, AGORA));
    expect(() => importarMapa('x')).toThrow();
    expect(() => importarMapa('{}')).toThrow();
    expect(() => importarMapa(JSON.stringify({ ...errado, tipo: 'outra-coisa' }))).toThrow();
    errado.salas[0].mesas[0].lugares.E1.whatsapp.situacao = 'TALVEZ';
    expect(() => importarMapa(JSON.stringify(errado))).toThrow();
  });

  it('dados salvos ilegíveis são sinalizados para guardar uma cópia antes de sobrescrever', () => {
    expect(lerMapaSalvo('lixo', AGORA).ilegivel).toBe(true);
    expect(lerMapaSalvo('{"versao":2}', AGORA).ilegivel).toBe(true);
    expect(lerMapaSalvo('{"versao":3,"salas":[],"celulares":[],"atualizadoEm":"x"}', AGORA).ilegivel).toBe(true);
    expect(lerMapaSalvo(null, AGORA).ilegivel).toBe(false);
    expect(lerMapaSalvo(JSON.stringify(mapa), AGORA)).toEqual({ mapa, ilegivel: false });
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

describe('alterações no mapa (sem mexer no original)', () => {
  const mapa = mapaInicial(AGORA);
  const sala = mapa.salas[0];
  const mesa = sala.mesas[0];

  it('lugar: troca só o lugar pedido e atualiza a data do mapa', () => {
    const novo = alterarLugarNoMapa(mapa, sala.id, mesa.id, 'E1', { operador: 'ANA' }, depois(1));
    expect(novo.salas[0].mesas[0].lugares.E1.operador).toBe('ANA');
    expect(novo.salas[0].mesas[0].lugares.E2).toBe(mesa.lugares.E2);
    expect(novo.atualizadoEm).toBe(depois(1).toISOString());
    expect(mapa.salas[0].mesas[0].lugares.E1.operador).toBe('');
  });

  it('mesa: aplica a mudança e mantém as outras salas', () => {
    const novo = alterarMesaNoMapa(mapa, sala.id, mesa.id, (m) => ({ ...m, supervisor: 'JOANA' }), depois(2));
    expect(novo.salas[0].mesas[0].supervisor).toBe('JOANA');
    expect(mesa.supervisor).toBe('');
  });
});

describe('configurar salas e mesas', () => {
  const mapa = mapaInicial(AGORA);
  const sala = mapa.salas[0];
  const mesa = sala.mesas[0];

  it('salas: adicionar, renomear e remover', () => {
    const com2 = adicionarSalaNoMapa(mapa, 'Comercial 2', depois(1));
    expect(com2.salas.map((s) => s.nome)).toEqual(['Comercial 1', 'Comercial 2']);
    expect(com2.salas[1].mesas).toEqual([]);
    const renomeado = renomearSalaNoMapa(com2, com2.salas[1].id, 'Sala Digital', depois(2));
    expect(renomeado.salas[1].nome).toBe('Sala Digital');
    expect(removerSalaNoMapa(renomeado, renomeado.salas[1].id, depois(3)).salas).toHaveLength(1);
  });

  it('mesas: adicionar e remover', () => {
    const nova = novaMesa({ nome: 'Digital', sigla: 'DG', supervisor: '', esq: 5, dir: 5, centro: 'NENHUM', inicio: 'sup' }, AGORA);
    const com = adicionarMesaNoMapa(mapa, sala.id, nova, depois(1));
    expect(com.salas[0].mesas.map((m) => m.sigla)).toEqual(['OP1', 'DG']);
    expect(removerMesaNoMapa(com, sala.id, nova.id, depois(2)).salas[0].mesas.map((m) => m.sigla)).toEqual(['OP1']);
  });

  it('mudar o formato: mantém quem fica, cria vagas novas e informa quem sai', () => {
    const comAna = { ...mesa, lugares: { ...mesa.lugares, E4: { operador: 'ANA', whatsapp: estado('BANIDO', AGORA) } } };
    const { mesa: nova, removidos } = formatarMesa(
      comAna,
      { nome: '1º Equipe', sigla: 'OP1', supervisor: 'JOANA', esq: 3, dir: 5, centro: 'NENHUM', inicio: 'porta', desativadas: [] },
      depois(1)
    );
    expect(removidos).toEqual([{ posicao: 'SUP', operador: '' }, { posicao: 'E4', operador: 'ANA' }]);
    expect(nova).toMatchObject({ supervisor: 'JOANA', esq: 3, dir: 5, centro: 'NENHUM', inicio: 'porta', id: mesa.id });
    expect(nova.lugares.E1).toBe(mesa.lugares.E1);
    expect(nova.lugares.D5).toEqual({ operador: '', whatsapp: estado('OK', depois(1)) });
  });

  it('desativar e reativar uma baia guarda o que estava nela', () => {
    const comAna = { ...mesa, lugares: { ...mesa.lugares, D2: { operador: 'ANA', whatsapp: estado('OK', AGORA) } } };
    const desativada = alternarDesativada(comAna, 'D2', depois(1));
    expect(desativada.desativadas).toEqual(['D2']);
    const reativada = alternarDesativada(desativada, 'D2', depois(2));
    expect(reativada.desativadas).toEqual([]);
    expect(reativada.lugares.D2.operador).toBe('ANA');
  });
});
