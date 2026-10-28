import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, ClipboardCopy } from 'lucide-react';
import { NotificationType } from '../../types/task';
import { EventoWhatsapp, MapaWhatsapp, Situacao } from '../../types/whatsapp';
import { FeriadoLocal } from '../../utils/calendario';
import { AlvoAlerta } from '../../utils/whatsappAlertas';
import { ROTULOS } from '../../utils/whatsappBaias';
import { Grupo, Periodo, calcularEstatisticas, formatarDuracao } from '../../utils/whatsappEstatisticas';
import { ROTULO_JANELA } from '../../utils/whatsappManutencao';

interface EstatisticasProps {
  mapa: MapaWhatsapp;
  agora: Date;
  feriados: FeriadoLocal[];
  onAbrir: (alvo: AlvoAlerta) => void;
  onNotify: (message: string, type?: NotificationType) => void;
}

const PERIODOS: [Periodo, string][] = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
  [365, '12 meses'],
];

const SITUACOES: Situacao[] = ['OK', 'BANIDO', 'ANALISE', 'PERMANENTE', 'RESTRINGIDO', 'NAO_TEM'];
const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const dois = (n: number) => String(n).padStart(2, '0');
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`);
const ondeDe = (l: { codigo: string; celular: string }) => l.codigo || (l.celular ? `backup · ${l.celular}` : 'backup');

/** Alvo para abrir no mapa a partir da chave do número */
const alvoDaChave = (mapa: MapaWhatsapp, chave: string): AlvoAlerta | null => {
  const [tipo, a, b] = chave.split(':');
  if (tipo === 'v') return mapa.celulares.some((c) => c.id === a && c.vagas.some((v) => v.id === b)) ? { tipo: 'vaga', celularId: a, vagaId: b } : null;
  const sala = mapa.salas.find((s) => s.mesas.some((m) => m.id === a && m.lugares[b]));
  return sala ? { tipo: 'lugar', salaId: sala.id, mesaId: a, posicao: b } : null;
};

/** Colunas de quedas por dia (uma série: o título nomeia, sem legenda) */
const QuedasPorDia: React.FC<{ dados: { dia: string; quedas: number }[] }> = ({ dados }) => {
  // Desenha na largura real do cartão (sem esticar textos)
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(600);
  useEffect(() => {
    if (!caixa.current) return;
    const observador = new ResizeObserver(([e]) => setLargura(Math.max(240, Math.floor(e.contentRect.width))));
    observador.observe(caixa.current);
    return () => observador.disconnect();
  }, []);
  const max = Math.max(1, ...dados.map((d) => d.quedas));
  const passo = max <= 4 ? 1 : Math.ceil(max / 4);
  const topo = Math.ceil(max / passo) * passo;
  const L = 28;
  const A = 140;
  const coluna = (largura - L) / Math.max(1, dados.length);
  const barra = Math.max(2, Math.min(16, coluna - 2));
  const y = (v: number) => A - (v / topo) * A;
  const marcas = Array.from({ length: topo / passo + 1 }, (_, i) => i * passo);
  const rotuloACada = Math.ceil(dados.length / Math.max(2, Math.floor(largura / 70)));
  const total = dados.reduce((t, d) => t + d.quedas, 0);

  return (
    <div ref={caixa} className="wpp-grafico-caixa">
    <svg
      className="wpp-grafico"
      width={largura}
      height={A + 26}
      viewBox={`0 0 ${largura} ${A + 26}`}
      role="img"
      aria-label={`Quedas por dia: ${total} no período, no máximo ${max} num dia`}
    >
      {marcas.map((m) => (
        <g key={m}>
          <line x1={L} x2={largura} y1={y(m) + 4} y2={y(m) + 4} className="wpp-grafico-grade" />
          <text x={L - 6} y={y(m) + 8} className="wpp-grafico-eixo" textAnchor="end">
            {m}
          </text>
        </g>
      ))}
      {dados.map((d, i) => {
        const x = L + i * coluna + (coluna - barra) / 2;
        const h = (d.quedas / topo) * A;
        const r = Math.min(4, barra / 2, h);
        return (
          <g key={d.dia} className="wpp-grafico-coluna">
            <rect x={L + i * coluna} y={0} width={coluna} height={A + 4} className="wpp-grafico-alvo">
              <title>{`${diaCurto(d.dia)}: ${d.quedas} queda(s)`}</title>
            </rect>
            {d.quedas > 0 && (
              <path
                d={`M${x},${A + 4} V${A + 4 - h + r} Q${x},${A + 4 - h} ${x + r},${A + 4 - h} H${x + barra - r} Q${x + barra},${A + 4 - h} ${x + barra},${A + 4 - h + r} V${A + 4} Z`}
                className="wpp-grafico-barra"
              />
            )}
            {i % rotuloACada === 0 && (
              <text x={L + i * coluna + coluna / 2} y={A + 22} className="wpp-grafico-eixo" textAnchor="middle">
                {diaCurto(d.dia)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
    </div>
  );
};

/** Barra horizontal fina com o valor em texto ao lado */
const Barra: React.FC<{ valor: number; max: number; classe: string; rotulo: string }> = ({ valor, max, classe, rotulo }) => (
  <span className="wpp-barra" title={rotulo}>
    <span className={`wpp-barra-cheia ${classe}`} style={{ width: `${max > 0 ? Math.max(2, (valor / max) * 100) : 0}%` }} />
  </span>
);

type OrdemOperador = 'nome' | 'quedas' | 'tempoOk' | 'sequenciaDias';

/** Tela de estatísticas: números grandes, gráficos, rankings, calendário, histórico e manutenções */
export const Estatisticas: React.FC<EstatisticasProps> = ({ mapa, agora, feriados, onAbrir, onNotify }) => {
  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [ordem, setOrdem] = useState<{ campo: OrdemOperador; desc: boolean }>({ campo: 'quedas', desc: true });
  const [equipe, setEquipe] = useState('');
  const [situacao, setSituacao] = useState<Situacao | ''>('');
  const [manutencaoAberta, setManutencaoAberta] = useState<string | null>(null);
  const textoRef = useRef<HTMLPreElement>(null);
  const e = useMemo(() => calcularEstatisticas(mapa, periodo, agora, feriados), [mapa, periodo, agora, feriados]);

  const desde = new Date(Math.max(e.de.getTime(), new Date(mapa.inicioDoHistorico).getTime()));
  const equipes = [...new Set(mapa.salas.flatMap((s) => s.mesas.map((m) => m.sigla)))];

  const operadores = [...e.porOperador].sort((a, b) => {
    const va = a[ordem.campo];
    const vb = b[ordem.campo];
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'pt-BR') : ((va as number | null) ?? -1) - ((vb as number | null) ?? -1);
    return ordem.desc ? -cmp : cmp;
  });
  const ordenar = (campo: OrdemOperador) => setOrdem((o) => ({ campo, desc: o.campo === campo ? !o.desc : campo !== 'nome' }));
  const seta = (campo: OrdemOperador) => (ordem.campo === campo ? (ordem.desc ? ' ↓' : ' ↑') : '');

  const eventos = mapa.historico
    .filter((x: EventoWhatsapp) => new Date(x.em) >= desde)
    .filter((x) => !equipe || x.equipe === equipe)
    .filter((x) => !situacao || (x.tipo !== 'OPERADOR' && (x.para === situacao || x.de === situacao)))
    .slice()
    .reverse()
    .slice(0, 50);

  const manutencoes = [...mapa.manutencoes].reverse().slice(0, 20);
  const maxQuedas = Math.max(0, ...e.maisCairam.map((l) => l.quedas));
  const maxDias = Math.max(0, ...e.maisEstaveis.map((l) => l.dias));

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      onNotify('Texto copiado.', 'success');
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

  const abrir = (chave: string) => {
    const alvo = alvoDaChave(mapa, chave);
    if (alvo) onAbrir(alvo);
    else onNotify('Esse número não existe mais no mapa.', 'info');
  };

  const grupos = (titulo: string, lista: (Grupo & { hex?: string })[], vazio: string) => (
    <div className="wpp-est-bloco">
      <h3 className="ura-subtitulo">{titulo}</h3>
      {lista.length === 0 ? (
        <p className="ura-ajuda">{vazio}</p>
      ) : (
        <ul className="wpp-est-lista">
          {lista.map((g) => (
            <li key={g.nome} className="wpp-est-grupo">
              <span className="wpp-est-nome">
                {g.hex && <span className="wpp-celular-amostra" style={{ background: g.hex }} aria-hidden="true" />}
                {g.nome}
              </span>
              <Barra valor={g.tempoOk ?? 0} max={1} classe="ok" rotulo={`Tempo OK: ${pct(g.tempoOk)}`} />
              <span className="wpp-est-valor">{pct(g.tempoOk)}</span>
              <span className={`wpp-est-quedas ${g.quedas ? 'tem' : ''}`}>{g.quedas} queda(s)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="wpp-estatisticas">
      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <BarChart3 size={20} />
            Estatísticas
          </h2>
          <div className="wpp-filtros" role="group" aria-label="Período">
            {PERIODOS.map(([p, rotulo]) => (
              <button key={p} type="button" className={`wpp-filtro ${periodo === p ? 'ativo' : ''}`} aria-pressed={periodo === p} onClick={() => setPeriodo(p)}>
                {rotulo}
              </button>
            ))}
          </div>
        </div>
        {e.poucoHistorico && (
          <p className="escala-aviso">
            Contando desde {dataHora(mapa.inicioDoHistorico).slice(0, 5)}. Os números ficam mais confiáveis com o tempo.
          </p>
        )}
        <div className="wpp-est-numeros">
          <div className="wpp-est-numero wpp-ok">
            <strong>{pct(e.tempoOk)}</strong>
            <span>Tempo OK</span>
          </div>
          <div className="wpp-est-numero wpp-banido">
            <strong>{e.quedas}</strong>
            <span>Quedas</span>
          </div>
          <div className="wpp-est-numero">
            <strong>{e.ateVoltarMs === null ? '—' : formatarDuracao(e.ateVoltarMs)}</strong>
            <span>Tempo médio até voltar</span>
          </div>
          <div className="wpp-est-numero wpp-permanente">
            <strong>{e.perdidos}</strong>
            <span>Perdidos</span>
          </div>
          <div className="wpp-est-numero">
            <strong>
              {e.manutencoes.feitas} <small>de {e.manutencoes.total}</small>
            </strong>
            <span>Manutenções feitas</span>
          </div>
        </div>

        <h3 className="ura-subtitulo">Quedas por dia</h3>
        {e.quedasPorDia.length ? <QuedasPorDia dados={e.quedasPorDia} /> : <p className="ura-ajuda">Sem dias no período.</p>}
      </div>

      <div className="wpp-est-duas">
        <div className="formatter-card">
          <h3 className="ura-subtitulo">Os que mais caíram</h3>
          {e.maisCairam.length === 0 ? (
            <p className="ura-ajuda">Nenhuma queda no período.</p>
          ) : (
            <ol className="wpp-est-lista">
              {e.maisCairam.map((l) => (
                <li key={l.chave}>
                  <button type="button" className="wpp-est-linha" onClick={() => abrir(l.chave)}>
                    <span className="wpp-est-nome">
                      <strong>{ondeDe(l)}</strong>
                      <small>{[l.operador, l.celular].filter(Boolean).join(' · ')}</small>
                    </span>
                    <Barra valor={l.quedas} max={maxQuedas} classe="banido" rotulo={`${l.quedas} queda(s)`} />
                    <span className="wpp-est-valor">{l.quedas}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="formatter-card">
          <h3 className="ura-subtitulo">Os mais estáveis</h3>
          {e.maisEstaveis.length === 0 ? (
            <p className="ura-ajuda">Nenhum número OK agora.</p>
          ) : (
            <ol className="wpp-est-lista">
              {e.maisEstaveis.map((l) => (
                <li key={l.chave}>
                  <button type="button" className="wpp-est-linha" onClick={() => abrir(l.chave)}>
                    <span className="wpp-est-nome">
                      <strong>{ondeDe(l)}</strong>
                      <small>{[l.operador, l.celular].filter(Boolean).join(' · ')}</small>
                    </span>
                    <Barra valor={l.dias} max={maxDias} classe="ok" rotulo={`${l.dias} dias seguidos OK`} />
                    <span className="wpp-est-valor">
                      {l.desdeOInicio ? '≥ ' : ''}
                      {l.dias}d
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="formatter-card">
        <h3 className="ura-subtitulo">Por operador</h3>
        {operadores.length === 0 ? (
          <p className="ura-ajuda">Sem operadores no período.</p>
        ) : (
          <div className="wpp-est-tabela">
            <table className="formatter-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" onClick={() => ordenar('nome')}>Operador{seta('nome')}</button>
                  </th>
                  <th className="num">
                    <button type="button" onClick={() => ordenar('quedas')}>Quedas{seta('quedas')}</button>
                  </th>
                  <th className="num">
                    <button type="button" onClick={() => ordenar('tempoOk')}>Tempo OK{seta('tempoOk')}</button>
                  </th>
                  <th className="num">
                    <button type="button" onClick={() => ordenar('sequenciaDias')}>Dias seguidos OK{seta('sequenciaDias')}</button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {operadores.map((g) => (
                  <tr key={g.nome}>
                    <td>{g.nome}</td>
                    <td className={`num ${g.quedas ? 'wpp-est-ruim' : ''}`}>{g.quedas}</td>
                    <td className="num">{pct(g.tempoOk)}</td>
                    <td className="num">{g.sequenciaDias ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="wpp-est-duas">
        <div className="formatter-card">{grupos('Por celular', e.porCelular, 'Nenhum celular no período.')}</div>
        <div className="formatter-card">{grupos('Por equipe', e.porEquipe, 'Nenhuma equipe no período.')}</div>
      </div>

      <div className="formatter-card">
        <h3 className="ura-subtitulo">Calendário das manutenções</h3>
        <p className="wpp-est-legenda">
          <span className="wpp-dia-marca feita" aria-hidden="true" /> feita
          <span className="wpp-dia-marca nao" aria-hidden="true" /> não feita
          <span className="wpp-dia-marca futura" aria-hidden="true" /> ainda não chegou · M = manhã, A = almoço
        </p>
        {e.calendario.length === 0 ? (
          <p className="ura-ajuda">Sem dias úteis no período.</p>
        ) : (
          <div className="wpp-calendario">
            {e.calendario.map((d) => {
              const marca = (v: boolean | null) => (v === null ? 'futura' : v ? 'feita' : 'nao');
              const texto = (v: boolean | null) => (v === null ? 'ainda não chegou' : v ? 'feita' : 'não feita');
              return (
                <div key={d.dia} className="wpp-dia" title={`${diaCurto(d.dia)}: manhã ${texto(d.manha)}, almoço ${texto(d.almoco)}`}>
                  <span className="wpp-dia-data">
                    {diaCurto(d.dia)} <small>{DIAS_DA_SEMANA[new Date(`${d.dia}T12:00:00`).getDay()]}</small>
                  </span>
                  <span className="wpp-dia-janelas">
                    <span className={`wpp-dia-marca ${marca(d.manha)}`} aria-label={`manhã ${texto(d.manha)}`} />M
                    <span className={`wpp-dia-marca ${marca(d.almoco)}`} aria-label={`almoço ${texto(d.almoco)}`} />A
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="formatter-card">
        <div className="formatter-card-header">
          <h3 className="ura-subtitulo">Histórico</h3>
          <div className="wpp-est-filtros">
            <select className="formatter-select" value={equipe} onChange={(ev) => setEquipe(ev.target.value)} aria-label="Filtrar por equipe">
              <option value="">Todas as equipes</option>
              {equipes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select className="formatter-select" value={situacao} onChange={(ev) => setSituacao(ev.target.value as Situacao | '')} aria-label="Filtrar por situação">
              <option value="">Todas as situações</option>
              {SITUACOES.map((s) => (
                <option key={s} value={s}>
                  {ROTULOS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {eventos.length === 0 ? (
          <p className="ura-ajuda">Nenhuma mudança no período{equipe || situacao ? ' com esse filtro' : ''}.</p>
        ) : (
          <ul className="wpp-est-lista">
            {eventos.map((x, i) => (
              <li key={`${x.em}-${x.chave}-${i}`}>
                <button type="button" className="wpp-evento" onClick={() => abrir(x.chave)}>
                  <span className="wpp-evento-quando">{dataHora(x.em)}</span>
                  <span className="wpp-est-nome">
                    <strong>{x.codigo || x.vaga || '—'}</strong>
                    <small>{[x.operador, x.celular, x.manutencaoId ? '🔧 manutenção' : ''].filter(Boolean).join(' · ')}</small>
                  </span>
                  {x.tipo === 'OPERADOR' ? (
                    <span className="wpp-evento-mudanca">
                      👤 {x.de || '(vazia)'} → {x.para || '(vazia)'}
                    </span>
                  ) : (
                    <span className="wpp-evento-mudanca">
                      {x.de ? <span className={`wpp-chip wpp-${x.de.toLowerCase()}`}>{ROTULOS[x.de as Situacao] ?? x.de}</span> : <em>entrou</em>}
                      →
                      {x.para ? <span className={`wpp-chip wpp-${x.para.toLowerCase()}`}>{ROTULOS[x.para as Situacao] ?? x.para}</span> : <em>saiu</em>}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="formatter-card">
        <h3 className="ura-subtitulo">Manutenções anteriores</h3>
        {manutencoes.length === 0 ? (
          <p className="ura-ajuda">Nenhuma manutenção concluída ainda.</p>
        ) : (
          <ul className="wpp-est-lista">
            {manutencoes.map((m) => (
              <li key={m.id}>
                <button type="button" className="wpp-evento" onClick={() => setManutencaoAberta(manutencaoAberta === m.id ? null : m.id)} aria-expanded={manutencaoAberta === m.id}>
                  <span className="wpp-evento-quando">{dataHora(m.inicio)}</span>
                  <span className="wpp-est-nome">
                    <strong>{ROTULO_JANELA[m.janela]}</strong>
                    <small>{m.acoes.length} ação(ões){m.observacao ? ` · ${m.observacao}` : ''}</small>
                  </span>
                  <span className="wpp-evento-mudanca">{manutencaoAberta === m.id ? 'Esconder texto' : 'Ver texto'}</span>
                </button>
                {manutencaoAberta === m.id && (
                  <div className="wpp-manutencao-resultado">
                    <pre ref={textoRef} className="wpp-texto-grupo">{m.texto}</pre>
                    <button type="button" className="btn btn-secondary wpp-botao-pequeno" onClick={() => copiar(m.texto)}>
                      <ClipboardCopy size={16} />
                      Copiar texto
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
