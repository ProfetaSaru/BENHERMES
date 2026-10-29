import { useCallback, useEffect, useRef, useState } from 'react';
import { EstadoWhatsapp, Lugar, MapaWhatsapp, Mesa } from '../types/whatsapp';
import { alterarLugarNoMapa, alterarMesaNoMapa, carregarMapa } from '../utils/whatsappBaias';
import { alterarEstadoDaVaga as alterarEstadoDaVagaNoMapa } from '../utils/celulares';
import { gravarAlteracao } from '../utils/whatsappHistorico';
import { apiRequest } from '../utils/apiClient';

/**
 * Mapa do WhatsApp das Baias sincronizado com o servidor (/api/whatsapp).
 */
export function useWhatsappBaias() {
  const [mapa, setMapa] = useState<MapaWhatsapp>(() => carregarMapa(null, new Date()));
  const [erroAoSalvar, setErroAoSalvar] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  // Carrega o mapa compartilhado do servidor ao abrir
  useEffect(() => {
    let ativo = true;
    apiRequest<{ mapa: MapaWhatsapp | null }>('/api/whatsapp')
      .then((res) => {
        if (!ativo) return;
        if (res.mapa) {
          setMapa(res.mapa);
        }
      })
      .catch(() => {
        // Ignora erro em ambiente de teste sem servidor HTTP
      });
    return () => {
      ativo = false;
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const sincronizarComServidor = useCallback((novoMapa: MapaWhatsapp, imediato = false) => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const executar = () => {
      void apiRequest('/api/whatsapp', {
        method: 'PUT',
        body: { mapa: novoMapa },
      })
        .then(() => {
          setErroAoSalvar(false);
        })
        .catch(() => {
          setErroAoSalvar(true);
        });
    };

    if (imediato) {
      executar();
    } else {
      debounceTimerRef.current = window.setTimeout(executar, 400);
    }
  }, []);

  /** Toda alteração passa por aqui: registra no histórico, poda o que tem mais de 12 meses e sincroniza no servidor */
  const gravar = useCallback(
    (mudar: (m: MapaWhatsapp) => MapaWhatsapp) =>
      setMapa((antes) => {
        const proximo = gravarAlteracao(antes, mudar(antes), new Date());
        sincronizarComServidor(proximo);
        return proximo;
      }),
    [sincronizarComServidor]
  );

  /** Mapa novo vindo das configurações (salas, mesas, celulares) */
  const substituir = useCallback((novo: MapaWhatsapp) => gravar(() => novo), [gravar]);

  /** Mapa de um arquivo (.json ou planilha): substitui tudo, histórico incluído */
  const importar = useCallback(
    (novo: MapaWhatsapp) => {
      setMapa(novo);
      sincronizarComServidor(novo, true);
    },
    [sincronizarComServidor]
  );

  const alterarLugar = useCallback(
    (salaId: string, mesaId: string, posicao: string, mudanca: Partial<Lugar>) =>
      gravar((atual) => alterarLugarNoMapa(atual, salaId, mesaId, posicao, mudanca, new Date())),
    [gravar]
  );

  const alterarMesa = useCallback(
    (salaId: string, mesaId: string, mudanca: Partial<Mesa>) =>
      gravar((atual) => alterarMesaNoMapa(atual, salaId, mesaId, (m) => ({ ...m, ...mudanca }), new Date())),
    [gravar]
  );

  /** Vaga ligada muda a situação da baia; backup muda a própria */
  const alterarEstadoDaVaga = useCallback(
    (celularId: string, vagaId: string, e: EstadoWhatsapp) =>
      gravar((atual) => alterarEstadoDaVagaNoMapa(atual, celularId, vagaId, e, new Date())),
    [gravar]
  );

  /** Qualquer operação pura sobre o mapa (celulares, salas, mesas, manutenção) */
  const alterarMapa = gravar;

  return {
    mapa,
    avisoInicial: null as string | null,
    erroAoSalvar,
    substituir,
    importar,
    alterarLugar,
    alterarMesa,
    alterarEstadoDaVaga,
    alterarMapa,
  };
}
