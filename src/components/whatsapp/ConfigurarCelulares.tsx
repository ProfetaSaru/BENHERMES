import React, { useState } from 'react';
import { ChevronDown, Plus, Smartphone, Trash2 } from 'lucide-react';
import { NotificationType } from '../../types/task';
import { Celular, MapaWhatsapp, Marca, VagaWhatsapp } from '../../types/whatsapp';
import {
  CORES_CAPINHA,
  adicionarCelularNoMapa,
  adicionarVaga,
  alterarCelularNoMapa,
  corDaCapinha,
  ligarAutomaticamente,
  ligarBaia,
  mudarEquipe,
  mudarMarcaOuUsuarios,
  nomeDoCelular,
  novoCelular,
  removerCelularNoMapa,
  removerVaga,
} from '../../utils/celulares';
import { codigoDoLugar, posicoesAtivas } from '../../utils/mapaMesas';
import { MARCAS } from './Celulares';

interface ConfigurarCelularesProps {
  mapa: MapaWhatsapp;
  onMapa: (mapa: MapaWhatsapp) => void;
  onNotify: (message: string, type?: NotificationType) => void;
}

const MARCAS_COM_USUARIOS: Marca[] = ['MOTOROLA', 'XIAOMI'];
const agora = () => new Date();

interface Rascunho {
  cor: string;
  hex: string;
  apelido: string;
  marca: Marca;
  usuarios: number;
  mesaId: string;
}

const RASCUNHO_VAZIO: Rascunho = { cor: '', hex: '#808080', apelido: '', marca: 'SAMSUNG', usuarios: 4, mesaId: '' };

/** Cadastro dos celulares corporativos: equipe, marca, usuários, vagas e números dos chips */
export const ConfigurarCelulares: React.FC<ConfigurarCelularesProps> = ({ mapa, onMapa, onNotify }) => {
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState<Rascunho | null>(null);
  const [vagasAbertas, setVagasAbertas] = useState<string | null>(null);
  const [vagaNova, setVagaNova] = useState({ grupo: 'Padrão', app: 'MESSENGER' as VagaWhatsapp['app'], rotulo: '' });

  const mesas = mapa.salas.flatMap((s) => s.mesas.map((m) => ({ mesa: m, sala: s })));
  const mesaDe = (c: Celular) => mesas.find((x) => x.mesa.id === c.mesaId)?.mesa;

  const salvarNovo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novo || !novo.cor.trim()) {
      onNotify('Informe a cor da capinha.', 'error');
      return;
    }
    const cel = novoCelular({ ...novo, cor: novo.cor.trim(), apelido: novo.apelido.trim(), mesaId: novo.mesaId || null }, mapa, agora());
    onMapa(adicionarCelularNoMapa(mapa, cel, agora()));
    onNotify(`Celular ${nomeDoCelular(cel)} cadastrado com ${cel.vagas.length} WhatsApps.`, 'success');
    setNovo(null);
    setVagasAbertas(cel.id);
  };

  const alterar = (id: string, mudar: (c: Celular) => Celular) => onMapa(alterarCelularNoMapa(mapa, id, mudar, agora()));

  const trocarEquipe = (cel: Celular, mesaId: string) => {
    const destino = mesas.find((x) => x.mesa.id === mesaId)?.mesa;
    const texto = destino ? `para a ${destino.sigla} · ${destino.nome}` : 'para "guardado" (sem equipe)';
    if (!window.confirm(`Mudar o celular ${nomeDoCelular(cel)} ${texto}? As vagas serão ligadas de novo às baias da equipe.`)) return;
    onMapa(mudarEquipe(mapa, cel.id, mesaId || null, agora()));
  };

  const trocarMarcaOuUsuarios = (cel: Celular, marca: Marca, usuarios: number) => {
    const { celular, removidas } = mudarMarcaOuUsuarios(cel, marca, usuarios, agora());
    const importantes = removidas.filter((v) => v.baia || v.whatsapp.situacao !== 'OK' || v.numero);
    if (
      importantes.length > 0 &&
      !window.confirm(
        `Estas vagas deixam de existir:\n${importantes.map((v) => `${v.grupo} · ${v.rotulo}${v.baia ? ` (${v.baia})` : ''}${v.numero ? ` · ${v.numero}` : ''}`).join('\n')}\n\nContinuar?`
      )
    ) {
      return;
    }
    alterar(cel.id, () => celular);
  };

  const remover = (cel: Celular) => {
    if (!window.confirm(`Remover o celular ${nomeDoCelular(cel)} e as ${cel.vagas.length} vagas dele?`)) return;
    onMapa(removerCelularNoMapa(mapa, cel.id, agora()));
  };

  const ligar = (cel: Celular, vaga: VagaWhatsapp, baia: string) => {
    const { mapa: novoMapa, desligada } = ligarBaia(mapa, cel.id, vaga.id, baia || null, agora());
    onMapa(novoMapa);
    if (desligada) onNotify(`${desligada} estava nessa baia e virou backup.`, 'info');
  };

  const alternarCompartilhado = (cel: Celular) => {
    const compartilhado = !cel.compartilhado;
    alterar(cel.id, (c) =>
      compartilhado
        ? { ...c, compartilhado, vagas: c.vagas.map((v) => ({ ...v, baia: null })) }
        : ligarAutomaticamente({ ...c, compartilhado }, mapa)
    );
  };

  const formulario = (r: Rascunho) => (
    <form className="wpp-config-celular-form" onSubmit={salvarNovo}>
      <label>
        <span className="formatter-field-label">Cor da capinha</span>
        <input
          className="formatter-select"
          list="wpp-cores"
          value={r.cor}
          onChange={(e) => setNovo({ ...r, cor: e.target.value, hex: corDaCapinha(e.target.value) })}
          placeholder="Azul, Preto…"
          autoFocus
        />
      </label>
      <label>
        <span className="formatter-field-label">Amostra</span>
        <input type="color" className="wpp-cor" value={r.hex} onChange={(e) => setNovo({ ...r, hex: e.target.value })} aria-label="Cor da amostra" />
      </label>
      <label>
        <span className="formatter-field-label">Apelido (opcional)</span>
        <input className="formatter-select" value={r.apelido} onChange={(e) => setNovo({ ...r, apelido: e.target.value })} placeholder="para diferenciar dois da mesma cor" />
      </label>
      <label>
        <span className="formatter-field-label">Marca</span>
        <select className="formatter-select" value={r.marca} onChange={(e) => setNovo({ ...r, marca: e.target.value as Marca })}>
          {(Object.keys(MARCAS) as Marca[]).map((m) => (
            <option key={m} value={m}>
              {MARCAS[m]}
            </option>
          ))}
        </select>
      </label>
      {MARCAS_COM_USUARIOS.includes(r.marca) && (
        <label>
          <span className="formatter-field-label">Usuários</span>
          <input
            type="number"
            min={1}
            max={8}
            className="formatter-select"
            value={r.usuarios}
            onChange={(e) => setNovo({ ...r, usuarios: Math.min(8, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </label>
      )}
      <label>
        <span className="formatter-field-label">Equipe</span>
        <select className="formatter-select" value={r.mesaId} onChange={(e) => setNovo({ ...r, mesaId: e.target.value })}>
          <option value="">Guardado (sem equipe)</option>
          {mesas.map(({ mesa, sala }) => (
            <option key={mesa.id} value={mesa.id}>
              {mesa.sigla} · {mesa.nome} ({sala.nome})
            </option>
          ))}
        </select>
      </label>
      <div className="formatter-actions-buttons escala-acoes">
        <button type="submit" className="btn btn-primary">
          Cadastrar celular
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setNovo(null)}>
          Cancelar
        </button>
      </div>
    </form>
  );

  return (
    <div className="formatter-card">
      <button type="button" className="wpp-config-abrir" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        <span className="formatter-card-title">
          <Smartphone size={20} />
          Configurar celulares
        </span>
        <ChevronDown size={18} className={aberto ? 'girado' : ''} />
      </button>
      <datalist id="wpp-cores">
        {Object.keys(CORES_CAPINHA).map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {aberto && (
        <>
          {novo ? (
            formulario(novo)
          ) : (
            <button type="button" className="btn btn-secondary wpp-botao-pequeno" onClick={() => setNovo(RASCUNHO_VAZIO)}>
              <Plus size={16} />
              Adicionar celular
            </button>
          )}

          {mapa.celulares.map((cel) => {
            const mesa = mesaDe(cel);
            const baias = mesa ? posicoesAtivas(mesa).filter((p) => /^[ED]\d+$/.test(p)) : [];
            const vagasVisiveis = vagasAbertas === cel.id;
            return (
              <div key={cel.id} className="wpp-config-celular">
                <div className="wpp-config-celular-topo">
                  <span className="wpp-celular-amostra" style={{ background: cel.hex }} aria-hidden="true" />
                  <strong>{nomeDoCelular(cel)}</strong>
                  <select
                    className="formatter-select"
                    value={cel.marca}
                    onChange={(e) => trocarMarcaOuUsuarios(cel, e.target.value as Marca, cel.usuarios)}
                    aria-label={`Marca do celular ${nomeDoCelular(cel)}`}
                  >
                    {(Object.keys(MARCAS) as Marca[]).map((m) => (
                      <option key={m} value={m}>
                        {MARCAS[m]}
                      </option>
                    ))}
                  </select>
                  {MARCAS_COM_USUARIOS.includes(cel.marca) && (
                    <label className="wpp-config-inline">
                      Usuários
                      <input
                        type="number"
                        min={1}
                        max={8}
                        className="formatter-select"
                        value={cel.usuarios}
                        onChange={(e) => trocarMarcaOuUsuarios(cel, cel.marca, Math.min(8, Math.max(1, Number(e.target.value) || 1)))}
                        aria-label={`Usuários do celular ${nomeDoCelular(cel)}`}
                      />
                    </label>
                  )}
                  <select
                    className="formatter-select"
                    value={cel.mesaId ?? ''}
                    onChange={(e) => trocarEquipe(cel, e.target.value)}
                    aria-label={`Equipe do celular ${nomeDoCelular(cel)}`}
                  >
                    <option value="">Guardado (sem equipe)</option>
                    {mesas.map(({ mesa: m }) => (
                      <option key={m.id} value={m.id}>
                        {m.sigla} · {m.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="ura-arquivo-remover"
                    onClick={() => remover(cel)}
                    aria-label={`Remover o celular ${nomeDoCelular(cel)}`}
                    title="Remover celular"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="wpp-config-celular-linha">
                  <label className="wpp-config-inline">
                    <input type="checkbox" checked={cel.compartilhado} onChange={() => alternarCompartilhado(cel)} />
                    Compartilhado (todas as vagas são backup)
                  </label>
                  <label className="wpp-config-inline">
                    Nome do backup
                    <input
                      className="formatter-select"
                      defaultValue={cel.nomeBackup}
                      key={cel.nomeBackup}
                      onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== cel.nomeBackup && alterar(cel.id, (c) => ({ ...c, nomeBackup: e.target.value.trim() }))}
                    />
                  </label>
                  <button type="button" className="btn btn-secondary wpp-botao-pequeno" onClick={() => setVagasAbertas(vagasVisiveis ? null : cel.id)}>
                    {vagasVisiveis ? 'Esconder vagas' : `Vagas (${cel.vagas.length})`}
                  </button>
                </div>

                {vagasVisiveis && (
                  <table className="formatter-table wpp-config-vagas">
                    <thead>
                      <tr>
                        <th>Vaga</th>
                        <th>Atende</th>
                        <th>Número do chip</th>
                        {cel.marca === 'OUTRO' && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {cel.vagas.map((vaga) => (
                        <tr key={vaga.id}>
                          <td>
                            <span className="wpp-config-grupo">{vaga.grupo}</span> {vaga.rotulo}
                          </td>
                          <td>
                            <select
                              className="formatter-select"
                              value={vaga.baia ?? ''}
                              disabled={!mesa || cel.compartilhado}
                              onChange={(e) => ligar(cel, vaga, e.target.value)}
                              aria-label={`Baia da vaga ${vaga.grupo} ${vaga.rotulo}`}
                            >
                              <option value="">Backup ({cel.nomeBackup})</option>
                              {mesa &&
                                baias.map((p) => (
                                  <option key={p} value={p}>
                                    {codigoDoLugar(mesa.sigla, p)} · {mesa.lugares[p]?.operador || 'vaga vazia'}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="formatter-select"
                              defaultValue={vaga.numero}
                              key={vaga.numero}
                              placeholder="(11) 90000-0000"
                              aria-label={`Número do chip da vaga ${vaga.grupo} ${vaga.rotulo}`}
                              onBlur={(e) => {
                                const numero = e.target.value.trim();
                                if (numero !== vaga.numero) {
                                  alterar(cel.id, (c) => ({ ...c, vagas: c.vagas.map((v) => (v.id === vaga.id ? { ...v, numero } : v)) }));
                                }
                              }}
                            />
                          </td>
                          {cel.marca === 'OUTRO' && (
                            <td>
                              <button
                                type="button"
                                className="ura-arquivo-remover"
                                onClick={() => alterar(cel.id, (c) => removerVaga(c, vaga.id))}
                                aria-label={`Remover a vaga ${vaga.grupo} ${vaga.rotulo}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {vagasVisiveis && cel.marca === 'OUTRO' && (
                  <form
                    className="wpp-config-vaga-nova"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!vagaNova.rotulo.trim() || !vagaNova.grupo.trim()) return;
                      alterar(cel.id, (c) => adicionarVaga(c, { ...vagaNova, grupo: vagaNova.grupo.trim(), rotulo: vagaNova.rotulo.trim() }, agora()));
                      setVagaNova({ ...vagaNova, rotulo: '' });
                    }}
                  >
                    <input className="formatter-select" value={vagaNova.grupo} onChange={(e) => setVagaNova({ ...vagaNova, grupo: e.target.value })} aria-label="Grupo da vaga" placeholder="Grupo" />
                    <select className="formatter-select" value={vagaNova.app} onChange={(e) => setVagaNova({ ...vagaNova, app: e.target.value as VagaWhatsapp['app'] })} aria-label="Aplicativo">
                      <option value="MESSENGER">Messenger</option>
                      <option value="BUSINESS">Business</option>
                    </select>
                    <input className="formatter-select" value={vagaNova.rotulo} onChange={(e) => setVagaNova({ ...vagaNova, rotulo: e.target.value })} aria-label="Nome da vaga" placeholder="Messenger 1" />
                    <button type="submit" className="btn btn-secondary wpp-botao-pequeno">
                      <Plus size={16} />
                      Vaga
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};
