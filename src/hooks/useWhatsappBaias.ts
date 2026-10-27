import { useCallback, useEffect, useState } from 'react';
import { EstadoWhatsapp, Lugar, MapaWhatsapp, Mesa } from '../types/whatsapp';
import { alterarLugarNoMapa, alterarMesaNoMapa, carregarMapa, lerMapaSalvo } from '../utils/whatsappBaias';
import { alterarEstadoDaVaga as alterarEstadoDaVagaNoMapa } from '../utils/celulares';

export const STORAGE_WHATSAPP_KEY = 'benhermes_whatsapp';

/**
 * Lê o mapa salvo. Se o que está salvo não puder ser lido, guarda uma cópia em
 * benhermes_whatsapp_backup_<data> antes de o mapa inicial ser gravado por cima.
 */
const lerDoNavegador = (): { mapa: MapaWhatsapp; aviso: string | null } => {
  try {
    const texto = localStorage.getItem(STORAGE_WHATSAPP_KEY);
    const { mapa, ilegivel } = lerMapaSalvo(texto, new Date());
    if (!ilegivel || texto === null) return { mapa, aviso: null };
    const copia = `${STORAGE_WHATSAPP_KEY}_backup_${new Date().toISOString()}`;
    localStorage.setItem(copia, texto);
    return {
      mapa,
      aviso: `Não consegui ler o mapa salvo neste navegador. Guardei uma cópia (${copia}) e abri um mapa novo; importe a planilha ou o .json para recomeçar.`,
    };
  } catch {
    return { mapa: carregarMapa(null, new Date()), aviso: null };
  }
};

/**
 * Mapa do WhatsApp das Baias guardado no navegador (benhermes_whatsapp).
 * Toda mudança salva na hora e atualiza a data do mapa.
 */
export function useWhatsappBaias() {
  const [{ mapa: inicial, aviso: avisoInicial }] = useState(lerDoNavegador);
  const [mapa, setMapa] = useState<MapaWhatsapp>(inicial);

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

  /** Vaga ligada muda a situação da baia; backup muda a própria */
  const alterarEstadoDaVaga = useCallback((celularId: string, vagaId: string, e: EstadoWhatsapp) => {
    setMapa((atual) => alterarEstadoDaVagaNoMapa(atual, celularId, vagaId, e, new Date()));
  }, []);

  /** Qualquer operação pura sobre o mapa (celulares, salas, mesas) */
  const alterarMapa = useCallback((mudar: (m: MapaWhatsapp) => MapaWhatsapp) => setMapa((atual) => mudar(atual)), []);

  return { mapa, avisoInicial, setMapa, substituir, alterarLugar, alterarMesa, alterarEstadoDaVaga, alterarMapa };
}
