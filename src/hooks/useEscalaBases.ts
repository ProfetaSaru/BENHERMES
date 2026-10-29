import { useState, useEffect, useCallback, useRef } from 'react';
import { EscalaCadastro, EscalaRegistro, ImportacaoEscala, ResultadoSorteio } from '../types/escala';
import { mesclarHistorico, registrarSorteio } from '../utils/escalaBases';
import { apiRequest } from '../utils/apiClient';

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

/**
 * Cadastro (bases e pessoas) e histórico de sorteios da escala do Ativo 2,
 * sincronizados no servidor (/api/escala).
 */
export function useEscalaBases() {
  const [dados, setDados] = useState<EscalaArmazenada>(VAZIO);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let ativo = true;
    apiRequest<{ dados: EscalaArmazenada | null }>('/api/escala')
      .then((res) => {
        if (!ativo || !res.dados) return;
        const d = res.dados;
        setDados({
          cadastro: {
            bases: Array.isArray(d.cadastro?.bases) ? d.cadastro.bases : [],
            pessoas: Array.isArray(d.cadastro?.pessoas) ? d.cadastro.pessoas : [],
          },
          historico: Array.isArray(d.historico) ? d.historico : [],
          resultados: d.resultados && typeof d.resultados === 'object' ? d.resultados : {},
        });
      })
      .catch(() => {});
    return () => {
      ativo = false;
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const sincronizar = useCallback((proximo: EscalaArmazenada, imediato = false) => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const executar = () => {
      void apiRequest('/api/escala', {
        method: 'PUT',
        body: { dados: proximo },
      }).catch(() => {});
    };

    if (imediato) {
      executar();
    } else {
      debounceTimerRef.current = window.setTimeout(executar, 400);
    }
  }, []);

  const atualizarCadastro = useCallback(
    (cadastro: Partial<EscalaCadastro>) => {
      setDados((atual) => {
        const proximo = { ...atual, cadastro: { ...atual.cadastro, ...cadastro } };
        sincronizar(proximo);
        return proximo;
      });
    },
    [sincronizar]
  );

  const salvarSorteio = useCallback(
    (resultado: ResultadoSorteio) => {
      setDados((atual) => {
        const proximo = {
          ...atual,
          historico: registrarSorteio(atual.historico, resultado),
          resultados: podarResultados({ ...atual.resultados, [resultado.data]: resultado }),
        };
        sincronizar(proximo);
        return proximo;
      });
    },
    [sincronizar]
  );

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

      const proximo = {
        ...dados,
        cadastro: cadastroValido ? importacao.cadastro! : dados.cadastro,
        historico,
      };
      setDados(proximo);
      sincronizar(proximo, true);
      return diasNovos;
    },
    [dados, sincronizar]
  );

  const removerSorteio = useCallback(
    (data: string) => {
      setDados((atual) => {
        const { [data]: _removido, ...resultados } = atual.resultados;
        const proximo = {
          ...atual,
          historico: atual.historico.filter((r) => r.data !== data),
          resultados,
        };
        sincronizar(proximo);
        return proximo;
      });
    },
    [sincronizar]
  );

  const limparHistorico = useCallback(() => {
    setDados((atual) => {
      const proximo = { ...atual, historico: [], resultados: {} };
      sincronizar(proximo);
      return proximo;
    });
  }, [sincronizar]);

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
