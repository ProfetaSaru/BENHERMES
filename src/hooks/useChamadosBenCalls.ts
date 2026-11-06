import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../utils/apiClient';

/** Chamado de WhatsApp aberto no BenCalls (server/integracaoBenCalls.ts) */
export interface ChamadoBenCalls {
  id: string;
  numero: string;
  codigo: string;
  situacao: string;
  whatsapp: 'BANIDO' | 'PERMANENTE' | null;
  status: 'aberto' | 'concluido' | 'cancelado';
  abertoEm: string;
  atualizadoEm: string;
}

const INTERVALO = 60_000;

/** Chamados de WhatsApp abertos no BenCalls para as mesas que a pessoa cuida (atualiza a cada minuto) */
export function useChamadosBenCalls() {
  const [chamados, setChamados] = useState<ChamadoBenCalls[]>([]);
  const [ativa, setAtiva] = useState(false);

  const atualizar = useCallback(() => {
    apiRequest<{ ativa: boolean; chamados: ChamadoBenCalls[] }>('/api/integracoes/bencalls/chamados')
      .then((r) => {
        setAtiva(!!r.ativa);
        setChamados(Array.isArray(r.chamados) ? r.chamados : []);
      })
      .catch(() => {
        // sem servidor (testes) ou sem permissão: fica sem a lista
      });
  }, []);

  useEffect(() => {
    atualizar();
    const id = window.setInterval(atualizar, INTERVALO);
    const aoVoltar = () => document.visibilityState === 'visible' && atualizar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [atualizar]);

  const dispensar = useCallback(
    (id: string) => {
      setChamados((lista) => lista.filter((c) => c.id !== id));
      void apiRequest(`/api/integracoes/bencalls/chamados/${encodeURIComponent(id)}/dispensar`, { method: 'POST' }).catch(atualizar);
    },
    [atualizar]
  );

  return { ativa, chamados, dispensar, atualizar };
}
