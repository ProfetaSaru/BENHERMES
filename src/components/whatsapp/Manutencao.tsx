import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCopy, Wrench, X } from 'lucide-react';
import { NotificationType } from '../../types/task';
import { Acao, Janela, MapaWhatsapp } from '../../types/whatsapp';
import { AlvoAlerta } from '../../utils/whatsappAlertas';
import { ROTULOS, restringir, tempoRestante } from '../../utils/whatsappBaias';
import {
  ACAO,
  ExtraDaAcao,
  GRUPO_SEM_CELULAR,
  NumeroDaEtapa,
  ROTULO_JANELA,
  acoesPossiveis,
  alternarConferido,
  aplicarAcao,
  cancelarManutencao,
  concluirManutencao,
  etapasDaManutencao,
  iniciarManutencao,
  numerosDaEtapa,
  trocarJanela,
} from '../../utils/whatsappManutencao';

interface ManutencaoProps {
  mapa: MapaWhatsapp;
  agora: Date;
  onMapa: (mudar: (m: MapaWhatsapp) => MapaWhatsapp) => void;
  onNotify: (message: string, type?: NotificationType) => void;
}

/** Cor do botão pelo resultado da ação */
const CLASSE_DA_ACAO: Record<Acao, string> = {
  BANIDO: 'wpp-banido',
  RESTRINGIDO: 'wpp-restringido',
  PEDIU_ANALISE: 'wpp-analise',
  LIBERADO: 'wpp-ok',
  PERDIDO: 'wpp-permanente',
  TROCOU_CHIP: 'wpp-ok',
  VOLTOU: 'wpp-ok',
};

const JANELAS: Janela[] = ['MANHA', 'ALMOCO', 'FORA'];

const dois = (n: number) => String(n).padStart(2, '0');
const hora = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
};
const diaEHora = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${hora(iso)}`;
};

/** Formulário aberto numa linha: tempo da restrição ou número do chip novo */
type Formulario = { chave: string; acao: 'RESTRINGIDO' | 'TROCOU_CHIP' };

/**
 * Modo manutenção: o botão para começar, a conferência celular por celular com as ações do ciclo
 * do banimento e, ao concluir, o texto do grupo com "Copiar".
 */
export const Manutencao: React.FC<ManutencaoProps> = ({ mapa, agora, onMapa, onNotify }) => {
  const aberta = mapa.manutencaoAtual;
  const etapas = etapasDaManutencao(mapa);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [quantidade, setQuantidade] = useState('24');
  const [unidade, setUnidade] = useState<'horas' | 'dias'>('horas');
  const [numeroNovo, setNumeroNovo] = useState('');
  const [concluindo, setConcluindo] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);
  const textoRef = useRef<HTMLPreElement>(null);
  // Duplo clique: depois de uma ação, o botão seguinte aparece no mesmo lugar; ignora o 2º clique
  const ultimaAcao = useRef<{ chave: string; quando: number } | null>(null);

  const conferidos = aberta?.conferidos ?? [];
  const pendente = etapas.find((e) => !conferidos.includes(e.id));
  const etapa = etapas.find((e) => e.id === ativa) ?? pendente ?? etapas[0];

  useEffect(() => setFormulario(null), [etapa?.id]);

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      onNotify('Texto copiado. É só colar no grupo.', 'success');
    } catch {
      const pre = textoRef.current;
      if (pre) {
        const faixa = document.createRange();
        faixa.selectNodeContents(pre);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(faixa);
      }
      onNotify('Não consegui copiar sozinho: o texto está selecionado, use Ctrl+C.', 'info');
    }
  };

  // Ainda sem manutenção aberta: botão para começar (e o texto da última, se acabou de concluir)
  if (!aberta) {
    const ultima = mapa.manutencoes[mapa.manutencoes.length - 1];
    return (
      <div className="formatter-card wpp-manutencao-inicio">
        {resultado ? (
          <div className="wpp-manutencao-resultado">
            <div className="formatter-card-header">
              <h2 className="formatter-card-title">
                <CheckCircle2 size={20} />
                Manutenção concluída
              </h2>
              <button type="button" className="ura-arquivo-remover" onClick={() => setResultado(null)} aria-label="Fechar o texto">
                <X size={18} />
              </button>
            </div>
            <pre ref={textoRef} className="wpp-texto-grupo">{resultado}</pre>
            <div className="formatter-actions-buttons escala-acoes">
              <button type="button" className="btn btn-primary" onClick={() => copiar(resultado)}>
                <ClipboardCopy size={16} />
                Copiar texto
              </button>
            </div>
          </div>
        ) : (
          <div className="wpp-manutencao-chamada">
            <div>
              <h2 className="formatter-card-title">
                <Wrench size={20} />
                Manutenção dos WhatsApps
              </h2>
              <p className="ura-ajuda">
                {ultima
                  ? `Última: ${diaEHora(ultima.inicio)} · ${ROTULO_JANELA[ultima.janela]} · ${ultima.acoes.length} ação(ões).`
                  : 'Confira celular por celular e gere o texto do grupo no fim.'}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary wpp-manutencao-iniciar"
              onClick={() => {
                setAtiva(null);
                setObservacao('');
                onMapa((m) => iniciarManutencao(m, new Date()));
              }}
            >
              <Wrench size={18} />
              Iniciar manutenção
            </button>
          </div>
        )}
      </div>
    );
  }

  const feitas = etapas.filter((e) => conferidos.includes(e.id)).length;
  const numeros = etapa ? numerosDaEtapa(mapa, etapa.id) : [];

  const agir = (n: NumeroDaEtapa, acao: Acao, extra?: ExtraDaAcao) => {
    const agoraMs = Date.now();
    if (!extra && ultimaAcao.current?.chave === n.chave && agoraMs - ultimaAcao.current.quando < 700) return;
    if (acao === 'RESTRINGIDO' && !extra) {
      setFormulario({ chave: n.chave, acao });
      return;
    }
    if (acao === 'TROCOU_CHIP' && !extra && n.alvo.tipo === 'vaga') {
      setNumeroNovo('');
      setFormulario({ chave: n.chave, acao });
      return;
    }
    if (extra?.restricao) {
      try {
        restringir(extra.restricao.quantidade, extra.restricao.unidade, new Date());
      } catch (err: any) {
        onNotify(err.message, 'error');
        return;
      }
    }
    setFormulario(null);
    ultimaAcao.current = { chave: n.chave, quando: agoraMs };
    onMapa((m) => aplicarAcao(m, n.alvo as AlvoAlerta, acao, new Date(), extra));
  };

  const conferir = () => {
    if (!etapa) return;
    const marcando = !conferidos.includes(etapa.id);
    onMapa((m) => alternarConferido(m, etapa.id));
    if (marcando) setAtiva(etapas.find((e) => e.id !== etapa.id && !conferidos.includes(e.id))?.id ?? etapa.id);
  };

  const concluir = () => {
    const faltam = etapas.length - feitas;
    if (faltam > 0 && !window.confirm(`Ainda faltam ${faltam} de ${etapas.length} para conferir. Concluir assim mesmo?`)) return;
    const { mapa: concluido, texto } = concluirManutencao(mapa, observacao, new Date());
    onMapa(() => concluido);
    setResultado(texto);
    setConcluindo(false);
    setObservacao('');
  };

  const cancelar = () => {
    if (!window.confirm('Cancelar esta manutenção? As mudanças de situação já feitas continuam valendo.')) return;
    onMapa(cancelarManutencao);
    setConcluindo(false);
  };

  return (
    <section className="formatter-card wpp-manutencao" aria-label="Manutenção em andamento">
      <div className="wpp-manutencao-faixa">
        <div className="wpp-manutencao-titulo">
          <Wrench size={20} />
          <strong>Manutenção</strong>
          <select
            className="formatter-select"
            value={aberta.janela}
            onChange={(e) => onMapa((m) => trocarJanela(m, e.target.value as Janela))}
            aria-label="Janela da manutenção"
          >
            {JANELAS.map((j) => (
              <option key={j} value={j}>
                {ROTULO_JANELA[j]}
              </option>
            ))}
          </select>
          <span className="wpp-manutencao-hora">desde {hora(aberta.inicio)}</span>
        </div>
        <div className="wpp-progresso" aria-label={`${feitas} de ${etapas.length} conferidos`}>
          <div className="wpp-progresso-barra">
            <span style={{ width: `${etapas.length ? (feitas / etapas.length) * 100 : 0}%` }} />
          </div>
          <span>
            {feitas} de {etapas.length}
          </span>
        </div>
        <div className="formatter-actions-buttons escala-acoes">
          <button type="button" className="btn btn-primary" onClick={() => setConcluindo(true)}>
            <CheckCircle2 size={16} />
            Concluir
          </button>
          <button type="button" className="btn btn-secondary" onClick={cancelar}>
            Cancelar
          </button>
        </div>
      </div>

      {concluindo && (
        <div className="wpp-manutencao-concluir">
          <label htmlFor="wpp-obs" className="formatter-field-label">
            Observação (opcional)
          </label>
          <textarea
            id="wpp-obs"
            className="formatter-select"
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: chip do Azul ficou na gaveta"
          />
          <div className="formatter-actions-buttons escala-acoes">
            <button type="button" className="btn btn-primary" onClick={concluir}>
              Gerar texto e concluir
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setConcluindo(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      <div className="wpp-etapas" role="tablist" aria-label="Celulares da manutenção">
        {etapas.map((e) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            aria-selected={etapa?.id === e.id}
            className={`wpp-etapa ${etapa?.id === e.id ? 'ativa' : ''} ${conferidos.includes(e.id) ? 'feita' : ''}`}
            onClick={() => setAtiva(e.id)}
          >
            {e.hex ? <span className="wpp-celular-amostra" style={{ background: e.hex }} aria-hidden="true" /> : null}
            {e.titulo}
            {e.equipe && <small>{e.equipe}</small>}
            {conferidos.includes(e.id) && <CheckCircle2 size={14} aria-label="conferido" />}
          </button>
        ))}
      </div>

      {etapa && (
        <div className="wpp-etapa-corpo">
          <ul className="wpp-numeros">
            {numeros.map((n) => {
              const acoes = acoesPossiveis(n.estado, agora);
              const restante = tempoRestante(n.estado, agora);
              const aberto = formulario?.chave === n.chave ? formulario : null;
              return (
                <li key={n.chave} className={`wpp-numero wpp-${n.estado.situacao.toLowerCase()}`}>
                  <div className="wpp-numero-quem">
                    <strong>{n.retrato.codigo || n.retrato.vaga}</strong>
                    <span>
                      {n.retrato.codigo
                        ? `${n.retrato.operador || 'vaga vazia'}${etapa.id !== GRUPO_SEM_CELULAR ? ` · ${n.retrato.vaga}` : ''}`
                        : 'backup'}
                    </span>
                  </div>
                  <span className="wpp-numero-situacao">
                    <span className="wpp-bolinha" aria-hidden="true" />
                    {ROTULOS[n.estado.situacao]}
                    {restante && <small> · faltam {restante}</small>}
                  </span>
                  <div className="wpp-numero-acoes">
                    {acoes.map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={`wpp-acao ${CLASSE_DA_ACAO[a]} ${n.estado.situacao === 'OK' ? 'discreta' : ''}`}
                        onClick={() => agir(n, a)}
                      >
                        <span aria-hidden="true">{ACAO[a].emoji}</span> {ACAO[a].botao}
                      </button>
                    ))}
                  </div>
                  {aberto?.acao === 'RESTRINGIDO' && (
                    <form
                      className="wpp-numero-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        agir(n, 'RESTRINGIDO', { restricao: { quantidade: Number(quantidade.replace(',', '.')), unidade } });
                      }}
                    >
                      <input className="formatter-select" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} aria-label="Tempo da restrição" autoFocus />
                      <select className="formatter-select" value={unidade} onChange={(e) => setUnidade(e.target.value as 'horas' | 'dias')} aria-label="Unidade">
                        <option value="horas">horas</option>
                        <option value="dias">dias</option>
                      </select>
                      <button type="submit" className="btn btn-primary wpp-botao-pequeno">
                        Restringir
                      </button>
                    </form>
                  )}
                  {aberto?.acao === 'TROCOU_CHIP' && (
                    <form
                      className="wpp-numero-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        agir(n, 'TROCOU_CHIP', { numeroNovo });
                      }}
                    >
                      <input
                        className="formatter-select"
                        value={numeroNovo}
                        onChange={(e) => setNumeroNovo(e.target.value)}
                        placeholder="Número novo (opcional)"
                        aria-label="Número do chip novo"
                        autoFocus
                      />
                      <button type="submit" className="btn btn-primary wpp-botao-pequeno">
                        Confirmar
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" className={`btn ${conferidos.includes(etapa.id) ? 'btn-secondary' : 'btn-primary'} wpp-conferido`} onClick={conferir}>
            <CheckCircle2 size={18} />
            {conferidos.includes(etapa.id) ? 'Desmarcar conferido' : etapa.id === GRUPO_SEM_CELULAR ? 'Baias conferidas' : 'Celular conferido'}
          </button>
        </div>
      )}
    </section>
  );
};
