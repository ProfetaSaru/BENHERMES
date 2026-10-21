import { useState, useEffect, useCallback } from 'react';
import { FeriadoLocal } from '../utils/calendario';

export const STORAGE_FERIADOS_KEY = 'benhermes_feriados';

const carregar = (): FeriadoLocal[] => {
  try {
    const dados = JSON.parse(localStorage.getItem(STORAGE_FERIADOS_KEY) ?? '[]');
    return Array.isArray(dados) ? dados.filter((f) => f && typeof f.data === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * Feriados locais (estaduais, municipais e pontos facultativos), guardados no navegador.
 * Valem para a Escala de Bases e para o Relatório URA (dia útil anterior e avisos).
 */
export function useFeriados() {
  const [feriados, setFeriados] = useState<FeriadoLocal[]>(carregar);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FERIADOS_KEY, JSON.stringify(feriados));
    } catch (error) {
      console.error('Falha ao salvar os feriados no localStorage:', error);
    }
  }, [feriados]);

  /** Inclui (ou troca a descrição de) um feriado, mantendo a lista em ordem de data */
  const adicionar = useCallback((novo: FeriadoLocal) => {
    setFeriados((atuais) =>
      [...atuais.filter((f) => f.data !== novo.data), novo].sort((a, b) => a.data.localeCompare(b.data))
    );
  }, []);

  const remover = useCallback((data: string) => {
    setFeriados((atuais) => atuais.filter((f) => f.data !== data));
  }, []);

  return { feriados, adicionar, remover };
}
