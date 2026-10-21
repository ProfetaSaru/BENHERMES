import React from 'react';
import { Metas, ResultadoUra } from '../../types/relatorioUra';
import { isoParaBr } from '../../utils/calendario';
import { CORES, colunasDoRelatorio, estiloDaCelula, textoDaCelula, EstiloCelula } from '../../utils/uraExportacao';

interface UraTabelaProps {
  resultado: ResultadoUra;
  metas: Metas;
}

const paraCss = ({ fundo, fonte, negrito }: EstiloCelula): React.CSSProperties => ({
  background: fundo ?? CORES.branco,
  color: fonte ?? '#000000',
  fontWeight: negrito ? 700 : 400,
});

/**
 * O relatório como na planilha modelo: mesmas cores, zebra, semáforo das metas
 * e setas de comparação. As cores são as da empresa, então não mudam com o tema.
 */
export const UraTabela: React.FC<UraTabelaProps> = ({ resultado, metas }) => {
  const colunas = colunasDoRelatorio(resultado.dataAnterior);

  return (
    <div className="ura-tabela-moldura">
      <div className="ura-tabela-titulo">RELATORIO DE PRODUTIVIDADE URA {isoParaBr(resultado.data)}</div>
      <div className="formatter-table-scroll">
        <table className="ura-tabela">
          <thead>
            <tr>
              <th>OPERADORES</th>
              {colunas.map((c) => (
                <th key={c.chave}>{c.titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultado.linhas.map((linha, i) => (
              <tr key={`${linha.tipo}-${linha.nome}-${i}`} className={`ura-linha-${linha.tipo}`}>
                <td style={paraCss(estiloDaCelula(linha, i, null, metas))}>{linha.nome}</td>
                {colunas.map((coluna) => (
                  <td key={coluna.chave} className="ura-numero" style={paraCss(estiloDaCelula(linha, i, coluna, metas))}>
                    {textoDaCelula(linha[coluna.chave], coluna.formato)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
