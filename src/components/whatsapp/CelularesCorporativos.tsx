import React from 'react';
import { Smartphone } from 'lucide-react';
import { CelularCorporativo, EstadoWhatsapp } from '../../types/whatsapp';
import { ROTULOS, restricaoVencida } from '../../utils/whatsappBaias';

export type CampoCelular = 'messenger' | 'business';

interface CelularesCorporativosProps {
  celulares: CelularCorporativo[];
  agora: Date;
  selecionado: { cor: string; campo: CampoCelular } | null;
  onSelecionar: (cor: string, campo: CampoCelular) => void;
}

const NOMES: Record<CampoCelular, string> = { messenger: 'Messenger', business: 'Business' };

/** Cartões dos celulares corporativos, cada um com o WhatsApp Messenger e o Business */
export const CelularesCorporativos: React.FC<CelularesCorporativosProps> = ({ celulares, agora, selecionado, onSelecionar }) => {
  const chip = (cel: CelularCorporativo, campo: CampoCelular, e: EstadoWhatsapp) => {
    const ativo = selecionado?.cor === cel.cor && selecionado.campo === campo;
    return (
      <button
        type="button"
        className={`wpp-celular-chip wpp-${e.situacao.toLowerCase()} ${restricaoVencida(e, agora) ? 'vencida' : ''} ${ativo ? 'selecionada' : ''}`}
        onClick={() => onSelecionar(cel.cor, campo)}
        aria-pressed={ativo}
        aria-label={`Celular ${cel.cor}, ${NOMES[campo]}: ${ROTULOS[e.situacao]}`}
      >
        <span>{NOMES[campo]}</span>
        <strong>
          <span className="wpp-bolinha" aria-hidden="true" />
          {ROTULOS[e.situacao]}
        </strong>
      </button>
    );
  };

  return (
    <div className="formatter-card">
      <div className="formatter-card-header">
        <h2 className="formatter-card-title">
          <Smartphone size={20} />
          Celulares corporativos
        </h2>
      </div>
      {celulares.length === 0 ? (
        <p className="ura-ajuda">Nenhum celular corporativo. Eles entram ao importar a planilha.</p>
      ) : (
        <div className="wpp-celulares">
          {celulares.map((cel) => (
            <div key={cel.cor} className="wpp-celular">
              <div className="wpp-celular-cor">
                <span className="wpp-celular-amostra" style={{ background: cel.hex }} aria-hidden="true" />
                {cel.cor}
              </div>
              {chip(cel, 'messenger', cel.messenger)}
              {chip(cel, 'business', cel.business)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
