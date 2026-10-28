import { describe, expect, it } from 'vitest';
import { adicionarCelularNoMapa, alterarEstadoDaVaga, corDaCapinha, estadoDaVaga, novoCelular, removerCelularNoMapa } from './celulares';
import { alterarLugarNoMapa, estado, mapaInicial, pedirAnalise, restringir } from './whatsappBaias';
import { gravarAlteracao } from './whatsappHistorico';
import {
  GRUPO_SEM_CELULAR,
  acoesPossiveis,
  alternarConferido,
  aplicarAcao,
  cancelarManutencao,
  concluirManutencao,
  etapasDaManutencao,
  iniciarManutencao,
  janelaDaHora,
  numerosDaEtapa,
  textoDaManutencao,
  trocarJanela,
} from './whatsappManutencao';

const em = (hhmm: string) => new Date(`2026-10-28T${hhmm}:00`);
const INICIO = em('09:12');
const NOMES = ['ANA', 'BIA', 'CAIO', 'DUDA', 'EVA', 'FABIO', 'GABI', 'HUGO'];

/** OP1 4+4 com um Samsung Azul (E1–E4, D1, D2 ligadas; 2 backups) e um iPhone Vermelho guardado */
const montar = () => {
  let mapa = mapaInicial(INICIO);
  const op1 = mapa.salas[0].mesas[0];
  op1.supervisor = 'JOANA';
  ['E1', 'E2', 'E3', 'E4', 'D1', 'D2', 'D3', 'D4'].forEach((p, i) => (op1.lugares[p].operador = NOMES[i]));
  const azul = novoCelular({ cor: 'Azul', hex: corDaCapinha('Azul'), apelido: '', marca: 'SAMSUNG', usuarios: 1, mesaId: op1.id }, mapa, INICIO);
  mapa = adicionarCelularNoMapa(mapa, azul, INICIO);
  const vermelho = novoCelular({ cor: 'Vermelho', hex: corDaCapinha('Vermelho'), apelido: '', marca: 'IPHONE', usuarios: 1, mesaId: null }, mapa, INICIO);
  mapa = adicionarCelularNoMapa(mapa, vermelho, INICIO);
  const naE1 = azul.vagas.find((v) => v.baia === 'E1')!;
  return { mapa, azul, vermelho, naE1, salaId: mapa.salas[0].id, mesaId: op1.id };
};

describe('janela pela hora', () => {
  it('manhã 8:00–11:59, almoço 12:00–14:59, fora o resto', () => {
    expect(['07:59', '08:00', '11:59', '12:00', '14:59', '15:00'].map((h) => janelaDaHora(em(h)))).toEqual([
      'FORA', 'MANHA', 'MANHA', 'ALMOCO', 'ALMOCO', 'FORA',
    ]);
  });
});

describe('ações possíveis', () => {
  it('só os botões que fazem sentido para cada situação', () => {
    const agora = em('10:00');
    expect(acoesPossiveis(estado('OK', agora), agora)).toEqual(['BANIDO', 'RESTRINGIDO']);
    expect(acoesPossiveis(estado('BANIDO', agora), agora)).toEqual(['PEDIU_ANALISE']);
    expect(acoesPossiveis(pedirAnalise(agora), agora)).toEqual(['LIBERADO', 'PERDIDO']);
    expect(acoesPossiveis(estado('PERMANENTE', agora), agora)).toEqual(['TROCOU_CHIP']);
    expect(acoesPossiveis(restringir(2, 'horas', agora), agora)).toEqual([]);
    expect(acoesPossiveis(restringir(2, 'horas', agora), em('13:00'))).toEqual(['VOLTOU']);
    expect(acoesPossiveis(estado('NAO_TEM', agora), agora)).toEqual([]);
  });
});

describe('manutenção', () => {
  it('iniciar abre uma manutenção com a janela da hora; iniciar de novo não mexe', () => {
    const { mapa } = montar();
    const aberta = iniciarManutencao(mapa, INICIO);
    expect(aberta.manutencaoAtual).toMatchObject({ inicio: INICIO.toISOString(), fim: null, janela: 'MANHA', conferidos: [], acoes: [], texto: '' });
    expect(iniciarManutencao(aberta, em('13:00'))).toBe(aberta);
    expect(trocarJanela(aberta, 'FORA').manutencaoAtual!.janela).toBe('FORA');
  });

  it('etapas: celulares na ordem das mesas, guardados depois, e o grupo Sem celular', () => {
    const { mapa, azul, vermelho } = montar();
    expect(etapasDaManutencao(mapa)).toEqual([
      { id: azul.id, titulo: 'Azul', equipe: 'OP1', hex: azul.hex },
      { id: vermelho.id, titulo: 'Vermelho', equipe: '', hex: vermelho.hex },
      { id: GRUPO_SEM_CELULAR, titulo: 'Sem celular', equipe: '', hex: null },
    ]);
    const semCelular = numerosDaEtapa(mapa, GRUPO_SEM_CELULAR);
    expect(semCelular.map((n) => n.retrato.codigo)).toEqual(['OP1-SUP', 'OP1-D3', 'OP1-D4']);
    expect(semCelular[1].alvo).toEqual({ tipo: 'lugar', salaId: mapa.salas[0].id, mesaId: mapa.salas[0].mesas[0].id, posicao: 'D3' });
    expect(numerosDaEtapa(mapa, azul.id)).toHaveLength(8);
  });

  it('ações em sequência numa vaga: caiu → análise → perdido → chip trocado', () => {
    const { mapa, azul, naE1 } = montar();
    const alvo = { tipo: 'vaga' as const, celularId: azul.id, vagaId: naE1.id };
    let m = iniciarManutencao(mapa, INICIO);
    m = aplicarAcao(m, alvo, 'BANIDO', em('09:13'));
    m = aplicarAcao(m, alvo, 'PEDIU_ANALISE', em('09:14'));
    m = aplicarAcao(m, alvo, 'PERDIDO', em('09:15'));
    m = aplicarAcao(m, alvo, 'TROCOU_CHIP', em('09:16'), { numeroNovo: '(11) 90000-0001' });
    const cel = m.celulares.find((c) => c.id === azul.id)!;
    const vaga = cel.vagas.find((v) => v.id === naE1.id)!;
    expect(estadoDaVaga(m, cel, vaga).situacao).toBe('OK');
    expect(vaga.numero).toBe('(11) 90000-0001');
    expect(m.manutencaoAtual!.acoes.map((a) => a.acao)).toEqual(['BANIDO', 'PEDIU_ANALISE', 'PERDIDO', 'TROCOU_CHIP']);
    expect(m.manutencaoAtual!.acoes[0]).toMatchObject({ codigo: 'OP1-E1', operador: 'ANA', celular: 'Azul', vaga: 'Padrão · Messenger 1', chave: `v:${azul.id}:${naE1.id}` });
    expect(m.manutencaoAtual!.acoes[3].numeroNovo).toBe('(11) 90000-0001');
  });

  it('restringir pede o tempo e guarda até quando', () => {
    const { mapa, salaId, mesaId } = montar();
    const alvo = { tipo: 'lugar' as const, salaId, mesaId, posicao: 'D3' };
    const m = aplicarAcao(iniciarManutencao(mapa, INICIO), alvo, 'RESTRINGIDO', INICIO, { restricao: { quantidade: 2, unidade: 'horas' } });
    expect(m.salas[0].mesas[0].lugares.D3.whatsapp.situacao).toBe('RESTRINGIDO');
    expect(m.manutencaoAtual!.acoes[0].ate).toBe(em('11:12').toISOString());
    expect(() => aplicarAcao(mapa, alvo, 'RESTRINGIDO', INICIO, { restricao: { quantidade: 0, unidade: 'horas' } })).toThrow();
  });

  it('sem manutenção aberta, a ação só muda a situação', () => {
    const { mapa, salaId, mesaId } = montar();
    const m = aplicarAcao(mapa, { tipo: 'lugar', salaId, mesaId, posicao: 'D3' }, 'BANIDO', INICIO);
    expect(m.salas[0].mesas[0].lugares.D3.whatsapp.situacao).toBe('BANIDO');
    expect(m.manutencaoAtual).toBeNull();
  });

  it('conferir marca e desmarca', () => {
    const { mapa, azul } = montar();
    const m = alternarConferido(iniciarManutencao(mapa, INICIO), azul.id);
    expect(m.manutencaoAtual!.conferidos).toEqual([azul.id]);
    expect(alternarConferido(m, azul.id).manutencaoAtual!.conferidos).toEqual([]);
  });
});

describe('texto do grupo', () => {
  const cenario = () => {
    const { mapa: base, azul, vermelho, naE1, salaId, mesaId } = montar();
    let mapa = alterarEstadoDaVaga(base, azul.id, naE1.id, estado('BANIDO', INICIO), INICIO);
    mapa = alterarLugarNoMapa(mapa, salaId, mesaId, 'D3', { whatsapp: pedirAnalise(INICIO) }, INICIO);
    mapa = iniciarManutencao(mapa, INICIO);
    mapa = aplicarAcao(mapa, { tipo: 'vaga', celularId: azul.id, vagaId: naE1.id }, 'PEDIU_ANALISE', em('09:20'));
    mapa = aplicarAcao(mapa, { tipo: 'lugar', salaId, mesaId, posicao: 'D3' }, 'LIBERADO', em('09:30'));
    mapa = alternarConferido(alternarConferido(mapa, azul.id), vermelho.id);
    return { mapa, azul };
  };

  it('com ações, observação e o grupo Sem celular não conferido', () => {
    const { mapa } = cenario();
    const { mapa: depois, texto } = concluirManutencao(mapa, '  Chip do Azul na gaveta ', em('09:48'));
    expect(texto).toBe(
      [
        '🔧 *REGISTRO DE MANUTENÇÃO — WHATSAPP*',
        '📅 28/10/2026 · Manhã (09:12–09:48)',
        '✅ 2 celulares conferidos · 13 WhatsApps OK',
        '',
        '*O que foi feito*',
        '📨 Pedi análise: OP1-E1 (ANA) · Azul',
        '🟢 Liberado: OP1-D3 (GABI)',
        '',
        '*Como ficou*',
        '🔎 1 em análise',
        '',
        '📱 Azul (OP1) ✅ · Vermelho ✅ · Sem celular ⬜',
        '📝 Obs: Chip do Azul na gaveta',
        '🎥 Vídeos a seguir',
      ].join('\n')
    );
    expect(depois.manutencaoAtual).toBeNull();
    expect(depois.manutencoes[depois.manutencoes.length - 1]).toMatchObject({ fim: em('09:48').toISOString(), texto, observacao: 'Chip do Azul na gaveta' });
  });

  it('sem ações, sem observação, tudo OK', () => {
    const { mapa, azul, vermelho } = montar();
    let m = iniciarManutencao(mapa, em('13:05'));
    m = alternarConferido(alternarConferido(alternarConferido(m, azul.id), vermelho.id), GRUPO_SEM_CELULAR);
    expect(textoDaManutencao(m.manutencaoAtual!, m, em('13:40'))).toBe(
      [
        '🔧 *REGISTRO DE MANUTENÇÃO — WHATSAPP*',
        '📅 28/10/2026 · Almoço (13:05–13:40)',
        '✅ 2 celulares conferidos · 14 WhatsApps OK',
        '',
        '*O que foi feito*',
        'Tudo conferido, nenhuma ação necessária.',
        '',
        '*Como ficou*',
        'Tudo OK',
        '',
        '📱 Azul (OP1) ✅ · Vermelho ✅ · Sem celular ✅',
        '🎥 Vídeos a seguir',
      ].join('\n')
    );
  });

  it('restrição, backup e vaga vazia na linha da ação; plural do "Como ficou"', () => {
    const { mapa, azul, salaId, mesaId } = montar();
    const backup = azul.vagas.find((v) => v.baia === null)!;
    let m = alterarLugarNoMapa(mapa, salaId, mesaId, 'D4', { operador: '' }, INICIO);
    m = iniciarManutencao(m, INICIO);
    m = aplicarAcao(m, { tipo: 'vaga', celularId: azul.id, vagaId: backup.id }, 'BANIDO', em('09:20'));
    m = aplicarAcao(m, { tipo: 'lugar', salaId, mesaId, posicao: 'D4' }, 'BANIDO', em('09:21'));
    m = aplicarAcao(m, { tipo: 'lugar', salaId, mesaId, posicao: 'D3' }, 'RESTRINGIDO', em('09:22'), { restricao: { quantidade: 1, unidade: 'dias' } });
    const linhas = textoDaManutencao(m.manutencaoAtual!, m, em('09:40')).split('\n');
    expect(linhas.slice(5, 8)).toEqual([
      `⛔ Caiu: ${backup.grupo} · ${backup.rotulo} · Azul`,
      '⛔ Caiu: OP1-D4 (vaga vazia)',
      '⏳ Restringido: OP1-D3 (GABI) até 29/10 09:22',
    ]);
    expect(linhas[10]).toBe('⛔ 2 banidos · ⏳ 1 restringido');
    expect(linhas[2]).toBe('✅ 0 celulares conferidos · 11 WhatsApps OK');
  });

  it('celular apagado depois da ação: o texto usa o retrato e some da linha 📱', () => {
    const { mapa, azul } = cenario();
    const semAzul = removerCelularNoMapa(mapa, azul.id, em('09:40'));
    const texto = textoDaManutencao(semAzul.manutencaoAtual!, semAzul, em('09:48'));
    expect(texto).toContain('📨 Pedi análise: OP1-E1 (ANA) · Azul');
    expect(texto).toContain('📱 Vermelho ✅ · Sem celular ⬜');
    expect(texto).toContain('✅ 1 celular conferido');
  });

  it('cancelar descarta o registro e mantém as manutenções anteriores', () => {
    const { mapa } = cenario();
    const { mapa: concluida } = concluirManutencao(mapa, '', em('09:48'));
    const outra = iniciarManutencao(concluida, em('13:00'));
    const cancelada = cancelarManutencao(outra);
    expect(cancelada.manutencaoAtual).toBeNull();
    expect(cancelada.manutencoes).toEqual(concluida.manutencoes);
  });
});

describe('revisão final', () => {
  it('linha 📱: conferidos primeiro, não conferidos no fim', () => {
    const { mapa, vermelho } = montar();
    const m = alternarConferido(iniciarManutencao(mapa, INICIO), vermelho.id);
    expect(textoDaManutencao(m.manutencaoAtual!, m, em('09:40'))).toContain('📱 Vermelho ✅ · Azul (OP1) ⬜ · Sem celular ⬜');
  });

  it('mudança feita pelo painel durante a manutenção entra no texto, sem repetir as dos botões', () => {
    const { mapa, salaId, mesaId, azul, naE1 } = montar();
    let m = iniciarManutencao(mapa, INICIO);
    const pelaTela = (mudar: (x: typeof m) => typeof m, quando: Date) => (m = gravarAlteracao(m, mudar(m), quando));
    // No app o hook grava o histórico com o próprio relógio, alguns ms depois do botão
    pelaTela((x) => aplicarAcao(x, { tipo: 'vaga', celularId: azul.id, vagaId: naE1.id }, 'BANIDO', em('09:20')), new Date(em('09:20').getTime() + 7));
    pelaTela((x) => alterarLugarNoMapa(x, salaId, mesaId, 'D3', { whatsapp: estado('BANIDO', em('09:25')) }, em('09:25')), em('09:25'));
    const linhas = textoDaManutencao(m.manutencaoAtual!, m, em('09:40')).split('\n');
    expect(linhas.slice(5, 7)).toEqual(['⛔ Caiu: OP1-E1 (ANA) · Azul', '⛔ Caiu: OP1-D3 (GABI)']);
    expect(linhas[7]).toBe('');
  });

  it('ação que não vale mais para a situação atual é ignorada (duplo clique)', () => {
    const { mapa, salaId, mesaId } = montar();
    const alvo = { tipo: 'lugar' as const, salaId, mesaId, posicao: 'D3' };
    let m = aplicarAcao(iniciarManutencao(mapa, INICIO), alvo, 'BANIDO', em('09:20'));
    m = aplicarAcao(m, alvo, 'BANIDO', em('09:20'));
    m = aplicarAcao(m, alvo, 'LIBERADO', em('09:20'));
    expect(m.manutencaoAtual!.acoes.map((a) => a.acao)).toEqual(['BANIDO']);
  });
});
