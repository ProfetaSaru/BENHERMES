import React from 'react';
import { Ticket } from 'lucide-react';
import { MapaWhatsapp } from '../../types/whatsapp';
import { AlvoAlerta } from '../../utils/whatsappAlertas';
import { tempoDesde } from '../../utils/whatsappBaias';
import { ChamadoBenCalls } from '../../hooks/useChamadosBenCalls';

interface ChamadosBenCallsProps {
  chamados: ChamadoBenCalls[];
  mapa: MapaWhatsapp;
  agora: Date;
  onAbrir: (alvo: AlvoAlerta) => void;
  /** Marca o WhatsApp da baia como banido (o chamado do BenCalls avisou) */
  onMarcarBanido: (alvo: Extract<AlvoAlerta, { tipo: 'lugar' }>) => void;
  onDispensar: (id: string) => void;
}

/** "OP1-E3" → a baia no mapa daqui */
const acharBaia = (mapa: MapaWhatsapp, codigo: string) => {
  for (const sala of mapa.salas) {
    for (const mesa of sala.mesas) {
      for (const posicao of Object.keys(mesa.lugares)) {
        if (`${mesa.sigla}-${posicao}` === codigo) {
          return { alvo: { tipo: 'lugar' as const, salaId: sala.id, mesaId: mesa.id, posicao }, lugar: mesa.lugares[posicao] };
        }
      }
    }
  }
  return null;
};

/**
 * Chamados de WhatsApp abertos no BenCalls (integração). Quando a baia é liberada aqui, o
 * BenCalls conclui o chamado sozinho e ele some desta lista.
 */
export const ChamadosBenCalls: React.FC<ChamadosBenCallsProps> = ({ chamados, mapa, agora, onAbrir, onMarcarBanido, onDispensar }) => {
  if (!chamados.length) return null;
  return (
    <div className="wpp-alertas wpp-chamados-bencalls">
      <h3 className="ura-subtitulo">
        <Ticket size={16} />
        Chamados do BenCalls <span className="wpp-alertas-total">{chamados.length}</span>
      </h3>
      <p className="ura-ajuda">Abertos pela supervisão no BenCalls. Ao liberar ou trocar o chip da baia aqui, o chamado é concluído lá.</p>
      <ul className="wpp-alertas-lista">
        {chamados.map((c) => {
          const baia = acharBaia(mapa, c.codigo);
          const situacao = baia?.lugar.whatsapp.situacao;
          const podeMarcar = c.whatsapp === 'BANIDO' && situacao === 'OK' && baia;
          return (
            <li key={c.id} className="wpp-chamado-bencalls">
              <button
                type="button"
                className={`wpp-alerta wpp-${(situacao || 'nao_tem').toLowerCase()}`}
                onClick={() => baia && onAbrir(baia.alvo)}
                disabled={!baia}
                title={baia ? 'Abrir a baia' : 'Esta baia não está no mapa daqui'}
              >
                <span className="wpp-bolinha" aria-hidden="true" />
                <strong className="wpp-alerta-acao">#{c.numero}</strong>
                <span className="wpp-alerta-onde">{c.codigo}</span>
                <span className="wpp-alerta-quem">{c.situacao}</span>
                <span className="wpp-alerta-quando">há {tempoDesde(c.abertoEm, agora)}</span>
              </button>
              <span className="wpp-chamado-acoes">
                {podeMarcar && (
                  <button type="button" className="btn btn-secondary wpp-botao-pequeno" onClick={() => onMarcarBanido(baia.alvo)}>
                    ⛔ Marcar como banido
                  </button>
                )}
                <button type="button" className="btn btn-secondary wpp-botao-pequeno" onClick={() => onDispensar(c.id)} title="Tirar desta lista (o chamado continua no BenCalls)">
                  Dispensar
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
