import { useState, useEffect, useCallback, useRef } from 'react';
import { Apelido, Metas, OperadorCadastro, RegistroHistoricoUra, ResultadoUra } from '../types/relatorioUra';
import { normalizarNome } from '../utils/calendario';
import { registrarNoHistorico } from '../utils/uraCalculo';
import { ConfigArgus, URL_PADRAO_ARGUS } from '../utils/argusApi';
import { apiRequest } from '../utils/apiClient';

interface RelatorioUraArmazenado {
  cadastro: OperadorCadastro[];
  apelidos: Apelido[];
  metas: Metas;
  historico: RegistroHistoricoUra[];
}

const VAZIO: RelatorioUraArmazenado = { cadastro: [], apelidos: [], metas: {}, historico: [] };

export function useRelatorioUra() {
  const [dados, setDados] = useState<RelatorioUraArmazenado>(VAZIO);
  const [argus, setArgusState] = useState<ConfigArgus>({ token: '', url: URL_PADRAO_ARGUS });
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let ativo = true;
    apiRequest<{ dados: RelatorioUraArmazenado | null; argus: ConfigArgus | null }>('/api/relatorio-ura')
      .then((res) => {
        if (!ativo) return;
        if (res.dados) {
          setDados({
            cadastro: Array.isArray(res.dados.cadastro) ? res.dados.cadastro : [],
            apelidos: Array.isArray(res.dados.apelidos) ? res.dados.apelidos : [],
            metas: res.dados.metas && typeof res.dados.metas === 'object' ? res.dados.metas : {},
            historico: Array.isArray(res.dados.historico) ? res.dados.historico : [],
          });
        }
        if (res.argus) {
          setArgusState({
            token: String(res.argus.token ?? ''),
            url: String(res.argus.url ?? '') || URL_PADRAO_ARGUS,
          });
        }
      })
      .catch(() => {});
    return () => {
      ativo = false;
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const sincronizarDados = useCallback((proximo: RelatorioUraArmazenado, imediato = false) => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const executar = () => {
      void apiRequest('/api/relatorio-ura', {
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

  const atualizarArgus = useCallback((novoArgus: ConfigArgus) => {
    setArgusState(novoArgus);
    void apiRequest('/api/relatorio-ura', {
      method: 'PUT',
      body: { argus: novoArgus },
    }).catch(() => {});
  }, []);

  const atualizarCadastro = useCallback(
    (cadastro: OperadorCadastro[]) => {
      setDados((atual) => {
        const proximo = { ...atual, cadastro };
        sincronizarDados(proximo);
        return proximo;
      });
    },
    [sincronizarDados]
  );

  const atualizarApelidos = useCallback(
    (apelidos: Apelido[]) => {
      setDados((atual) => {
        const proximo = { ...atual, apelidos };
        sincronizarDados(proximo);
        return proximo;
      });
    },
    [sincronizarDados]
  );

  /** Liga um nome que aparece em algum sistema ao nome oficial do cadastro */
  const adicionarApelido = useCallback(
    (apelido: Apelido) => {
      setDados((atual) => {
        const proximo = {
          ...atual,
          apelidos: [
            ...atual.apelidos.filter((a) => normalizarNome(a.noSistema) !== normalizarNome(apelido.noSistema)),
            apelido,
          ],
        };
        sincronizarDados(proximo);
        return proximo;
      });
    },
    [sincronizarDados]
  );

  const atualizarMetas = useCallback(
    (metas: Metas) => {
      setDados((atual) => {
        const proximo = { ...atual, metas };
        sincronizarDados(proximo);
        return proximo;
      });
    },
    [sincronizarDados]
  );

  const salvarRelatorio = useCallback(
    (resultado: ResultadoUra) => {
      setDados((atual) => {
        const proximo = { ...atual, historico: registrarNoHistorico(atual.historico, resultado) };
        sincronizarDados(proximo);
        return proximo;
      });
    },
    [sincronizarDados]
  );

  /** Junta um histórico importado: os dias que já existem aqui são mantidos */
  const importarHistorico = useCallback(
    (importado: RegistroHistoricoUra[]): number => {
      const existentes = new Set(dados.historico.map((r) => r.data));
      const novos = importado.filter((r) => !existentes.has(r.data));
      const historico = [...dados.historico, ...novos].sort((a, b) => a.data.localeCompare(b.data));
      const proximo = { ...dados, historico };
      setDados(proximo);
      sincronizarDados(proximo, true);
      return new Set(novos.map((r) => r.data)).size;
    },
    [dados, sincronizarDados]
  );

  const removerDia = useCallback(
    (data: string) => {
      setDados((atual) => {
        const proximo = { ...atual, historico: atual.historico.filter((r) => r.data !== data) };
        sincronizarDados(proximo);
        return proximo;
      });
    },
    [sincronizarDados]
  );

  const limparHistorico = useCallback(() => {
    setDados((atual) => {
      const proximo = { ...atual, historico: [] };
      sincronizarDados(proximo);
      return proximo;
    });
  }, [sincronizarDados]);

  return {
    ...dados,
    argus,
    atualizarArgus,
    atualizarCadastro,
    atualizarApelidos,
    adicionarApelido,
    atualizarMetas,
    salvarRelatorio,
    importarHistorico,
    removerDia,
    limparHistorico,
  };
}
