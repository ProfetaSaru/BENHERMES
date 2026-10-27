import React, { useState } from 'react';
import { BellRing } from 'lucide-react';
import { Alerta, AlvoAlerta } from '../../utils/whatsappAlertas';
import { tempoDesde } from '../../utils/whatsappBaias';

interface AlertasProps {
  itens: Alerta[];
  agora: Date;
  onAbrir: (alvo: AlvoAlerta) => void;
}

const ACAO: Record<Alerta['tipo'], string> = {
  PEDIR_ANALISE: 'Pedir análise',
  ANALISE_ATRASADA: 'Análise há +24 h',
  RESTRICAO_VENCIDA: 'Restrição terminou',
  PERMANENTE: 'Trocar o chip',
  RESTRINGIDO: 'Restringido',
  NAO_TEM: 'Não tem',
};

const dois = (n: number) => String(n).padStart(2, '0');
const dataCurta = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

const quando = (a: Alerta, agora: Date): string => {
  if (a.tipo === 'RESTRINGIDO' && a.ate) return `até ${dataCurta(a.ate)}`;
  if (a.tipo === 'RESTRICAO_VENCIDA' && a.ate) return `venceu ${dataCurta(a.ate)}`;
  if (a.tipo === 'NAO_TEM') return '';
  return `há ${tempoDesde(a.desde, agora)}`;
};

const VISIVEIS = 8;

/** Bloco "Atenção": o que precisa de ação, do mais urgente ao menos; clicar abre o painel */
export const Alertas: React.FC<AlertasProps> = ({ itens, agora, onAbrir }) => {
  const [todos, setTodos] = useState(false);
  const mostrados = todos ? itens : itens.slice(0, VISIVEIS);

  return (
    <div className="wpp-alertas">
      <h3 className="ura-subtitulo">
        <BellRing size={16} />
        Atenção {itens.length > 0 && <span className="wpp-alertas-total">{itens.length}</span>}
      </h3>
      {itens.length === 0 ? (
        <p className="ura-ajuda">Nada pendente: nenhum WhatsApp banido, em análise atrasada, perdido ou restringido.</p>
      ) : (
        <ul className="wpp-alertas-lista">
          {mostrados.map((a, i) => (
            <li key={`${a.onde}-${i}`}>
              <button type="button" className={`wpp-alerta wpp-${a.situacao.toLowerCase()}`} onClick={() => onAbrir(a.alvo)}>
                <span className="wpp-bolinha" aria-hidden="true" />
                <strong className="wpp-alerta-acao">{ACAO[a.tipo]}</strong>
                <span className="wpp-alerta-onde">{a.onde}</span>
                <span className="wpp-alerta-quem">{a.quem}</span>
                <span className="wpp-alerta-quando">{quando(a, agora)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {itens.length > VISIVEIS && (
        <button type="button" className="btn btn-secondary wpp-botao-pequeno" onClick={() => setTodos(!todos)}>
          {todos ? 'Mostrar menos' : `Ver todos (${itens.length})`}
        </button>
      )}
    </div>
  );
};
