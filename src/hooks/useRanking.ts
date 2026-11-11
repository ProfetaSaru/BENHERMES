import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfigRanking, ProvedorComentarios, RegistroRanking, StatusIa } from '../types/ranking';
import type { Descricao } from '../../server/ranking/frases';
import { apiRequest } from '../utils/apiClient';
import { criarHistoricoRanking } from './rankingHistorico';

/** Configuração, histórico e IAs do ranking, guardados no servidor (rotas só do Admin) */
export function useRanking() {
  const [config, setConfig] = useState<ConfigRanking | null>(null);
  const [historico, setHistorico] = useState<RegistroRanking[]>([]);
  const [statusIa, setStatusIa] = useState<StatusIa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDeCarga, setErroDeCarga] = useState('');
  // Gravações do histórico em fila, sempre sobre a lista mais recente (ver rankingHistorico.ts)
  const historicoRef = useRef(
    criarHistoricoRanking(
      [],
      async (lista) =>
        (await apiRequest<{ historico: RegistroRanking[] }>('/api/ranking/historico', { method: 'PUT', body: { historico: lista } })).historico,
      setHistorico
    )
  );

  useEffect(() => {
    let ativo = true;
    Promise.all([
      apiRequest<{ config: ConfigRanking | null }>('/api/ranking/config'),
      apiRequest<{ historico: RegistroRanking[] }>('/api/ranking/historico'),
      apiRequest<StatusIa>('/api/ranking/ia'),
    ])
      .then(([c, h, ia]) => {
        if (!ativo) return;
        setConfig(c.config ?? null);
        historicoRef.current.definir(Array.isArray(h.historico) ? h.historico : []);
        setStatusIa(ia);
      })
      .catch((err: any) => {
        if (ativo) setErroDeCarga(err?.message || 'Não foi possível falar com o servidor.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  /** Devolve a mensagem de erro (o que está na tela não se perde) ou '' quando salvou */
  const salvarConfig = useCallback(async (nova: ConfigRanking): Promise<string> => {
    try {
      const r = await apiRequest<{ config: ConfigRanking }>('/api/ranking/config', { method: 'PUT', body: { config: nova } });
      setConfig(r.config);
      return '';
    } catch (err: any) {
      return err?.message || 'Não foi possível salvar a configuração.';
    }
  }, []);

  /** Devolvem '' quando gravou ou a mensagem de erro. Mesma data substitui (a confirmação é da tela) */
  const salvarNoHistorico = useCallback((registro: RegistroRanking) => historicoRef.current.salvar(registro), []);
  const removerDoHistorico = useCallback((id: string) => historicoRef.current.remover(id), []);
  const atualizarNoHistorico = useCallback(
    (id: string, mudancas: Partial<RegistroRanking>) => historicoRef.current.atualizar(id, mudancas),
    []
  );

  const pedirComentarios = useCallback(
    (entrada: { vendedores: Descricao[]; supervisores: Descricao[] }) =>
      apiRequest<{ vendedores: string[]; supervisores: string[]; provedor: ProvedorComentarios; avisos: string[] }>(
        '/api/ranking/comentarios',
        { method: 'POST', body: entrada }
      ),
    []
  );

  return { config, salvarConfig, historico, salvarNoHistorico, removerDoHistorico, atualizarNoHistorico, statusIa, carregando, erroDeCarga, pedirComentarios };
}
