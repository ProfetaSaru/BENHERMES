import { useState, useEffect, useCallback } from 'react';
import { Apelido, Metas, OperadorCadastro, RegistroHistoricoUra, ResultadoUra } from '../types/relatorioUra';
import { normalizarNome } from '../utils/calendario';
import { registrarNoHistorico } from '../utils/uraCalculo';

export const STORAGE_RELATORIO_URA_KEY = 'benhermes_relatorio_ura';

/**
 * O que fica guardado no navegador: só cadastro (nome, supervisor, equipe, status),
 * apelidos, metas e os TOTAIS de cada relatório. As exportações do dia (que têm CPFs)
 * ficam apenas na memória da página e somem ao fechá-la.
 */
interface RelatorioUraArmazenado {
  cadastro: OperadorCadastro[];
  apelidos: Apelido[];
  metas: Metas;
  historico: RegistroHistoricoUra[];
}

const VAZIO: RelatorioUraArmazenado = { cadastro: [], apelidos: [], metas: {}, historico: [] };

const carregar = (): RelatorioUraArmazenado => {
  try {
    const bruto = localStorage.getItem(STORAGE_RELATORIO_URA_KEY);
    if (!bruto) return VAZIO;
    const dados = JSON.parse(bruto);
    return {
      cadastro: Array.isArray(dados?.cadastro) ? dados.cadastro : [],
      apelidos: Array.isArray(dados?.apelidos) ? dados.apelidos : [],
      metas: dados?.metas && typeof dados.metas === 'object' ? dados.metas : {},
      historico: Array.isArray(dados?.historico) ? dados.historico : [],
    };
  } catch (error) {
    console.error('Falha ao ler o relatório da URA do localStorage:', error);
    return VAZIO;
  }
};

export function useRelatorioUra() {
  const [dados, setDados] = useState<RelatorioUraArmazenado>(carregar);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_RELATORIO_URA_KEY, JSON.stringify(dados));
    } catch (error) {
      console.error('Falha ao salvar o relatório da URA no localStorage:', error);
    }
  }, [dados]);

  const atualizarCadastro = useCallback((cadastro: OperadorCadastro[]) => {
    setDados((atual) => ({ ...atual, cadastro }));
  }, []);

  const atualizarApelidos = useCallback((apelidos: Apelido[]) => {
    setDados((atual) => ({ ...atual, apelidos }));
  }, []);

  /** Liga um nome que aparece em algum sistema ao nome oficial do cadastro */
  const adicionarApelido = useCallback((apelido: Apelido) => {
    setDados((atual) => ({
      ...atual,
      apelidos: [
        ...atual.apelidos.filter((a) => normalizarNome(a.noSistema) !== normalizarNome(apelido.noSistema)),
        apelido,
      ],
    }));
  }, []);

  const atualizarMetas = useCallback((metas: Metas) => {
    setDados((atual) => ({ ...atual, metas }));
  }, []);

  const salvarRelatorio = useCallback((resultado: ResultadoUra) => {
    setDados((atual) => ({ ...atual, historico: registrarNoHistorico(atual.historico, resultado) }));
  }, []);

  /** Junta um histórico importado: os dias que já existem aqui são mantidos */
  const importarHistorico = useCallback(
    (importado: RegistroHistoricoUra[]): number => {
      const existentes = new Set(dados.historico.map((r) => r.data));
      const novos = importado.filter((r) => !existentes.has(r.data));
      // sort é estável: dentro do mesmo dia, a ordem das linhas é mantida
      const historico = [...dados.historico, ...novos].sort((a, b) => a.data.localeCompare(b.data));
      setDados({ ...dados, historico });
      return new Set(novos.map((r) => r.data)).size;
    },
    [dados]
  );

  const removerDia = useCallback((data: string) => {
    setDados((atual) => ({ ...atual, historico: atual.historico.filter((r) => r.data !== data) }));
  }, []);

  const limparHistorico = useCallback(() => {
    setDados((atual) => ({ ...atual, historico: [] }));
  }, []);

  return {
    ...dados,
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
