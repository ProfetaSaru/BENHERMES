import { useCallback, useEffect, useState } from 'react';
import { ConfigRanking, ProvedorComentarios, RegistroRanking, StatusIa } from '../types/ranking';
import type { Descricao } from '../../server/ranking/frases';
import { apiRequest } from '../utils/apiClient';

/** Configuração, histórico e IAs do ranking, guardados no servidor (rotas só do Admin) */
export function useRanking() {
  const [config, setConfig] = useState<ConfigRanking | null>(null);
  const [historico, setHistorico] = useState<RegistroRanking[]>([]);
  const [statusIa, setStatusIa] = useState<StatusIa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDeCarga, setErroDeCarga] = useState('');

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
        setHistorico(Array.isArray(h.historico) ? h.historico : []);
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

  const gravarHistorico = useCallback(async (lista: RegistroRanking[]): Promise<string> => {
    try {
      const r = await apiRequest<{ historico: RegistroRanking[] }>('/api/ranking/historico', { method: 'PUT', body: { historico: lista } });
      setHistorico(r.historico);
      return '';
    } catch (err: any) {
      return err?.message || 'Não foi possível salvar o histórico.';
    }
  }, []);

  /** Mesma data substitui o registro anterior (a confirmação é da tela) */
  const salvarNoHistorico = useCallback(
    (registro: RegistroRanking) => gravarHistorico([registro, ...historico.filter((h) => h.dia !== registro.dia && h.id !== registro.id)]),
    [gravarHistorico, historico]
  );

  const removerDoHistorico = useCallback((id: string) => gravarHistorico(historico.filter((h) => h.id !== id)), [gravarHistorico, historico]);

  const pedirComentarios = useCallback(
    (entrada: { vendedores: Descricao[]; supervisores: Descricao[] }) =>
      apiRequest<{ vendedores: string[]; supervisores: string[]; provedor: ProvedorComentarios; avisos: string[] }>(
        '/api/ranking/comentarios',
        { method: 'POST', body: entrada }
      ),
    []
  );

  return { config, salvarConfig, historico, salvarNoHistorico, removerDoHistorico, statusIa, carregando, erroDeCarga, pedirComentarios };
}
