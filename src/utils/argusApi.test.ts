import { afterEach, describe, expect, it, vi } from 'vitest';
import { baixarDoArgus, diagnosticoLeads, formatarTempo, mediaPonderada } from './argusApi';

// API do Argus SIMULADA: nada sai para a internet. Nomes fictícios.
const sessao = (data: string, nome: string, tma: number, tme: number, qtde: number) => ({
  data,
  idCampanha: 1,
  idGrupoUsuario: 3,
  nomeUsuario: nome,
  qtdeAtendimentoAutomatico: qtde,
  qtdeAtendimentoManual: 0,
  qtdeAtendimentoTotal: qtde,
  tempoMedioEspera: tme,
  tempoMedioAtendimento: tma,
});

const GERAL = [
  sessao('2026-10-20T00:00:00', 'ANA ALVES', 120, 60, 10),
  sessao('2026-10-20T00:00:00', 'ANA ALVES', 60, 30, 30),
  sessao('2026-10-19T00:00:00', 'ANA ALVES', 999, 999, 12), // sessão de outro dia
  sessao('20/10/2026', 'BRUNO BRITO', 67, 113, 5),
  sessao('2026-10-20T00:00:00', 'OPER VIRTUAL 1', 10, 10, 265), // robôs
  sessao('2026-10-20T00:00:00', 'OPERADOR VIRTUAL - DTMF', 10, 10, 938),
];

const pedidos: { caminho: string; corpo: any; token: string }[] = [];

const apiFalsa = (status = 200) =>
  vi.fn(async (url: string, opcoes: RequestInit) => {
    const caminho = decodeURIComponent(url.split('caminho=')[1]);
    const corpo = JSON.parse(String(opcoes.body));
    pedidos.push({ caminho, corpo, token: (opcoes.headers as Record<string, string>)['X-Argus-Token'] });
    const resposta = (dados: object) => ({ ok: status < 400, status, json: async () => (status < 400 ? { codStatus: 1, ...dados } : { erro: 'O Argus recusou o acesso (403).' }) });
    if (caminho === 'cmd/listarusuarios') {
      return resposta({ usuarios: [{ idUsuario: 1, nome: 'ANA ALVES', ativo: true, campanhas: [{ grupoUsuarioDesc: 'URA', nomeUsuarioSupervisor: 'JOANA SOUSA' }] }] });
    }
    if (caminho === 'cmd/listargrupos') return resposta({ grupos: [{ idGrupoUsuario: 7, grupoUsuarioDesc: 'RECEPTIVO - URA', idCampanha: 1 }] });
    return resposta({ desempenhosResumidos: corpo.idGrupoUsuario ? [sessao('2026-10-20T00:00:00', 'BRUNO BRITO', 1, 1, 2)] : GERAL });
  });

afterEach(() => {
  vi.unstubAllGlobals();
  pedidos.length = 0;
});

const config = { token: 'tok-teste', url: '' };

describe('download pela API do Argus', () => {
  it('leads e TMA/TMO pelo desempenho geral do dia, sem robôs e sem sessões de outro dia', async () => {
    vi.stubGlobal('fetch', apiFalsa());
    const arquivos = await baixarDoArgus('2026-10-20', config);
    const linhas = (tipo: string) => arquivos.find((a) => a.tipo === tipo)!.linhas.map((l) => Object.values(l).join(' / '));

    // ANA: TMA = (120*10 + 60*30) / 40 = 75 s; TME = 37,5 s -> 38 s
    expect(linhas('desempenho')).toEqual(['20/10/2026 / ANA ALVES / JOANA SOUSA / 00:00:38 / 00:01:15', '20/10/2026 / BRUNO BRITO /  / 00:01:53 / 00:01:07']);
    expect(linhas('leads')).toEqual(['20/10/2026 / ANA ALVES / JOANA SOUSA / 40', '20/10/2026 / BRUNO BRITO /  / 5']);
    expect(linhas('operadores')).toEqual(['1 / ANA ALVES / URA / JOANA SOUSA / ATIVO']);
  });

  it('pede o desempenho do dia sem filtro de grupo e manda o token', async () => {
    vi.stubGlobal('fetch', apiFalsa());
    await baixarDoArgus('2026-10-20', config);
    const desempenho = pedidos.filter((p) => p.caminho === 'report/desempenhoresumido');
    expect(desempenho.map((p) => p.corpo)).toEqual([
      { periodoInicial: '2026-10-20T00:00:00-03:00', periodoFinal: '2026-10-20T23:59:59-03:00' },
    ]);
    expect(pedidos.every((p) => p.token === 'tok-teste')).toBe(true);
  });

  it('sem token ou com token recusado: mensagem clara', async () => {
    await expect(baixarDoArgus('2026-10-20', { token: ' ', url: '' })).rejects.toThrow('token');
    vi.stubGlobal('fetch', apiFalsa(403));
    await expect(baixarDoArgus('2026-10-20', config)).rejects.toThrow('403');
  });

  it('diagnóstico compara o relatório com o filtro antigo, sem os robôs', async () => {
    vi.stubGlobal('fetch', apiFalsa());
    const csv = await diagnosticoLeads('2026-10-20', config);
    expect(csv).toContain('ANA ALVES;40;52;40;0;0;3;');
    expect(csv).toContain('BRUNO BRITO;5;5;5;0;2;1;');
    expect(csv).not.toContain('OPER VIRTUAL');
  });
});

describe('funções auxiliares', () => {
  it('média ponderada e tempo', () => {
    expect(mediaPonderada([[60, 10], [30, 30]])).toBe(37.5);
    expect(mediaPonderada([[38, 0], [40, 0]])).toBe(39); // sem peso: média simples
    expect(formatarTempo(64)).toBe('00:01:04');
    expect(formatarTempo('00:02:00')).toBe('00:02:00');
  });
});
