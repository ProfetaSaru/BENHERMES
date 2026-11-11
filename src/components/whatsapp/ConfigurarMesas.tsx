import React, { useEffect, useState } from 'react';
import { ChevronDown, Minus, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { AuthUser } from '../../types/auth';
import { NotificationType } from '../../types/task';
import { apiRequest } from '../../utils/apiClient';
import { Centro, MapaWhatsapp, Mesa } from '../../types/whatsapp';
import {
  avisoDeRemocao,
  mesclarRascunhoDaMesa,
  DadosDaMesa,
  adicionarMesaNoMapa,
  adicionarSalaNoMapa,
  alterarMesaNoMapa,
  alternarDesativada,
  formatarMesa,
  novaMesa,
  removerSalaNoMapa,
  renomearSalaNoMapa,
  siglaValida,
} from '../../utils/whatsappBaias';
import { MapaMesa } from './MapaMesa';
import { limparLigacoes, nomeDoCelular, removerMesaComCelulares, transferirSituacoes } from '../../utils/celulares';

interface ConfigurarMesasProps {
  mapa: MapaWhatsapp;
  onMapa: (mapa: MapaWhatsapp) => void;
  onNotify: (message: string, type?: NotificationType) => void;
  canDelete?: boolean;
  supervisors?: AuthUser[];
}

/** Mesa em edição: rascunho completo (para a prévia) e onde ela fica */
interface Edicao {
  salaId: string;
  nova: boolean;
  rascunho: Mesa;
  /** A mesa quando a edição começou (para salvar só o que mudou no rascunho) */
  inicial?: Mesa;
}

const CENTROS: [Centro, string][] = [
  ['SUP', 'Supervisor'],
  ['NENHUM', 'Ninguém'],
];

const MAX_BAIAS = 8;

/** Salas e mesas: adicionar, renomear, mudar formato, desativar baias, remover */
export const ConfigurarMesas: React.FC<ConfigurarMesasProps> = ({
  mapa,
  onMapa,
  onNotify,
  canDelete = true,
  supervisors,
}) => {
  const [aberto, setAberto] = useState(false);
  const [novaSala, setNovaSala] = useState('');
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [internalSupervisors, setInternalSupervisors] = useState<AuthUser[]>([]);

  useEffect(() => {
    if (supervisors && supervisors.length > 0) return;
    apiRequest<{ users: AuthUser[] }>('/api/users')
      .then((res) => {
        setInternalSupervisors(res.users || []);
      })
      .catch(() => {});
  }, [supervisors]);

  const todosSupervisores = supervisors && supervisors.length > 0 ? supervisors : internalSupervisors;
  const listaSupervisores = [
    ...todosSupervisores.filter((u) => u.role === 'supervisor' && u.active),
  ];
  if (
    edicao?.rascunho.supervisorUserId &&
    !listaSupervisores.some((u) => u.id === edicao.rascunho.supervisorUserId)
  ) {
    const extra = todosSupervisores.find((u) => u.id === edicao.rascunho.supervisorUserId);
    if (extra) listaSupervisores.push(extra);
  }

  const agora = () => new Date();

  const editar = (salaId: string, mesa: Mesa) => setEdicao({ salaId, nova: false, rascunho: mesa, inicial: mesa });

  const criarMesa = (salaId: string) => {
    const n = mapa.salas.reduce((total, s) => total + s.mesas.length, 0) + 1;
    let sigla = `OP${n}`;
    for (let i = n + 1; siglaValida(sigla, mapa) !== null; i++) sigla = `OP${i}`;
    setEdicao({
      salaId,
      nova: true,
      rascunho: novaMesa({ nome: `${n}º Equipe`, sigla, supervisor: '', supervisorUserId: null, esq: 4, dir: 4, centro: 'SUP', inicio: 'sup' }, agora()),
    });
  };

  /** Atualiza o rascunho mantendo os lugares coerentes com o formato (para a prévia) */
  const mudarRascunho = (mudanca: Partial<DadosDaMesa>) => {
    if (!edicao) return;
    const r = edicao.rascunho;
    const dados: DadosDaMesa = {
      nome: r.nome,
      sigla: r.sigla,
      supervisor: r.supervisor,
      supervisorUserId: r.supervisorUserId,
      esq: r.esq,
      dir: r.dir,
      centro: r.centro,
      inicio: r.inicio,
      desativadas: r.desativadas,
      ...mudanca,
    };
    const { mesa } = formatarMesa(r, { ...dados, sigla: r.sigla }, agora());
    setEdicao({ ...edicao, rascunho: { ...mesa, sigla: dados.sigla, supervisorUserId: dados.supervisorUserId } });
  };

  const salvar = () => {
    if (!edicao) return;
    const { salaId, nova, rascunho } = edicao;
    const erro = siglaValida(rascunho.sigla, mapa, nova ? undefined : rascunho.id);
    if (erro) {
      onNotify(erro, 'error');
      return;
    }
    if (!rascunho.nome.trim()) {
      onNotify('Informe o nome da mesa.', 'error');
      return;
    }
    if (nova) {
      if (!mapa.salas.some((s) => s.id === salaId)) {
        onNotify('A sala desta mesa não existe mais (o mapa foi importado ou alterado). A edição foi cancelada.', 'error');
        setEdicao(null);
        return;
      }
      const mesa = { ...rascunho, sigla: rascunho.sigla.trim().toUpperCase(), nome: rascunho.nome.trim(), supervisorUserId: rascunho.supervisorUserId ?? null };
      onMapa(adicionarMesaNoMapa(mapa, salaId, mesa, agora()));
      onNotify(`Mesa ${mesa.nome} criada.`, 'success');
      setEdicao(null);
      return;
    }
    const original = mapa.salas.find((s) => s.id === salaId)?.mesas.find((m) => m.id === rascunho.id);
    if (!original) {
      onNotify('Esta mesa não existe mais no mapa (ele foi importado ou alterado). A edição foi cancelada.', 'error');
      setEdicao(null);
      return;
    }
    // Só o que mudou no rascunho: o que mudou no painel enquanto ele estava aberto (ex.: supervisor) continua
    const dados = mesclarRascunhoDaMesa(edicao.inicial ?? original, rascunho, original);
    const { mesa, removidos } = formatarMesa(original, { ...dados, nome: dados.nome.trim(), supervisorUserId: dados.supervisorUserId ?? null }, agora());
    const linhas = avisoDeRemocao(removidos, { ...original, sigla: mesa.sigla });
    if (linhas.length > 0 && !window.confirm(`Estas baias deixam de existir:\n${linhas.join('\n')}\n\nSalvar mesmo assim?`)) {
      return;
    }
    // Vagas de celular ligadas a baias que deixaram de existir viram backup
    onMapa(transferirSituacoes(mapa, limparLigacoes(alterarMesaNoMapa(mapa, salaId, mesa.id, () => mesa, agora())), agora()));
    onNotify(`Mesa ${mesa.nome} salva.`, 'success');
    setEdicao(null);
  };

  const removerMesa = () => {
    if (!edicao || edicao.nova) return;
    const celulares = mapa.celulares.filter((c) => c.mesaId === edicao.rascunho.id).map(nomeDoCelular);
    const aviso = celulares.length ? `\n\nOs celulares ${celulares.join(', ')} ficam guardados (sem equipe).` : '';
    if (!window.confirm(`Remover a mesa ${edicao.rascunho.nome} e todos os lugares dela?${aviso}`)) return;
    onMapa(removerMesaComCelulares(mapa, edicao.salaId, edicao.rascunho.id, agora()));
    setEdicao(null);
  };

  const removerSala = (salaId: string, nome: string, mesas: number) => {
    if (!window.confirm(`Remover a sala ${nome}${mesas ? ` e as ${mesas} mesa(s) dela` : ''}?`)) return;
    onMapa(transferirSituacoes(mapa, limparLigacoes(removerSalaNoMapa(mapa, salaId, agora())), agora()));
    if (edicao?.salaId === salaId) setEdicao(null);
  };

  const adicionarSala = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaSala.trim()) return;
    onMapa(adicionarSalaNoMapa(mapa, novaSala, agora()));
    setNovaSala('');
  };

  const stepper = (campo: 'esq' | 'dir', rotulo: string) => {
    const valor = edicao!.rascunho[campo];
    return (
      <div className="wpp-stepper">
        <span>{rotulo}</span>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => mudarRascunho({ [campo]: valor - 1 })}
          disabled={valor <= 1}
          aria-label={`Menos uma baia: ${rotulo}`}
        >
          <Minus size={16} />
        </button>
        <strong aria-live="polite">{valor}</strong>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => mudarRascunho({ [campo]: valor + 1 })}
          disabled={valor >= MAX_BAIAS}
          aria-label={`Mais uma baia: ${rotulo}`}
        >
          <Plus size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="formatter-card">
      <button type="button" className="wpp-config-abrir" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        <span className="formatter-card-title">
          <Settings2 size={20} />
          Configurar salas e mesas
        </span>
        <ChevronDown size={18} className={aberto ? 'girado' : ''} />
      </button>

      {aberto && (
        <>
          {mapa.salas.map((sala) => (
            <div key={sala.id} className="wpp-config-sala">
              <div className="wpp-config-sala-topo">
                <input
                  key={sala.nome}
                  className="formatter-select"
                  defaultValue={sala.nome}
                  aria-label={`Nome da sala ${sala.nome}`}
                  onBlur={(e) => {
                    const nome = e.target.value.trim();
                    if (nome && nome !== sala.nome) onMapa(renomearSalaNoMapa(mapa, sala.id, nome, agora()));
                  }}
                />
                <button type="button" className="btn btn-secondary" onClick={() => criarMesa(sala.id)}>
                  <Plus size={16} />
                  Nova mesa
                </button>
                {canDelete && (
                  <button
                    type="button"
                    className="ura-arquivo-remover"
                    onClick={() => removerSala(sala.id, sala.nome, sala.mesas.length)}
                    aria-label={`Remover a sala ${sala.nome}`}
                    title="Remover sala"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="wpp-config-mesas">
                {sala.mesas.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`wpp-config-mesa ${edicao?.rascunho.id === m.id ? 'ativa' : ''}`}
                    onClick={() => editar(sala.id, m)}
                  >
                    <Pencil size={14} />
                    {m.sigla} · {m.nome} · {m.esq} + {m.dir}
                  </button>
                ))}
                {sala.mesas.length === 0 && <span className="ura-ajuda">Sem mesas.</span>}
              </div>
            </div>
          ))}

          <form className="wpp-config-nova-sala" onSubmit={adicionarSala}>
            <input
              className="formatter-select"
              value={novaSala}
              onChange={(e) => setNovaSala(e.target.value)}
              placeholder="Nome da nova sala (ex.: Comercial 3)"
              aria-label="Nome da nova sala"
            />
            <button type="submit" className="btn btn-secondary" disabled={!novaSala.trim()}>
              <Plus size={16} />
              Adicionar sala
            </button>
          </form>

          {edicao && (
            <div className="wpp-config-editor">
              <div className="wpp-config-form">
                <h3 className="ura-subtitulo">{edicao.nova ? 'Nova mesa' : `Editar ${edicao.rascunho.nome}`}</h3>
                <label className="formatter-field-label" htmlFor="wpp-mesa-nome">
                  Nome da mesa
                </label>
                <input
                  id="wpp-mesa-nome"
                  className="formatter-select"
                  value={edicao.rascunho.nome}
                  onChange={(e) => mudarRascunho({ nome: e.target.value })}
                />
                <label className="formatter-field-label" htmlFor="wpp-mesa-sigla">
                  Sigla (início dos códigos)
                </label>
                <input
                  id="wpp-mesa-sigla"
                  className="formatter-select"
                  value={edicao.rascunho.sigla}
                  onChange={(e) => mudarRascunho({ sigla: e.target.value.toUpperCase() })}
                />
                {siglaValida(edicao.rascunho.sigla, mapa, edicao.nova ? undefined : edicao.rascunho.id) && (
                  <p className="wpp-erro">
                    {siglaValida(edicao.rascunho.sigla, mapa, edicao.nova ? undefined : edicao.rascunho.id)}
                  </p>
                )}
                <label className="formatter-field-label" htmlFor="wpp-mesa-sup-user">
                  Supervisor alocado (Conta de Login)
                </label>
                <select
                  id="wpp-mesa-sup-user"
                  className="formatter-select"
                  value={edicao.rascunho.supervisorUserId || ''}
                  onChange={(e) => {
                    const supId = e.target.value || null;
                    const supUser = listaSupervisores.find((s) => s.id === supId);
                    mudarRascunho({
                      supervisorUserId: supId,
                      ...(supUser ? { supervisor: supUser.displayName } : {}),
                    });
                  }}
                >
                  <option value="">-- Nenhum supervisor vinculado --</option>
                  {listaSupervisores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName} (@{s.username})
                    </option>
                  ))}
                </select>
                <label className="formatter-field-label" htmlFor="wpp-mesa-sup" style={{ marginTop: '8px' }}>
                  Nome de exibição do supervisor
                </label>
                <input
                  id="wpp-mesa-sup"
                  className="formatter-select"
                  value={edicao.rascunho.supervisor}
                  onChange={(e) => mudarRascunho({ supervisor: e.target.value })}
                />
                {stepper('esq', 'Baias do lado esquerdo')}
                {stepper('dir', 'Baias do lado direito')}
                <div className="formatter-field-label">Quem fica no centro da mesa</div>
                <div className="wpp-opcoes">
                  {CENTROS.map(([id, rotulo]) => (
                    <button
                      key={id}
                      type="button"
                      className={`wpp-filtro ${edicao.rascunho.centro === id ? 'ativo' : ''}`}
                      aria-pressed={edicao.rascunho.centro === id}
                      onClick={() => mudarRascunho({ centro: id })}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
                <div className="formatter-field-label">A baia 1 começa</div>
                <div className="wpp-opcoes">
                  {(
                    [
                      ['sup', 'Pelo lado do supervisor'],
                      ['porta', 'Pela porta'],
                    ] as const
                  ).map(([id, rotulo]) => (
                    <button
                      key={id}
                      type="button"
                      className={`wpp-filtro ${edicao.rascunho.inicio === id ? 'ativo' : ''}`}
                      aria-pressed={edicao.rascunho.inicio === id}
                      onClick={() => mudarRascunho({ inicio: id })}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
                <div className="formatter-actions-buttons escala-acoes">
                  <button type="button" className="btn btn-primary" onClick={salvar}>
                    Salvar mesa
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEdicao(null)}>
                    Cancelar
                  </button>
                  {!edicao.nova && canDelete && (
                    <button type="button" className="btn btn-secondary wpp-perigo" onClick={removerMesa}>
                      <Trash2 size={16} />
                      Remover mesa
                    </button>
                  )}
                </div>
              </div>
              <div className="wpp-config-previa">
                <h3 className="ura-subtitulo">Prévia</h3>
                <p className="ura-ajuda">Clique numa baia para desativar ou reativar.</p>
                <MapaMesa
                  mesa={edicao.rascunho}
                  filtro="todas"
                  agora={new Date()}
                  selecionado={null}
                  modoConfiguracao
                  onSelecionar={(posicao) => {
                    if (posicao === 'SUP' || posicao === 'SUB') return;
                    setEdicao({ ...edicao, rascunho: alternarDesativada(edicao.rascunho, posicao, new Date()) });
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
