import { describe, expect, it } from 'vitest';
import { EstadoWhatsapp, MapaWhatsapp, Situacao } from '../types/whatsapp';
import { adicionarCelularNoMapa, alterarEstadoDaVaga, corDaCapinha, novoCelular } from './celulares';
import { alertas, resumoDaSala, resumoDoCelular, resumoGeral } from './whatsappAlertas';
import { mapaInicial, novaMesa } from './whatsappBaias';

const AGORA = new Date('2026-10-27T10:00:00');
const antes = (horas: number) => new Date(AGORA.getTime() - horas * 3_600_000).toISOString();
const como = (situacao: Situacao, horas: number, extra: Partial<EstadoWhatsapp> = {}): EstadoWhatsapp => ({
  situacao,
  mudouEm: antes(horas),
  ...extra,
});

const montar = (): MapaWhatsapp => {
  let mapa = mapaInicial(AGORA);
  const op1 = mapa.salas[0].mesas[0];
  op1.supervisor = 'JOANA';
  const nomes = ['ANA', 'BIA', 'CAIO', 'DUDA', 'EVA', 'FABIO', 'GABI', 'HUGO'];
  ['E1', 'E2', 'E3', 'E4', 'D1', 'D2', 'D3', 'D4'].forEach((p, i) => (op1.lugares[p].operador = nomes[i]));
  op1.lugares.E1.whatsapp = como('BANIDO', 5);
  op1.lugares.E2.whatsapp = como('BANIDO', 1);
  op1.lugares.D1.whatsapp = como('ANALISE', 26, { analisePedidaEm: antes(26) });
  op1.lugares.D2.whatsapp = como('ANALISE', 2, { analisePedidaEm: antes(2) });
  op1.lugares.E3.whatsapp = como('RESTRINGIDO', 30, { restritoAte: antes(1) });
  op1.lugares.D3.whatsapp = como('PERMANENTE', 4);
  op1.lugares.E4.whatsapp = como('RESTRINGIDO', 2, { restritoAte: antes(-20) });
  op1.lugares.SUP.whatsapp = como('NAO_TEM', 10);
  const op2 = novaMesa({ nome: '2º Equipe', sigla: 'OP2', supervisor: 'FULANO', esq: 1, dir: 1, centro: 'SUP', inicio: 'sup', whatsappSupervisor: 'NAO_TEM' }, AGORA);
  op2.lugares.SUP.whatsapp = como('BANIDO', 8);
  mapa.salas[0].mesas.push(op2);
  // Celular guardado: tudo backup; um backup banido há 3 h
  const cel = novoCelular({ cor: 'Azul', hex: corDaCapinha('Azul'), apelido: '', marca: 'MOTOROLA', usuarios: 4, mesaId: null }, mapa, AGORA);
  mapa = adicionarCelularNoMapa(mapa, cel, AGORA);
  const vaga = cel.vagas.find((v) => v.rotulo === 'Messenger clonado 1')!;
  return alterarEstadoDaVaga(mapa, cel.id, vaga.id, como('BANIDO', 3), AGORA);
};

describe('alertas', () => {
  const mapa = montar();
  const lista = alertas(mapa, AGORA);

  it('na ordem de prioridade, sem o supervisor que não tem WhatsApp', () => {
    expect(lista.map((a) => a.tipo)).toEqual([
      'PEDIR_ANALISE',
      'PEDIR_ANALISE',
      'PEDIR_ANALISE',
      'ANALISE_ATRASADA',
      'RESTRICAO_VENCIDA',
      'PERMANENTE',
      'RESTRINGIDO',
      'NAO_TEM',
    ]);
    expect(lista.slice(0, 3).map((a) => a.onde)).toEqual(['OP1-E1', 'Azul · Proprietário · Messenger clonado 1', 'OP1-E2']);
    expect(lista.map((a) => a.onde)).not.toContain('OP2-SUP');
  });

  it('detalhes de cada alerta', () => {
    expect(lista[0]).toMatchObject({ quem: 'ANA', situacao: 'BANIDO', desde: antes(5), alvo: { tipo: 'lugar', posicao: 'E1' } });
    expect(lista[1]).toMatchObject({ quem: 'Benconsig Comercial', alvo: { tipo: 'vaga' } });
    expect(lista[3]).toMatchObject({ onde: 'OP1-D1', desde: antes(26) });
    expect(lista[4]).toMatchObject({ onde: 'OP1-E3', ate: antes(1) });
    expect(lista[6]).toMatchObject({ onde: 'OP1-E4', ate: antes(-20) });
    expect(lista[7]).toMatchObject({ onde: 'OP1-SUP', quem: 'JOANA' });
  });
});

describe('resumo', () => {
  const mapa = montar();

  it('geral: baias, supervisores com WhatsApp e backups', () => {
    expect(resumoGeral(mapa, AGORA)).toEqual({
      ok: 17,
      banido: 3,
      analise: 2,
      analiseAtrasada: 1,
      permanente: 1,
      restringido: 2,
      vencidas: 1,
      naoTem: 1,
      vagasVazias: 2,
      celulares: 1,
    });
  });

  it('da sala: sem os backups', () => {
    expect(resumoDaSala(mapa.salas[0], AGORA)).toMatchObject({ ok: 3, banido: 2, celulares: 0 });
  });

  it('do celular', () => {
    expect(resumoDoCelular(mapa, mapa.celulares[0], AGORA)).toEqual({ total: 15, operadores: 0, backups: 15, ok: 14, problemas: 1 });
  });
});
