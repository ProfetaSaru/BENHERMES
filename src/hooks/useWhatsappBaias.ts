import { useCallback, useEffect, useState } from 'react';
import { EstadoWhatsapp, Lugar, MapaWhatsapp, Mesa } from '../types/whatsapp';
import { alterarLugarNoMapa, alterarMesaNoMapa, carregarMapa, lerMapaSalvo } from '../utils/whatsappBaias';
import { alterarEstadoDaVaga as alterarEstadoDaVagaNoMapa } from '../utils/celulares';
import { gravarAlteracao } from '../utils/whatsappHistorico';

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
 * Toda mudança salva na hora e entra no histórico (gravarAlteracao); importar substitui o mapa
 * inteiro, com o histórico do arquivo, sem registrar nada.
 */
export function useWhatsappBaias() {
  const [{ mapa: inicial, aviso: avisoInicial }] = useState(lerDoNavegador);
  const [mapa, setMapa] = useState<MapaWhatsapp>(inicial);
  const [erroAoSalvar, setErroAoSalvar] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_WHATSAPP_KEY, JSON.stringify(mapa));
      setErroAoSalvar(false);
    } catch (error) {
      console.error('Falha ao salvar o mapa do WhatsApp no localStorage:', error);
      setErroAoSalvar(true);
    }
  }, [mapa]);

  /** Toda alteração passa por aqui: registra no histórico e poda o que tem mais de 12 meses */
  const gravar = useCallback(
    (mudar: (m: MapaWhatsapp) => MapaWhatsapp) => setMapa((antes) => gravarAlteracao(antes, mudar(antes), new Date())),
    []
  );

  /** Mapa novo vindo das configurações (salas, mesas, celulares) */
  const substituir = useCallback((novo: MapaWhatsapp) => gravar(() => novo), [gravar]);

  /** Mapa de um arquivo (.json ou planilha): substitui tudo, histórico incluído */
  const importar = useCallback((novo: MapaWhatsapp) => setMapa(novo), []);

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

  return { mapa, avisoInicial, erroAoSalvar, substituir, importar, alterarLugar, alterarMesa, alterarEstadoDaVaga, alterarMapa };
}
