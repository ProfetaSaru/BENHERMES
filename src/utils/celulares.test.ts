import { describe, expect, it } from 'vitest';
import { Celular, MapaWhatsapp } from '../types/whatsapp';
import {
  adicionarCelularNoMapa,
  adicionarVaga,
  alterarEstadoDaVaga,
  corDaCapinha,
  estadoDaVaga,
  limparLigacoes,
  ligarBaia,
  mudarEquipe,
  mudarMarcaOuUsuarios,
  nomeDaVaga,
  nomeDoCelular,
  novoCelular,
  ondeEstaABaia,
  removerMesaComCelulares,
  removerCelularNoMapa,
  removerVaga,
  textoDoLocal,
  transferirSituacoes,
  vagasDaMarca,
} from './celulares';
import { estado, formatarMesa, alterarMesaNoMapa, mapaInicial, novaMesa } from './whatsappBaias';

const AGORA = new Date('2026-10-27T10:00:00');
const NOMES = ['ANA', 'BIA', 'CAIO', 'DUDA', 'EVA', 'FABIO', 'GABI', 'HUGO'];

/** Uma sala com a OP1 (4 + 4, operadores) e a Digital (4 + 4) */
const montarMapa = (): MapaWhatsapp => {
  const mapa = mapaInicial(AGORA);
  const op1 = mapa.salas[0].mesas[0];
  ['E1', 'E2', 'E3', 'E4', 'D1', 'D2', 'D3', 'D4'].forEach((p, i) => (op1.lugares[p].operador = NOMES[i]));
  mapa.salas[0].mesas.push(novaMesa({ nome: 'Digital', sigla: 'DG', supervisor: '', esq: 4, dir: 4, centro: 'SUP', inicio: 'sup' }, AGORA));
  return mapa;
};

const criar = (mapa: MapaWhatsapp, marca: Celular['marca'], mesaId: string | null, cor = 'Azul', usuarios = 4) => {
  const c = novoCelular({ cor, hex: corDaCapinha(cor), apelido: '', marca, usuarios, mesaId }, mapa, AGORA);
  return { celular: c, mapa: adicionarCelularNoMapa(mapa, c, AGORA) };
};

const ligacoes = (c: Celular) => c.vagas.filter((v) => v.baia).map((v) => `${v.baia}=${v.grupo}/${v.rotulo}`);

describe('vagas por marca', () => {
  it('quantidade de WhatsApps de cada marca', () => {
    expect(vagasDaMarca('SAMSUNG', 1)).toHaveLength(8);
    expect(vagasDaMarca('MOTOROLA', 4)).toHaveLength(15);
    expect(vagasDaMarca('MOTOROLA', 2)).toHaveLength(9);
    expect(vagasDaMarca('XIAOMI', 4)).toHaveLength(12);
    expect(vagasDaMarca('XIAOMI', 6)).toHaveLength(18);
    expect(vagasDaMarca('IPHONE', 1)).toHaveLength(3);
    expect(vagasDaMarca('OUTRO', 1)).toEqual([]);
  });

  it('o proprietário do Motorola tem 6 e começa pelo Business', () => {
    const m = vagasDaMarca('MOTOROLA', 4);
    expect(m[0]).toEqual({ grupo: 'Proprietário', app: 'BUSINESS', rotulo: 'Business' });
    expect(m.filter((v) => v.grupo === 'Proprietário')).toHaveLength(6);
    expect(vagasDaMarca('SAMSUNG', 1).map((v) => v.grupo)).toEqual([
      'Padrão', 'Padrão', 'Padrão', 'Pasta segura', 'Pasta segura', 'Pasta segura', 'Clonado', 'Clonado',
    ]);
  });

  it('cor da capinha', () => {
    expect(corDaCapinha('azul')).toBe('#00B0F0');
    expect(corDaCapinha('Dourado')).toBe('#808080');
  });
});

describe('ligação automática', () => {
  it('Motorola: Messenger à esquerda, Business à direita, o resto backup', () => {
    const mapa = montarMapa();
    const { celular } = criar(mapa, 'MOTOROLA', mapa.salas[0].mesas[0].id);
    expect(ligacoes(celular)).toEqual([
      'D1=Proprietário/Business',
      'D2=Proprietário/Business clonado',
      'E1=Proprietário/Messenger 1',
      'E2=Proprietário/Messenger 2',
      'E3=Proprietário/Messenger clonado 1',
      'E4=Proprietário/Messenger clonado 2',
      'D3=Usuário 2/Business',
      'D4=Usuário 3/Business',
    ]);
    expect(celular.vagas.filter((v) => v.baia === null)).toHaveLength(7);
    expect(celular).toMatchObject({ compartilhado: false, nomeBackup: 'Benconsig Comercial' });
  });

  it('Samsung deixa D3 e D4 sem celular; um segundo celular na equipe liga só o que falta', () => {
    const base = montarMapa();
    const op1 = base.salas[0].mesas[0].id;
    const { mapa } = criar(base, 'SAMSUNG', op1);
    expect(ondeEstaABaia(mapa, op1, 'D3')).toBeNull();
    const { celular: segundo, mapa: com2 } = criar(mapa, 'SAMSUNG', op1, 'Preto');
    expect(ligacoes(segundo)).toEqual(['D3=Padrão/Business', 'D4=Pasta segura/Business']);
    expect(ondeEstaABaia(com2, op1, 'D4')?.celular.id).toBe(segundo.id);
  });

  it('na mesa Digital o celular é compartilhado: tudo backup "Digital Benconsig"', () => {
    const mapa = montarMapa();
    const { celular } = criar(mapa, 'SAMSUNG', mapa.salas[0].mesas[1].id, 'Ciano');
    expect(celular).toMatchObject({ compartilhado: true, nomeBackup: 'Digital Benconsig' });
    expect(ligacoes(celular)).toEqual([]);
  });
});

describe('ligar, mudar e remover', () => {
  it('ligar uma baia já usada desliga a outra vaga e avisa onde ela estava', () => {
    const base = montarMapa();
    const op1 = base.salas[0].mesas[0].id;
    const { celular, mapa } = criar(base, 'MOTOROLA', op1);
    const backup = celular.vagas.find((v) => v.grupo === 'Usuário 2' && v.rotulo === 'Messenger 1')!;
    const { mapa: novo, desligada } = ligarBaia(mapa, celular.id, backup.id, 'E1', AGORA);
    expect(desligada).toBe('Azul · Proprietário · Messenger 1');
    expect(ondeEstaABaia(novo, op1, 'E1')?.vaga.id).toBe(backup.id);
    expect(novo.celulares[0].vagas.find((v) => v.rotulo === 'Messenger 1' && v.grupo === 'Proprietário')!.baia).toBeNull();
  });

  it('Motorola de 4 para 3 usuários: some o Usuário 4; as outras vagas ficam como estavam', () => {
    const mapa = montarMapa();
    const { celular } = criar(mapa, 'MOTOROLA', mapa.salas[0].mesas[0].id);
    const comNumero = { ...celular, vagas: celular.vagas.map((v, i) => (i === 2 ? { ...v, numero: '11 99999-0000' } : v)) };
    const { celular: novo, removidas } = mudarMarcaOuUsuarios(comNumero, 'MOTOROLA', 3, AGORA);
    expect(removidas.map((v) => `${v.grupo}/${v.rotulo}`)).toEqual(['Usuário 4/Business', 'Usuário 4/Messenger 1', 'Usuário 4/Messenger 2']);
    expect(novo.vagas).toHaveLength(12);
    expect(novo.vagas[2]).toEqual(comNumero.vagas[2]);
    expect(novo.usuarios).toBe(3);
  });

  it('mudar de equipe refaz a ligação; guardar deixa tudo backup', () => {
    const base = montarMapa();
    const [op1, dg] = base.salas[0].mesas;
    const { celular, mapa } = criar(base, 'MOTOROLA', op1.id);
    const naDigital = mudarEquipe(mapa, celular.id, dg.id, AGORA).celulares[0];
    expect(naDigital).toMatchObject({ mesaId: dg.id, compartilhado: true, nomeBackup: 'Digital Benconsig' });
    expect(ligacoes(naDigital)).toEqual([]);
    const guardado = mudarEquipe(mapa, celular.id, null, AGORA).celulares[0];
    expect(guardado.mesaId).toBeNull();
    expect(ligacoes(guardado)).toEqual([]);
  });

  it('remover a mesa guarda o celular sem ligações', () => {
    const base = montarMapa();
    const op1 = base.salas[0].mesas[0];
    const { mapa } = criar(base, 'MOTOROLA', op1.id);
    const novo = removerMesaComCelulares(mapa, base.salas[0].id, op1.id, AGORA);
    expect(novo.salas[0].mesas.map((m) => m.sigla)).toEqual(['DG']);
    expect(novo.celulares[0].mesaId).toBeNull();
    expect(ligacoes(novo.celulares[0])).toEqual([]);
  });

  it('diminuir a mesa: a vaga da baia que sumiu vira backup', () => {
    const base = montarMapa();
    const sala = base.salas[0];
    const op1 = sala.mesas[0];
    const { mapa } = criar(base, 'MOTOROLA', op1.id);
    const { mesa } = formatarMesa(op1, { nome: op1.nome, sigla: 'OP1', supervisor: '', esq: 3, dir: 4, centro: 'SUP', inicio: 'sup', desativadas: [] }, AGORA);
    const reduzido = limparLigacoes(alterarMesaNoMapa(mapa, sala.id, op1.id, () => mesa, AGORA));
    expect(ondeEstaABaia(reduzido, op1.id, 'E4')).toBeNull();
    expect(reduzido.celulares[0].vagas.find((v) => v.rotulo === 'Messenger clonado 2')!.baia).toBeNull();
  });

  it('marca Outro: adicionar e remover vagas à mão', () => {
    const mapa = montarMapa();
    const { celular } = criar(mapa, 'OUTRO', null, 'Branco');
    const com = adicionarVaga(celular, { grupo: 'Padrão', app: 'MESSENGER', rotulo: 'Messenger 1' }, AGORA);
    expect(com.vagas).toHaveLength(1);
    expect(com.vagas[0]).toMatchObject({ baia: null, numero: '', whatsapp: { situacao: 'OK' } });
    expect(removerVaga(com, com.vagas[0].id).vagas).toEqual([]);
  });
});

describe('situação e nomes', () => {
  it('vaga de operador usa a situação da baia; backup tem a própria', () => {
    const base = montarMapa();
    const op1 = base.salas[0].mesas[0];
    const { celular, mapa } = criar(base, 'MOTOROLA', op1.id);
    const ligada = celular.vagas.find((v) => v.baia === 'E1')!;
    const backup = celular.vagas.find((v) => v.baia === null)!;
    const m1 = alterarEstadoDaVaga(mapa, celular.id, ligada.id, estado('BANIDO', AGORA), AGORA);
    expect(m1.salas[0].mesas[0].lugares.E1.whatsapp.situacao).toBe('BANIDO');
    expect(m1.celulares[0].vagas.find((v) => v.id === ligada.id)!.whatsapp.situacao).toBe('OK');
    expect(estadoDaVaga(m1, m1.celulares[0], ligada).situacao).toBe('BANIDO');
    const m2 = alterarEstadoDaVaga(m1, celular.id, backup.id, estado('PERMANENTE', AGORA), AGORA);
    expect(estadoDaVaga(m2, m2.celulares[0], m2.celulares[0].vagas.find((v) => v.id === backup.id)!).situacao).toBe('PERMANENTE');
  });

  it('nomes exibidos', () => {
    const base = montarMapa();
    const { celular, mapa } = criar(base, 'MOTOROLA', base.salas[0].mesas[0].id);
    expect(nomeDaVaga(mapa, celular, celular.vagas.find((v) => v.baia === 'E1')!)).toBe('ANA');
    expect(nomeDaVaga(mapa, celular, celular.vagas.find((v) => v.baia === null)!)).toBe('Benconsig Comercial');
    expect(nomeDoCelular({ ...celular, cor: 'Preto', apelido: 'Joana' })).toBe('Preto · Joana');
    expect(nomeDoCelular(celular)).toBe('Azul');
    const u2 = celular.vagas.find((v) => v.grupo === 'Usuário 2' && v.rotulo === 'Messenger 1')!;
    expect(textoDoLocal(celular, u2)).toBe('Azul · Usuário 2 · Messenger 1');
  });
});

describe('a situação acompanha o número (a vaga) quando a ligação muda', () => {
  const banirE1 = () => {
    const base = montarMapa();
    const op1 = base.salas[0].mesas[0];
    const { celular, mapa } = criar(base, 'MOTOROLA', op1.id);
    const naE1 = celular.vagas.find((v) => v.baia === 'E1')!;
    const banido = alterarEstadoDaVaga(mapa, celular.id, naE1.id, estado('BANIDO', AGORA), AGORA);
    return { mapa: banido, op1, celular, naE1 };
  };
  const vaga = (m: MapaWhatsapp, id: string) => m.celulares.flatMap((c) => c.vagas.map((v) => ({ c, v }))).find((x) => x.v.id === id)!;
  const situacao = (m: MapaWhatsapp, id: string) => { const { c, v } = vaga(m, id); return estadoDaVaga(m, c, v).situacao; };

  it('trocar a vaga da baia banida: o banido vira backup ainda BANIDO e a baia fica com a situação da vaga nova', () => {
    const { mapa, celular, naE1 } = banirE1();
    const backup = celular.vagas.find((v) => v.grupo === 'Usuário 2' && v.rotulo === 'Messenger 1')!;
    const { mapa: novo } = ligarBaia(mapa, celular.id, backup.id, 'E1', AGORA);
    expect(situacao(novo, naE1.id)).toBe('BANIDO');
    expect(vaga(novo, naE1.id).v.baia).toBeNull();
    expect(situacao(novo, backup.id)).toBe('OK');
    expect(novo.salas[0].mesas[0].lugares.E1.whatsapp.situacao).toBe('OK');
  });

  it('desligar a vaga sem pôr outra: a baia fica NÃO TEM e a vaga leva o BANIDO', () => {
    const { mapa, celular, naE1 } = banirE1();
    const { mapa: novo } = ligarBaia(mapa, celular.id, naE1.id, null, AGORA);
    expect(situacao(novo, naE1.id)).toBe('BANIDO');
    expect(novo.salas[0].mesas[0].lugares.E1.whatsapp.situacao).toBe('NAO_TEM');
  });

  it('mudar de equipe, remover a mesa ou o celular: o banido continua banido', () => {
    const { mapa, op1, celular, naE1 } = banirE1();
    const dg = mapa.salas[0].mesas[1];
    expect(situacao(mudarEquipe(mapa, celular.id, dg.id, AGORA), naE1.id)).toBe('BANIDO');
    expect(situacao(removerMesaComCelulares(mapa, mapa.salas[0].id, op1.id, AGORA), naE1.id)).toBe('BANIDO');
    expect(removerCelularNoMapa(mapa, celular.id, AGORA).salas[0].mesas[0].lugares.E1.whatsapp.situacao).toBe('NAO_TEM');
  });

  it('diminuir a mesa (via transferirSituacoes): a vaga da baia que sumiu leva a situação', () => {
    const base = montarMapa();
    const sala = base.salas[0];
    const op1 = sala.mesas[0];
    const { celular, mapa: m0 } = criar(base, 'MOTOROLA', op1.id);
    const naE4 = celular.vagas.find((v) => v.baia === 'E4')!;
    const mapa = alterarEstadoDaVaga(m0, celular.id, naE4.id, estado('BANIDO', AGORA), AGORA);
    const { mesa } = formatarMesa(mapa.salas[0].mesas[0], { nome: op1.nome, sigla: 'OP1', supervisor: '', esq: 3, dir: 4, centro: 'SUP', inicio: 'sup', desativadas: [] }, AGORA);
    const reduzido = transferirSituacoes(mapa, limparLigacoes(alterarMesaNoMapa(mapa, sala.id, op1.id, () => mesa, AGORA)), AGORA);
    expect(vaga(reduzido, naE4.id).v.baia).toBeNull();
    expect(situacao(reduzido, naE4.id)).toBe('BANIDO');
  });

  it('vaga nova numa baia mantém a situação da baia (primeiro cadastro dos celulares)', () => {
    const base = montarMapa();
    const op1 = base.salas[0].mesas[0];
    op1.lugares.E1.whatsapp = estado('BANIDO', AGORA);
    const { celular, mapa } = criar(base, 'MOTOROLA', op1.id);
    const naE1 = celular.vagas.find((v) => v.baia === 'E1')!;
    expect(situacao(transferirSituacoes(base, mapa, AGORA), naE1.id)).toBe('BANIDO');
  });
});
