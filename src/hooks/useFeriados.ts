import { useState, useEffect, useCallback } from 'react';
import { FeriadoLocal } from '../utils/calendario';
import { apiRequest } from '../utils/apiClient';

/**
 * Feriados locais (estaduais, municipais e pontos facultativos), sincronizados com o servidor (/api/feriados).
 */
export function useFeriados() {
  const [feriados, setFeriados] = useState<FeriadoLocal[]>([]);

  useEffect(() => {
    let ativo = true;
    apiRequest<{ feriados: FeriadoLocal[] }>('/api/feriados')
      .then((res) => {
        if (ativo && Array.isArray(res.feriados)) {
          setFeriados(res.feriados);
        }
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  const sincronizar = useCallback((lista: FeriadoLocal[]) => {
    void apiRequest('/api/feriados', {
      method: 'PUT',
      body: { feriados: lista },
    }).catch(() => {});
  }, []);

  /** Inclui (ou troca a descrição de) um feriado, mantendo a lista em ordem de data */
  const adicionar = useCallback(
    (novo: FeriadoLocal) => {
      setFeriados((atuais) => {
        const proximo = [...atuais.filter((f) => f.data !== novo.data), novo].sort((a, b) =>
          a.data.localeCompare(b.data)
        );
        sincronizar(proximo);
        return proximo;
      });
    },
    [sincronizar]
  );

  const remover = useCallback(
    (data: string) => {
      setFeriados((atuais) => {
        const proximo = atuais.filter((f) => f.data !== data);
        sincronizar(proximo);
        return proximo;
      });
    },
    [sincronizar]
  );

  return { feriados, adicionar, remover };
}
