import { describe, expect, it } from 'vitest';
import { RegistroRanking } from '../types/ranking';
import { criarHistoricoRanking } from './rankingHistorico';

const registro = (id: string, dia: string, legenda = 'L0'): RegistroRanking =>
  ({ id, dia, geradoEm: `${dia}T09:00:00.000Z`, geradoPor: 'admin', provedor: 'frases', relatorio: {} as any, legenda });

/** Servidor falso: guarda o que recebe e responde quando o teste mandar */
const servidorLento = () => {
  const pendentes: (() => void)[] = [];
  let salvo: RegistroRanking[] = [];
  const gravar = (lista: RegistroRanking[]) =>
    new Promise<RegistroRanking[]>((resolve) => pendentes.push(() => resolve((salvo = lista))));
  const responder = async () => {
    while (pendentes.length === 0) await new Promise((r) => setTimeout(r, 0));
    pendentes.shift()!();
  };
  return { gravar, responder, salvo: () => salvo };
};

describe('histórico do ranking (Review final #5: atualizações que se perdiam)', () => {
  it('apagar enquanto o Gerar espera a IA: o apagado não volta', async () => {
    const srv = servidorLento();
    const h = criarHistoricoRanking([registro('a', '2026-11-09'), registro('b', '2026-11-10')], srv.gravar, () => {});
    const apagando = h.remover('a');
    await srv.responder();
    await apagando;
    const salvando = h.salvar(registro('c', '2026-11-11'));
    await srv.responder();
    await salvando;
    expect(srv.salvo().map((r) => r.id)).toEqual(['c', 'b']);
  });

  it('Refazer comentários termina depois do Copiar: a legenda copiada continua', async () => {
    const srv = servidorLento();
    const h = criarHistoricoRanking([registro('a', '2026-11-11')], srv.gravar, () => {});
    const copiando = h.atualizar('a', { legenda: 'L1' });
    await srv.responder();
    await copiando;
    const refazendo = h.atualizar('a', { provedor: 'claude' });
    await srv.responder();
    await refazendo;
    expect(srv.salvo()[0]).toMatchObject({ legenda: 'L1', provedor: 'claude' });
  });

  it('duas gravações ao mesmo tempo saem em fila, cada uma sobre a anterior', async () => {
    const srv = servidorLento();
    const h = criarHistoricoRanking([registro('a', '2026-11-11')], srv.gravar, () => {});
    const um = h.atualizar('a', { legenda: 'L1' });
    const dois = h.atualizar('a', { provedor: 'claude' });
    await srv.responder();
    await srv.responder();
    await Promise.all([um, dois]);
    expect(srv.salvo()[0]).toMatchObject({ legenda: 'L1', provedor: 'claude' });
  });

  it('mesma data substitui; falha devolve a mensagem e mantém a lista', async () => {
    const mudancas: RegistroRanking[][] = [];
    const h = criarHistoricoRanking([registro('a', '2026-11-11')], async (l) => l, (l) => mudancas.push(l));
    expect(await h.salvar(registro('b', '2026-11-11'))).toBe('');
    expect(h.lista().map((r) => r.id)).toEqual(['b']);
    const falho = criarHistoricoRanking([registro('a', '2026-11-11')], async () => { throw new Error('fora do ar'); }, () => {});
    expect(await falho.salvar(registro('b', '2026-11-12'))).toBe('fora do ar');
    expect(falho.lista().map((r) => r.id)).toEqual(['a']);
    expect(mudancas).toHaveLength(1);
  });
});
