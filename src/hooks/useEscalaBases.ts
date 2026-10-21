import { useState, useEffect, useCallback } from 'react';
import { EscalaCadastro, EscalaRegistro, ImportacaoEscala, ResultadoSorteio } from '../types/escala';
import { mesclarHistorico, registrarSorteio } from '../utils/escalaBases';

export const STORAGE_ESCALA_KEY = 'benhermes_escala_bases';

/** Quantos resultados completos (com ausentes e avisos) ficam guardados */
const RESULTADOS_GUARDADOS = 30;

interface EscalaArmazenada {
  cadastro: EscalaCadastro;
  historico: EscalaRegistro[];
  resultados: Record<string, ResultadoSorteio>;
}

const VAZIO: EscalaArmazenada = { cadastro: { bases: [], pessoas: [] }, historico: [], resultados: {} };

/** Mantém só os resultados das datas mais recentes */
const podarResultados = (resultados: Record<string, ResultadoSorteio>): Record<string, ResultadoSorteio> => {
  const datas = Object.keys(resultados).sort().reverse().slice(0, RESULTADOS_GUARDADOS);
  return Object.fromEntries(datas.map((d) => [d, resultados[d]]));
};

const carregar = (): EscalaArmazenada => {
  try {
    const bruto = localStorage.getItem(STORAGE_ESCALA_KEY);
    if (!bruto) return VAZIO;
    const dados = JSON.parse(bruto);
    if (!dados || !Array.isArray(dados.historico) || !dados.cadastro) return VAZIO;
    return {
      cadastro: {
        bases: Array.isArray(dados.cadastro.bases) ? dados.cadastro.bases : [],
        pessoas: Array.isArray(dados.cadastro.pessoas) ? dados.cadastro.pessoas : [],
      },
      historico: dados.historico,
      resultados: dados.resultados && typeof dados.resultados === 'object' ? dados.resultados : {},
    };
  } catch (error) {
    console.error('Falha ao ler a escala de bases do localStorage:', error);
    return VAZIO;
  }
};

/**
 * Cadastro (bases e pessoas) e histórico de sorteios da escala do Ativo 2,
 * guardados apenas no navegador (localStorage).
 */
export function useEscalaBases() {
  const [dados, setDados] = useState<EscalaArmazenada>(carregar);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ESCALA_KEY, JSON.stringify(dados));
    } catch (error) {
      console.error('Falha ao salvar a escala de bases no localStorage:', error);
    }
  }, [dados]);

  const atualizarCadastro = useCallback((cadastro: Partial<EscalaCadastro>) => {
    setDados((atual) => ({ ...atual, cadastro: { ...atual.cadastro, ...cadastro } }));
  }, []);

  const salvarSorteio = useCallback((resultado: ResultadoSorteio) => {
    setDados((atual) => ({
      ...atual,
      historico: registrarSorteio(atual.historico, resultado),
      resultados: podarResultados({ ...atual.resultados, [resultado.data]: resultado }),
    }));
  }, []);

  /**
   * Aplica uma importação. O cadastro só é trocado se vier preenchido;
   * do histórico, entram apenas os dias que ainda não existem.
   * Devolve quantos dias novos entraram.
   */
  const importar = useCallback(
    (importacao: ImportacaoEscala): number => {
      const { historico, diasNovos } = mesclarHistorico(dados.historico, importacao.registros);
      const cadastroValido =
        importacao.cadastro && (importacao.cadastro.bases.length > 0 || importacao.cadastro.pessoas.length > 0);

      setDados({ ...dados, cadastro: cadastroValido ? importacao.cadastro! : dados.cadastro, historico });
      return diasNovos;
    },
    [dados]
  );

  const removerSorteio = useCallback((data: string) => {
    setDados((atual) => {
      const { [data]: _removido, ...resultados } = atual.resultados;
      return { ...atual, historico: atual.historico.filter((r) => r.data !== data), resultados };
    });
  }, []);

  const limparHistorico = useCallback(() => {
    setDados((atual) => ({ ...atual, historico: [], resultados: {} }));
  }, []);

  return {
    cadastro: dados.cadastro,
    historico: dados.historico,
    resultados: dados.resultados,
    atualizarCadastro,
    salvarSorteio,
    importar,
    removerSorteio,
    limparHistorico,
  };
}
