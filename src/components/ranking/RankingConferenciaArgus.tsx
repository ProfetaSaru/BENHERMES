import React, { useState } from 'react';
import { UserCheck, UserX, Link2 } from 'lucide-react';
import { ResultadoAtivos } from '../../utils/ranking/argusAtivos';

interface RankingConferenciaArgusProps {
  resultado: ResultadoAtivos;
  /** De onde veio a lista de ativos usada neste ranking */
  fonte: 'argus' | 'lista';
  /** Todos os operadores ativos usados (para o "é a mesma pessoa que...") */
  operadores: string[];
  onLigar: (esteira: string, argus: string) => void;
  onNaoEMesma: (esteira: string) => void;
  onIncluirSempre: (esteira: string) => void;
}

const COMO: Record<string, string> = {
  manual: 'ligado à mão',
  palavras: 'nome mais curto/longo',
  parecido: 'nome quase igual',
};

/**
 * Conferência de quem entrou e quem ficou fora pelos operadores ativos da Argus. O nome da esteira nem
 * sempre é igual ao da Argus: aqui o Admin confere as ligações automáticas e liga quem ficou de fora.
 */
export const RankingConferenciaArgus: React.FC<RankingConferenciaArgusProps> = ({
  resultado,
  fonte,
  operadores,
  onLigar,
  onNaoEMesma,
  onIncluirSempre,
}) => {
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const usados = new Set(resultado.ligacoes.map((l) => l.argus));
  const livres = operadores.filter((o) => !usados.has(o));

  if (resultado.fora.length === 0 && resultado.ligacoes.length === 0) return null;

  return (
    <div className="formatter-card">
      <div className="formatter-card-header">
        <h2 className="formatter-card-title">
          <UserCheck size={20} />
          Conferência com a Argus
        </h2>
        <div className="badge-wrapper">
          <span className="badge badge-muted">
            {resultado.ativos.length} no ranking • {resultado.fora.length} fora • {fonte === 'argus' ? 'operadores ativos agora' : 'lista salva'}
          </span>
        </div>
      </div>

      {resultado.fora.length > 0 && (
        <>
          <p className="ura-ajuda">
            <UserX size={14} /> <strong>Ficaram fora do ranking</strong> porque não achei estas pessoas entre os operadores
            ativos da Argus. Se alguém aqui está ativo com outro nome, ligue à pessoa certa e gere de novo.
          </p>
          <div className="formatter-table-scroll">
            <table className="formatter-table ranking-conferencia">
              <thead>
                <tr>
                  <th>Na esteira</th>
                  <th>É a mesma pessoa que (na Argus)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resultado.fora.map((f) => {
                  const opcoes = [...f.sugestoes, ...livres.filter((o) => !f.sugestoes.includes(o))];
                  const valor = escolha[f.esteira] ?? f.sugestoes[0] ?? '';
                  return (
                    <tr key={f.esteira}>
                      <td>{f.esteira}</td>
                      <td>
                        <select
                          className="formatter-select"
                          value={valor}
                          onChange={(e) => setEscolha((atual) => ({ ...atual, [f.esteira]: e.target.value }))}
                          aria-label={`Pessoa da Argus para ${f.esteira}`}
                        >
                          <option value="">— escolha —</option>
                          {opcoes.map((o) => (
                            <option key={o} value={o}>
                              {o}
                              {f.sugestoes.includes(o) ? ' (mesmo primeiro nome)' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="ranking-historico-acoes">
                        <button type="button" className="btn btn-secondary" disabled={!valor} onClick={() => onLigar(f.esteira, valor)}>
                          <Link2 size={14} />
                          Ligar
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => onIncluirSempre(f.esteira)}
                          title="Entra no ranking mesmo sem estar na Argus (ex.: contas DIGITAL)"
                        >
                          Incluir sempre
                        </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {resultado.ligacoes.length > 0 && (
        <>
          <p className="ura-ajuda">
            <strong>Ligados por nome diferente:</strong> confira se é a mesma pessoa.
          </p>
          <div className="formatter-table-scroll">
            <table className="formatter-table ranking-conferencia">
              <thead>
                <tr>
                  <th>Na esteira</th>
                  <th>Na Argus</th>
                  <th>Como</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resultado.ligacoes.map((l) => (
                  <tr key={l.esteira}>
                    <td>{l.esteira}</td>
                    <td>{l.argus}</td>
                    <td>{COMO[l.como]}</td>
                    <td>
                      <div className="ranking-historico-acoes">
                      <button type="button" className="btn btn-secondary" onClick={() => onNaoEMesma(l.esteira)}>
                        Não é a mesma pessoa
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
