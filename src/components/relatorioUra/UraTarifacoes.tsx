import React from 'react';
import { Receipt } from 'lucide-react';
import { converterValorBr } from '../../utils/uraLeitura';
import { textoDaCelula } from '../../utils/uraExportacao';

interface UraTarifacoesProps {
  /** Total de cada operadora como o Argus estimou */
  totais: { chave: string; operadora: string; arquivos: string[]; estimado: number }[];
  /** Texto digitado, pela chave de cada tarifação */
  valores: Record<string, string>;
  onChange: (chave: string, texto: string) => void;
}

const reais = (valor: number) => textoDaCelula(valor, 'reais');

/** Valor digitado já convertido; null quando vazio ou inválido */
export const valorRealDigitado = (texto: string | undefined): number | null => {
  if (!texto || !texto.trim()) return null;
  const valor = converterValorBr(texto);
  return valor > 0 ? valor : null;
};

/**
 * Valor real de cada tarifação. O Argus muitas vezes só estima o custo; com o total da
 * fatura digitado, o relatório corrige todas as linhas daquela operadora na mesma proporção.
 */
export const UraTarifacoes: React.FC<UraTarifacoesProps> = ({ totais, valores, onChange }) => {
  if (totais.length === 0) return null;

  return (
    <div className="ura-tarifacoes">
      <div className="formatter-field-label ura-tarifacoes-titulo">
        <Receipt size={16} />
        Valor real das tarifações <span>(opcional)</span>
      </div>
      <p className="ura-ajuda">
        O Argus costuma só estimar o custo. Digite o total da fatura de cada operadora: o custo de cada operador, dos robôs
        e das ligações sem derivação é corrigido na mesma proporção. Em branco, vale o valor do Argus.
      </p>
      {totais.map(({ chave, operadora, arquivos, estimado }) => {
        const texto = valores[chave] ?? '';
        const real = valorRealDigitado(texto);
        const invalido = texto.trim() !== '' && real === null;
        const diferenca = real !== null ? real - estimado : null;
        return (
          <div key={chave} className="ura-tarifacao">
            <div>
              <strong>{operadora}</strong>
              <span>{arquivos.join(', ')}</span>
            </div>
            <div className="ura-tarifacao-estimado">
              <span>Argus estimou</span>
              <strong>{reais(estimado)}</strong>
            </div>
            <label className="ura-tarifacao-real">
              <span>Valor real da fatura</span>
              <input
                type="text"
                inputMode="decimal"
                className={`formatter-select ${invalido ? 'invalido' : ''}`}
                placeholder="R$ 0,00"
                value={texto}
                onChange={(e) => onChange(chave, e.target.value)}
                aria-label={`Valor real da fatura ${operadora}`}
              />
            </label>
            <div className="ura-tarifacao-diferenca">
              {invalido ? (
                <span className="ura-dif ruim">Valor inválido</span>
              ) : diferenca !== null && Math.abs(diferenca) < 0.005 ? (
                <span className="ura-tarifacao-sem">igual ao Argus</span>
              ) : diferenca !== null ? (
                <span className="ura-dif">
                  {diferenca > 0 ? '+' : '-'}
                  {reais(Math.abs(diferenca))}
                  {estimado > 0 && ` (${diferenca > 0 ? '+' : '-'}${Math.abs((diferenca / estimado) * 100).toFixed(1).replace('.', ',')}%)`}
                </span>
              ) : (
                <span className="ura-tarifacao-sem">usando o valor do Argus</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
