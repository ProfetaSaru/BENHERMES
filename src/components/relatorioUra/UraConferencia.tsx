import React from 'react';
import { AlertTriangle, ClipboardCheck, Link2, UserX } from 'lucide-react';
import { OperadorCadastro, ResultadoUra } from '../../types/relatorioUra';
import { normalizarNome } from '../../utils/calendario';
import { textoDaCelula } from '../../utils/uraExportacao';

interface UraConferenciaProps {
  resultado: ResultadoUra;
  cadastro: OperadorCadastro[];
  onVincular: (noSistema: string, oficial: string) => void;
}

const reais = (valor: number) => textoDaCelula(valor, 'reais');

/**
 * Aba Conferência da planilha, na tela: de onde veio cada número, o que ficou de fora
 * e os avisos. Nomes sem vínculo podem ser ligados a um operador do cadastro ali mesmo.
 */
export const UraConferencia: React.FC<UraConferenciaProps> = ({ resultado, cadastro, onVincular }) => {
  const ativos = cadastro
    .filter((op) => normalizarNome(op.status) === 'ATIVO')
    .map((op) => op.nome)
    .sort();
  const semVinculo = Object.entries(resultado.semVinculo).sort();
  const exColaboradores = Object.entries(resultado.exColaboradores).sort();
  const diferenca = resultado.custoImportado - resultado.custoNoRelatorio - resultado.custoIgnorado;

  return (
    <div className="formatter-card">
      <div className="formatter-card-header">
        <h2 className="formatter-card-title">
          <ClipboardCheck size={20} />
          Conferência
        </h2>
        <div className="badge-wrapper">
          {Math.abs(diferenca) < 0.01 ? (
            <span className="badge badge-success">Custos batem com a tarifação</span>
          ) : (
            <span className="badge badge-warning">Diferença de {reais(diferenca)} nos custos</span>
          )}
        </div>
      </div>

      {resultado.avisos.map((aviso) => (
        <div key={aviso} className="escala-aviso">
          <AlertTriangle size={16} />
          {aviso}
        </div>
      ))}

      <div className="ura-conferencia-grid">
        <div>
          <h3 className="ura-subtitulo">Arquivos lidos</h3>
          <ul className="ura-lista">
            {resultado.arquivos.map((a, i) => (
              <li key={`${a.nome}-${i}`} className={a.observacao.startsWith('IGNORADO') ? 'ura-ignorado' : ''}>
                <strong>{a.nome}</strong>
                <span>
                  {a.tipo} • {a.observacao}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="ura-subtitulo">Custos</h3>
          <dl className="ura-custos">
            <dt>Importado da tarifação (sem linhas de total)</dt>
            <dd>{reais(resultado.custoImportado)}</dd>
            <dt>No relatório (operadores + sem derivação)</dt>
            <dd>{reais(resultado.custoNoRelatorio)}</dd>
            <dt>De quem está fora do cadastro (ignorado)</dt>
            <dd>{reais(resultado.custoIgnorado)}</dd>
            <dt>Robôs da URA (rateado pelos leads)</dt>
            <dd>{reais(resultado.custoRobos)}</dd>
            <dt>Ligações sem derivação p/ operador</dt>
            <dd>{reais(resultado.semDerivacao)}</dd>
            <dt>Vendas de agentes fora do cadastro (ignoradas)</dt>
            <dd>{reais(resultado.vendasIgnoradas)}</dd>
          </dl>
        </div>
      </div>

      {semVinculo.length > 0 && (
        <div>
          <h3 className="ura-subtitulo">
            <Link2 size={16} />
            Nomes sem vínculo ({semVinculo.length})
          </h3>
          <p className="ura-ajuda">
            Ficaram de fora do relatório. Se for a mesma pessoa com outra grafia, escolha o nome oficial e gere de novo.
          </p>
          <ul className="ura-lista">
            {semVinculo.map(([nome, origens]) => (
              <li key={nome} className="ura-vinculo">
                <span>
                  <strong>{nome}</strong> <span>({origens.join(', ')})</span>
                </span>
                <select
                  className="formatter-select ura-select-vinculo"
                  value=""
                  onChange={(e) => e.target.value && onVincular(nome, e.target.value)}
                  aria-label={`Vincular ${nome} a um operador do cadastro`}
                >
                  <option value="">É a mesma pessoa que...</option>
                  {ativos.map((oficial) => (
                    <option key={oficial} value={oficial}>
                      {oficial}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {exColaboradores.length > 0 && (
        <div>
          <h3 className="ura-subtitulo">
            <UserX size={16} />
            Ex-colaboradores ignorados (inativos no Argus)
          </h3>
          <p className="ura-ajuda">
            {exColaboradores.map(([nome, origens]) => `${nome} (${origens.join(', ')})`).join(' • ')}
          </p>
        </div>
      )}
    </div>
  );
};
