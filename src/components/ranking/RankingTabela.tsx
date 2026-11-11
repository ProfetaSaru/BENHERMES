import React from 'react';
import { LinhaRanking, RelatorioRanking } from '../../types/ranking';

interface RankingTabelaProps {
  relatorio: RelatorioRanking;
}

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const porcento = (v: number) => `${Math.round(v * 100)}%`;
const inteiro = (v: number) => Math.round(v).toLocaleString('pt-BR');

/** Mesma regra de cor da planilha: azul ≥ 100%, verde ≥ 70%, preto abaixo */
const classeDoDesempenho = (p: number) => (p >= 1 ? 'ranking-azul' : p >= 0.7 ? 'ranking-verde' : 'ranking-preto');

const Cabecalho: React.FC<{ projecao: string }> = ({ projecao }) => (
  <thead>
    <tr>
      <th>RANKING</th>
      <th>NOME</th>
      <th>PORTABILIDADE</th>
      <th>PROJETANDO</th>
      <th>POTENCIAL DE GANHOS</th>
      <th>MARGEM/CARTÃO</th>
      <th>ANDAMENTO</th>
      <th>{projecao}</th>
      <th>ELEGÍVEL AO BÔNUS</th>
      <th>FEEDBACK</th>
    </tr>
  </thead>
);

const Linha: React.FC<{ l: LinhaRanking }> = ({ l }) => (
  <tr className={classeDoDesempenho(l.projetando)}>
    <td className="ranking-centro">{l.posicao}</td>
    <td className="ranking-nome">{l.nome}</td>
    <td className="ranking-valor">{reais.format(l.portabilidade)}</td>
    <td className="ranking-centro">{porcento(l.projetando)}</td>
    <td className="ranking-valor">{reais.format(l.potencial)}</td>
    <td className="ranking-centro">{inteiro(l.margemCartao)}</td>
    <td className="ranking-valor">{reais.format(l.andamento)}</td>
    <td className="ranking-valor">{reais.format(l.projecao)}</td>
    <td className={`ranking-centro ranking-elegivel ${l.elegivel ? 'sim' : 'nao'}`}>{l.elegivel ? 'SIM' : 'NÃO'}</td>
    <td className="ranking-feedback">{l.feedback}</td>
  </tr>
);

/**
 * Prévia das duas tabelas e do Total Geral com o visual da aba RELATORIO. As cores são as da planilha,
 * então não mudam com o tema.
 */
export const RankingTabela: React.FC<RankingTabelaProps> = ({ relatorio }) => {
  const t = relatorio.total;
  return (
    <div className="ranking-moldura">
      <div className="formatter-table-scroll">
        <table className="ranking-tabela">
          <caption className="ranking-titulo">{relatorio.tituloVendedor}</caption>
          <Cabecalho projecao={relatorio.cabecalhoProjecao} />
          <tbody>
            {relatorio.vendedores.map((l, i) => (
              <Linha key={`v-${i}`} l={l} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="formatter-table-scroll">
        <table className="ranking-tabela">
          <caption className="ranking-titulo">{relatorio.tituloSupervisor}</caption>
          <Cabecalho projecao={relatorio.cabecalhoProjecao} />
          <tbody>
            {relatorio.supervisores.map((l, i) => (
              <Linha key={`s-${i}`} l={l} />
            ))}
            <tr className="ranking-total">
              <td className="ranking-centro">-</td>
              <td className="ranking-nome">Total Geral</td>
              <td className="ranking-valor">{reais.format(t.portabilidade)}</td>
              <td className="ranking-centro">{porcento(t.projetando)}</td>
              <td className="ranking-valor">{reais.format(t.potencial)}</td>
              <td className="ranking-centro">{inteiro(t.margemCartao)}</td>
              <td className="ranking-valor">{reais.format(t.andamento)}</td>
              <td className="ranking-valor">{reais.format(t.projecao)}</td>
              <td className="ranking-centro">{t.elegiveis}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
