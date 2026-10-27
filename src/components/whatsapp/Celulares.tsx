import React, { useState } from 'react';
import { ChevronDown, Smartphone } from 'lucide-react';
import { Celular, MapaWhatsapp, Marca } from '../../types/whatsapp';
import { estadoDaVaga, nomeDaVaga, nomeDoCelular } from '../../utils/celulares';
import { codigoDoLugar } from '../../utils/mapaMesas';
import { resumoDoCelular } from '../../utils/whatsappAlertas';
import { ROTULOS } from '../../utils/whatsappBaias';

interface CelularesProps {
  mapa: MapaWhatsapp;
  agora: Date;
  selecionado: { celularId: string; vagaId: string } | null;
  onSelecionar: (celularId: string, vagaId: string) => void;
}

export const MARCAS: Record<Marca, string> = { SAMSUNG: 'Samsung', MOTOROLA: 'Motorola', XIAOMI: 'Xiaomi', IPHONE: 'iPhone', OUTRO: 'Outro' };

/** Sigla da equipe do celular ou "guardado" */
export const equipeDoCelular = (mapa: MapaWhatsapp, c: Celular): string => {
  for (const sala of mapa.salas) {
    const mesa = sala.mesas.find((m) => m.id === c.mesaId);
    if (mesa) return mesa.sigla;
  }
  return 'guardado';
};

/** Um cartão por celular; abrindo, as vagas agrupadas com dono e situação (clique abre o painel) */
export const Celulares: React.FC<CelularesProps> = ({ mapa, agora, selecionado, onSelecionar }) => {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const siglaDaMesa = (c: Celular) => mapa.salas.flatMap((s) => s.mesas).find((m) => m.id === c.mesaId)?.sigla ?? '';

  return (
    <div className="formatter-card">
      <div className="formatter-card-header">
        <h2 className="formatter-card-title">
          <Smartphone size={20} />
          Celulares
        </h2>
        <span className="badge badge-muted">
          {mapa.celulares.length} celular(es) · {mapa.celulares.reduce((t, c) => t + c.vagas.length, 0)} WhatsApps
        </span>
      </div>
      {mapa.celulares.length === 0 ? (
        <p className="ura-ajuda">Nenhum celular cadastrado. Cadastre em "Configurar celulares", no fim da página.</p>
      ) : (
        <div className="wpp-celulares">
          {mapa.celulares.map((cel) => {
            const r = resumoDoCelular(mapa, cel, agora);
            const aberto = !!abertos[cel.id];
            let grupo = '';
            return (
              <div key={cel.id} className={`wpp-celular ${aberto ? 'aberto' : ''}`}>
                <button
                  type="button"
                  className="wpp-celular-topo"
                  onClick={() => setAbertos({ ...abertos, [cel.id]: !aberto })}
                  aria-expanded={aberto}
                >
                  <span className="wpp-celular-amostra" style={{ background: cel.hex }} aria-hidden="true" />
                  <span className="wpp-celular-nome">
                    <strong>{nomeDoCelular(cel)}</strong>
                    <span>
                      {MARCAS[cel.marca]} · {equipeDoCelular(mapa, cel)} · {r.total} WhatsApps
                    </span>
                  </span>
                  <ChevronDown size={16} className={aberto ? 'girado' : ''} />
                </button>
                <div className="wpp-contagens">
                  <span className="wpp-contagem wpp-ok">
                    <span className="wpp-bolinha" aria-hidden="true" />
                    {r.ok} OK
                  </span>
                  {r.problemas > 0 && (
                    <span className="wpp-contagem wpp-banido">
                      <span className="wpp-bolinha" aria-hidden="true" />
                      {r.problemas} com problema
                    </span>
                  )}
                  <span className="wpp-contagem">{r.backups} backup(s)</span>
                </div>
                {aberto && (
                  <ul className="wpp-vagas">
                    {cel.vagas.map((vaga) => {
                      const cabecalho = vaga.grupo !== grupo ? (grupo = vaga.grupo) : null;
                      const e = estadoDaVaga(mapa, cel, vaga);
                      const ativa = selecionado?.celularId === cel.id && selecionado.vagaId === vaga.id;
                      return (
                        <React.Fragment key={vaga.id}>
                          {cabecalho && <li className="wpp-vagas-grupo">{cabecalho}</li>}
                          <li>
                            <button
                              type="button"
                              className={`wpp-vaga wpp-${e.situacao.toLowerCase()} ${ativa ? 'selecionada' : ''}`}
                              onClick={() => onSelecionar(cel.id, vaga.id)}
                            >
                              <span className="wpp-vaga-rotulo">{vaga.rotulo}</span>
                              <span className={`wpp-vaga-dono ${vaga.baia ? '' : 'backup'}`}>
                                {vaga.baia && <em>{codigoDoLugar(siglaDaMesa(cel), vaga.baia)}</em>}
                                {nomeDaVaga(mapa, cel, vaga)}
                              </span>
                              <span className="wpp-vaga-situacao">
                                <span className="wpp-bolinha" aria-hidden="true" />
                                {ROTULOS[e.situacao]}
                              </span>
                            </button>
                          </li>
                        </React.Fragment>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
