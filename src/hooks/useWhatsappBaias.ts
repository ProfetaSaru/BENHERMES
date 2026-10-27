import { useCallback, useEffect, useState } from 'react';
import { EstadoWhatsapp, Lugar, MapaWhatsapp, Mesa } from '../types/whatsapp';
import {
  alterarCelularNoMapa,
  alterarLugarNoMapa,
  alterarMesaNoMapa,
  carregarMapa,
} from '../utils/whatsappBaias';

export const STORAGE_WHATSAPP_KEY = 'benhermes_whatsapp';

const lerDoNavegador = (): MapaWhatsapp => {
  try {
    return carregarMapa(localStorage.getItem(STORAGE_WHATSAPP_KEY), new Date());
  } catch {
    return carregarMapa(null, new Date());
  }
};

/**
 * Mapa do WhatsApp das Baias guardado no navegador (benhermes_whatsapp).
 * Toda mudança salva na hora e atualiza a data do mapa.
 */
export function useWhatsappBaias() {
  const [mapa, setMapa] = useState<MapaWhatsapp>(lerDoNavegador);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_WHATSAPP_KEY, JSON.stringify(mapa));
    } catch (error) {
      console.error('Falha ao salvar o mapa do WhatsApp no localStorage:', error);
    }
  }, [mapa]);

  const substituir = useCallback((novo: MapaWhatsapp) => setMapa(novo), []);

  const alterarLugar = useCallback((salaId: string, mesaId: string, posicao: string, mudanca: Partial<Lugar>) => {
    setMapa((atual) => alterarLugarNoMapa(atual, salaId, mesaId, posicao, mudanca, new Date()));
  }, []);

  const alterarMesa = useCallback((salaId: string, mesaId: string, mudanca: Partial<Mesa>) => {
    setMapa((atual) => alterarMesaNoMapa(atual, salaId, mesaId, (m) => ({ ...m, ...mudanca }), new Date()));
  }, []);

  const alterarCelular = useCallback((cor: string, campo: 'messenger' | 'business', e: EstadoWhatsapp) => {
    setMapa((atual) => alterarCelularNoMapa(atual, cor, campo, e, new Date()));
  }, []);

  return { mapa, setMapa, substituir, alterarLugar, alterarMesa, alterarCelular };
}
