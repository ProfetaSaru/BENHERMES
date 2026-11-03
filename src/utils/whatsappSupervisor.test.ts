import { describe, expect, it } from 'vitest';
import { MapaWhatsapp } from '../types/whatsapp';
import {
  filtrarMapaParaSupervisor,
  isMesaDoSupervisor,
  mapaInicial,
  novaMesa,
} from './whatsappBaias';

const AGORA = new Date('2026-10-30T10:00:00');

describe('filtrarMapaParaSupervisor e isMesaDoSupervisor', () => {
  it('identifica a mesa do supervisor por ID ou por nome', () => {
    const mesa1 = { ...novaMesa({ nome: 'Mesa 1', sigla: 'M1', supervisor: 'Carlos Silva', supervisorUserId: 'usr-1', esq: 2, dir: 2, centro: 'SUP', inicio: 'sup' }, AGORA) };
    const mesa2 = { ...novaMesa({ nome: 'Mesa 2', sigla: 'M2', supervisor: 'Ana Paula', supervisorUserId: 'usr-2', esq: 2, dir: 2, centro: 'SUP', inicio: 'sup' }, AGORA) };
    const mesa3SemId = { ...novaMesa({ nome: 'Mesa 3', sigla: 'M3', supervisor: 'Marcos Santos', esq: 2, dir: 2, centro: 'SUP', inicio: 'sup' }, AGORA) };

    expect(isMesaDoSupervisor(mesa1, { id: 'usr-1', displayName: 'Outro Nome' })).toBe(true);
    expect(isMesaDoSupervisor(mesa1, { id: 'usr-2', displayName: 'Carlos Silva' })).toBe(false);
    expect(isMesaDoSupervisor(mesa2, { id: 'usr-2', displayName: 'Ana Paula' })).toBe(true);
    expect(isMesaDoSupervisor(mesa3SemId, { id: 'usr-3', displayName: 'Marcos Santos' })).toBe(true);
    expect(isMesaDoSupervisor(mesa3SemId, { id: 'usr-3', displayName: 'Fulano' })).toBe(false);
  });

  it('filtra mapa isolando apenas a mesa e celulares da equipe do supervisor', () => {
    const base = mapaInicial(AGORA);
    const mesa1 = { ...novaMesa({ nome: 'Mesa 1', sigla: 'M1', supervisor: 'Carlos', supervisorUserId: 'sup-carlos', esq: 2, dir: 2, centro: 'SUP', inicio: 'sup' }, AGORA) };
    const mesa2 = { ...novaMesa({ nome: 'Mesa 2', sigla: 'M2', supervisor: 'Beatriz', supervisorUserId: 'sup-beatriz', esq: 2, dir: 2, centro: 'SUP', inicio: 'sup' }, AGORA) };

    const mapaCom2Mesas: MapaWhatsapp = {
      ...base,
      salas: [
        {
          id: 'sala-1',
          nome: 'Sala Principal',
          mesas: [mesa1, mesa2],
        },
      ],
      celulares: [
        {
          id: 'cel-1',
          cor: 'AZUL',
          hex: '#0000FF',
          marca: 'SAMSUNG',
          usuarios: 2,
          compartilhado: false,
          apelido: 'Cel Carlos',
          mesaId: mesa1.id,
          nomeBackup: 'Backup 1',
          vagas: [],
        },
        {
          id: 'cel-2',
          cor: 'VERDE',
          hex: '#00FF00',
          marca: 'MOTOROLA',
          usuarios: 2,
          compartilhado: false,
          apelido: 'Cel Beatriz',
          mesaId: mesa2.id,
          nomeBackup: 'Backup 2',
          vagas: [],
        },
      ],
    };

    const filtrado = filtrarMapaParaSupervisor(mapaCom2Mesas, { id: 'sup-carlos', displayName: 'Carlos' });
    expect(filtrado.salas).toHaveLength(1);
    expect(filtrado.salas[0].mesas).toHaveLength(1);
    expect(filtrado.salas[0].mesas[0].id).toBe(mesa1.id);
    expect(filtrado.celulares).toHaveLength(1);
    expect(filtrado.celulares[0].id).toBe('cel-1');
  });

  it('retorna lista de salas vazia se o supervisor não tiver mesa alocada', () => {
    const base = mapaInicial(AGORA);
    const filtrado = filtrarMapaParaSupervisor(base, { id: 'sup-sem-mesa', displayName: 'Sem Mesa' });
    expect(filtrado.salas).toHaveLength(0);
    expect(filtrado.celulares).toHaveLength(0);
  });
});
