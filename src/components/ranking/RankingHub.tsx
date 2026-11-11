import React, { useMemo, useRef, useState } from 'react';
import {
  Trophy,
  UploadCloud,
  FileSpreadsheet,
  X,
  CalendarDays,
  Play,
  Download,
  RefreshCw,
  Copy,
  Check,
  Shuffle,
  History,
  AlertTriangle,
  Info,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { NotificationType } from '../../types/task';
import { ProvedorComentarios, RegistroRanking, RelatorioRanking } from '../../types/ranking';
import { useRanking } from '../../hooks/useRanking';
import { gerarRelatorio, lerEsteira, qualEsteira } from '../../utils/ranking/calculo';
import { carregarTemplateRanking, gerarPlanilhaRanking, nomeDaPlanilhaRanking } from '../../utils/ranking/planilha';
import { legendaDoDia } from '../../utils/ranking/legenda';
import { conferirFrases, descrever } from '../../../server/ranking/frases';
import { baixarPlanilha } from '../../utils/planilhaColorida';
import { hojeIso, isoParaBr, diaDaSemana } from '../../utils/calendario';
import { RankingTabela } from './RankingTabela';
import { RankingConfiguracao } from './RankingConfiguracao';

interface RankingHubProps {
  onNotify: (message: string, type?: NotificationType) => void;
  usuario: string;
}

type TipoEsteira = 'andamento' | 'pagamento';

interface Esteira {
  nome: string;
  tipo: TipoEsteira;
  linhas: Record<string, string>[];
}

interface Aviso {
  id: number;
  texto: string;
  tipo: 'info' | 'erro';
}

const NOME_DA_ESTEIRA: Record<TipoEsteira, string> = {
  andamento: 'Esteira de Andamento',
  pagamento: 'Esteira de Pagamento',
};

const NOME_DO_PROVEDOR: Record<ProvedorComentarios, string> = {
  chatgpt: 'Comentários: ChatGPT',
  claude: 'Comentários: Claude',
  frases: 'Comentários: frases prontas',
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const RankingHub: React.FC<RankingHubProps> = ({ onNotify, usuario }) => {
  const ranking = useRanking();
  const { config } = ranking;

  const [esteiras, setEsteiras] = useState<Esteira[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dia, setDia] = useState<string>(hojeIso);
  const [relatorio, setRelatorio] = useState<RelatorioRanking | null>(null);
  const [provedor, setProvedor] = useState<ProvedorComentarios | null>(null);
  const [registroId, setRegistroId] = useState<string | null>(null);
  const [legenda, setLegenda] = useState('');
  const [variacao, setVariacao] = useState(0);
  const [gerando, setGerando] = useState(false);
  const [comentando, setComentando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const proximoAviso = useRef(1);

  // Avisos ficam visíveis dentro da própria ferramenta (e também no aviso flutuante do app)
  const avisar = (texto: string, tipo: 'info' | 'erro' = 'info') => {
    setAvisos((atuais) => [...atuais, { id: proximoAviso.current++, texto, tipo }]);
    onNotify(texto, tipo === 'erro' ? 'error' : 'info');
  };
  const avisoDaConfig = (texto: string, tipo: 'success' | 'error') => {
    if (tipo === 'error') avisar(texto, 'erro');
    else onNotify(texto, 'success');
  };

  const faltando = (['andamento', 'pagamento'] as const).filter((t) => !esteiras.some((e) => e.tipo === t));
  const registroDoDia = ranking.historico.find((h) => h.dia === dia);

  const lerArquivos = async (lista: FileList | null) => {
    if (!lista) return;
    for (const arquivo of Array.from(lista)) {
      const { linhas, faltando: colunas } = lerEsteira(await arquivo.text());
      if (colunas.length > 0) {
        avisar(`${arquivo.name}: faltam as colunas ${colunas.join(', ')}. Confira se é a exportação da esteira.`, 'erro');
        continue;
      }
      const tipo = qualEsteira(linhas);
      if (!tipo) {
        avisar(`${arquivo.name}: não encontrei contratos "Pago" nem "Andamento" na coluna Etapa.`, 'erro');
        continue;
      }
      setEsteiras((atuais) => [...atuais.filter((e) => e.tipo !== tipo), { nome: arquivo.name, tipo, linhas }]);
    }
  };

  /** Pede as frases ao servidor; se ele não responder, usa as frases prontas aqui mesmo */
  const comentar = async (rel: RelatorioRanking): Promise<{ relatorio: RelatorioRanking; provedor: ProvedorComentarios }> => {
    const vendedores = descrever(rel.vendedores);
    const supervisores = descrever(rel.supervisores);
    let frasesV: string[];
    let frasesS: string[];
    let origem: ProvedorComentarios;
    try {
      const r = await ranking.pedirComentarios({ vendedores, supervisores });
      frasesV = r.vendedores;
      frasesS = r.supervisores;
      origem = r.provedor;
      r.avisos.forEach((a) => avisar(a));
    } catch {
      frasesV = conferirFrases(vendedores, [], 'vendedor').frases;
      frasesS = conferirFrases(supervisores, [], 'supervisor').frases;
      origem = 'frases';
      avisar('O servidor não respondeu; comentários feitos com frases prontas.', 'erro');
    }
    return {
      relatorio: {
        ...rel,
        vendedores: rel.vendedores.map((l, i) => ({ ...l, feedback: frasesV[i] ?? '' })),
        supervisores: rel.supervisores.map((l, i) => ({ ...l, feedback: frasesS[i] ?? '' })),
      },
      provedor: origem,
    };
  };

  const guardar = async (registro: RegistroRanking) => {
    const falha = await ranking.salvarNoHistorico(registro);
    if (falha) avisar(`Ranking gerado, mas não foi salvo no histórico: ${falha}`, 'erro');
  };

  const handleGerar = async () => {
    if (!config || faltando.length > 0 || !dia) return;
    setAvisos([]);
    setGerando(true);
    try {
      const andamento = esteiras.find((e) => e.tipo === 'andamento')!.linhas;
      const pagamento = esteiras.find((e) => e.tipo === 'pagamento')!.linhas;
      const calculado = gerarRelatorio(andamento, pagamento, config, dia);
      if (calculado.vendedores.length === 0) {
        avisar('Nenhum funcionário ativo encontrado nas esteiras. Confira a lista de funcionários ativos na configuração.', 'erro');
      }
      const { relatorio: comentado, provedor: origem } = await comentar(calculado);
      const texto = legendaDoDia(dia, config.feriados, 0);
      setRelatorio(comentado);
      setProvedor(origem);
      setLegenda(texto);
      setVariacao(0);

      const anterior = ranking.historico.find((h) => h.dia === dia);
      if (anterior && !window.confirm(`Já existe um ranking de ${isoParaBr(dia)} no histórico. Substituir pelo novo?`)) {
        setRegistroId(null);
        avisar(`O ranking de ${isoParaBr(dia)} está na tela, mas o do histórico foi mantido.`);
        return;
      }
      const id = crypto.randomUUID();
      setRegistroId(id);
      await guardar({ id, dia, geradoEm: new Date().toISOString(), geradoPor: usuario, provedor: origem, relatorio: comentado, legenda: texto });
      onNotify(`Ranking de ${isoParaBr(dia)} gerado!`, 'success');
    } catch (err: any) {
      avisar(`Não foi possível gerar o ranking: ${err?.message || 'erro desconhecido'}`, 'erro');
    } finally {
      setGerando(false);
    }
  };

  /** Atualiza o registro aberto no histórico (frases refeitas ou legenda final) */
  const atualizarRegistro = async (mudancas: Partial<RegistroRanking>) => {
    const atual = ranking.historico.find((h) => h.id === registroId);
    if (atual) await guardar({ ...atual, ...mudancas });
  };

  const handleRefazer = async () => {
    if (!relatorio) return;
    setComentando(true);
    const { relatorio: comentado, provedor: origem } = await comentar(relatorio);
    setRelatorio(comentado);
    setProvedor(origem);
    setComentando(false);
    await atualizarRegistro({ relatorio: comentado, provedor: origem });
  };

  const baixar = async (rel: RelatorioRanking) => {
    try {
      const livro = await gerarPlanilhaRanking(rel, await carregarTemplateRanking());
      await baixarPlanilha(livro, nomeDaPlanilhaRanking(rel.dia));
    } catch (err: any) {
      avisar(`Erro ao gerar a planilha: ${err?.message || 'erro desconhecido'}`, 'erro');
    }
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      avisar('O navegador não deixou copiar. Selecione o texto e use Ctrl+C.', 'erro');
      return false;
    }
  };

  const handleCopiarLegenda = async () => {
    if (!(await copiar(legenda))) return;
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
    onNotify('Legenda copiada! É só colar no grupo.', 'success');
    const atual = ranking.historico.find((h) => h.id === registroId);
    if (atual && atual.legenda !== legenda) await atualizarRegistro({ legenda });
  };

  const handleOutraVersao = () => {
    if (!relatorio || !config) return;
    const proxima = variacao + 1;
    setVariacao(proxima);
    setLegenda(legendaDoDia(relatorio.dia, config.feriados, proxima));
  };

  const handleAbrir = (h: RegistroRanking) => {
    setRelatorio(h.relatorio);
    setProvedor(h.provedor);
    setLegenda(h.legenda);
    setVariacao(0);
    setRegistroId(h.id);
    setDia(h.dia);
    setAvisos([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemover = async (h: RegistroRanking) => {
    if (!window.confirm(`Apagar o ranking de ${isoParaBr(h.dia)} do histórico?`)) return;
    const falha = await ranking.removerDoHistorico(h.id);
    if (falha) avisar(`Não foi possível apagar: ${falha}`, 'erro');
    else if (h.id === registroId) setRegistroId(null);
  };

  const historicoOrdenado = useMemo(() => [...ranking.historico].sort((a, b) => b.dia.localeCompare(a.dia)), [ranking.historico]);

  return (
    <div className="formatter-root">
      <header className="formatter-header">
        <div className="formatter-header-info">
          <p className="eyebrow">AUTOMAÇÕES & DADOS</p>
          <h1>
            <Trophy size={32} />
            Ranking de Contratos Pagos
          </h1>
          <p>
            Ranking diário de vendedores e supervisores a partir das esteiras de Andamento e Pagamento, com os comentários do
            FEEDBACK, a planilha no visual de sempre e a legenda pronta para o grupo. As esteiras são lidas só no seu
            navegador; para a IA vão apenas o primeiro nome e dados sem valores.
          </p>
        </div>
        <div className="task-count">
          <span className="task-count-number">{ranking.historico.length}</span>
          <span className="task-count-label">rankings no histórico</span>
        </div>
      </header>

      {ranking.erroDeCarga && (
        <div className="escala-aviso" role="alert">
          <AlertTriangle size={16} />
          Não foi possível carregar a configuração do servidor: {ranking.erroDeCarga}
        </div>
      )}

      {!ranking.carregando && !config && !ranking.erroDeCarga && (
        <div className="formatter-card ranking-sem-config">
          <h2 className="formatter-card-title">
            <Info size={20} />
            Falta a configuração
          </h2>
          <p>
            Antes do primeiro ranking, importe o <strong>config.json</strong> (metas, feriados e listas de pessoas) em{' '}
            <strong>Configuração do ranking</strong>, no fim da página, ou preencha os campos e salve.
          </p>
        </div>
      )}

      <input
        type="file"
        ref={arquivoRef}
        multiple
        accept=".csv,text/csv"
        onChange={(e) => {
          void lerArquivos(e.target.files);
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />

      <div
        className={`formatter-dropzone ${esteiras.length > 0 ? 'ura-dropzone-compacta' : ''} ${isDragging ? 'drag-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void lerArquivos(e.dataTransfer.files);
        }}
        onClick={() => arquivoRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') arquivoRef.current?.click();
        }}
        role="button"
        tabIndex={0}
      >
        <div className="formatter-dropzone-icon-box">
          <UploadCloud size={esteiras.length > 0 ? 24 : 36} />
        </div>
        <div className="formatter-dropzone-title">
          {esteiras.length > 0 ? 'Arraste outra esteira para trocar' : 'Arraste aqui as duas esteiras do dia'}
        </div>
        {esteiras.length === 0 && (
          <div className="formatter-dropzone-subtitle">
            Data_Andamento.csv e Data_Pagamento.csv, juntas ou uma de cada vez. O nome não importa: cada esteira é
            reconhecida pela coluna Etapa.
          </div>
        )}
        <div className="formatter-dropzone-tags">
          <span className="formatter-format-tag">.CSV</span>
        </div>
      </div>

      {esteiras.length > 0 && (
        <div className="ura-arquivos">
          {esteiras.map((e) => (
            <div key={e.tipo} className="ura-arquivo">
              <FileSpreadsheet size={18} />
              <div>
                <strong>{e.nome}</strong>
                <span>
                  {NOME_DA_ESTEIRA[e.tipo]} • {e.linhas.length} linha(s)
                </span>
              </div>
              <button
                type="button"
                className="ura-arquivo-remover"
                onClick={() => setEsteiras((atuais) => atuais.filter((x) => x.tipo !== e.tipo))}
                title="Remover"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <CalendarDays size={20} />
            Gerar ranking
          </h2>
        </div>

        <div className="escala-sorteio-grid">
          <div className="formatter-mapping-field mapped">
            <label htmlFor="ranking-dia" className="formatter-field-label">
              Dia do ranking
            </label>
            <input id="ranking-dia" type="date" className="formatter-select" value={dia} onChange={(e) => setDia(e.target.value)} />
            {dia && (
              <div className="formatter-field-sample">
                {diaDaSemana(dia)}
                {registroDoDia ? ' • já existe no histórico' : ''}
              </div>
            )}
          </div>
          <div className="formatter-mapping-field mapped">
            <div className="formatter-field-label">Esteiras</div>
            <div className="formatter-sheets-list">
              {(['andamento', 'pagamento'] as const).map((t) => {
                const tem = !faltando.includes(t);
                return (
                  <span key={t} className={`ura-check ${tem ? 'ok' : 'falta'}`}>
                    {tem ? '✓' : '!'} {NOME_DA_ESTEIRA[t]}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {avisos.map((a) => (
          <div key={a.id} className={`escala-aviso ${a.tipo === 'erro' ? 'ranking-aviso-erro' : ''}`} role={a.tipo === 'erro' ? 'alert' : 'status'}>
            {a.tipo === 'erro' ? <AlertTriangle size={16} /> : <Info size={16} />}
            <span>{a.texto}</span>
            <button type="button" className="ranking-aviso-fechar" onClick={() => setAvisos((l) => l.filter((x) => x.id !== a.id))} title="Fechar aviso">
              <X size={14} />
            </button>
          </div>
        ))}

        <div className="formatter-actions-buttons escala-acoes ura-acoes-gerar">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGerar}
            disabled={!config || faltando.length > 0 || !dia || gerando}
            title={!config ? 'Falta a configuração' : faltando.length ? 'Faltam esteiras' : undefined}
          >
            <Play size={16} />
            {gerando ? 'Gerando e pedindo os comentários...' : `Gerar ranking de ${dia ? isoParaBr(dia) : '...'}`}
          </button>
        </div>
      </div>

      {relatorio && (
        <>
          <div className="formatter-actions-card">
            <div className="ranking-resultado-info">
              <strong>Ranking de {isoParaBr(relatorio.dia)}</strong>
              {provedor && <span className={`ranking-provedor ${provedor}`}>{NOME_DO_PROVEDOR[provedor]}</span>}
            </div>
            <div className="formatter-actions-buttons escala-acoes">
              <button type="button" className="btn btn-secondary" onClick={handleRefazer} disabled={comentando}>
                <RefreshCw size={16} />
                {comentando ? 'Refazendo...' : 'Refazer comentários'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => baixar(relatorio)}>
                <Download size={16} />
                Baixar planilha
              </button>
            </div>
          </div>

          <RankingTabela relatorio={relatorio} />

          <div className="formatter-card">
            <div className="formatter-card-header">
              <h2 className="formatter-card-title">
                <Copy size={20} />
                Legenda do dia
              </h2>
              <div className="formatter-actions-buttons escala-acoes">
                <button type="button" className="btn btn-secondary" onClick={handleOutraVersao}>
                  <Shuffle size={16} />
                  Outra versão
                </button>
                <button type="button" className="btn btn-primary" onClick={handleCopiarLegenda}>
                  {copiado ? (
                    <>
                      <Check size={16} />
                      Copiado!
                    </>
                  ) : (
                    '📋 Copiar'
                  )}
                </button>
              </div>
            </div>
            <textarea
              className="formatter-select ranking-legenda"
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              aria-label="Legenda do dia"
            />
            <p className="ura-ajuda">Pode editar à vontade: o Copiar leva o que estiver no quadro, e essa versão fica no histórico.</p>
          </div>
        </>
      )}

      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <History size={20} />
            Histórico
          </h2>
          <div className="badge-wrapper">
            <span className="badge badge-muted">Salvo no servidor • até 120 rankings</span>
          </div>
        </div>
        {historicoOrdenado.length === 0 ? (
          <p className="ura-ajuda">Os rankings gerados aparecem aqui.</p>
        ) : (
          <div className="formatter-table-scroll">
            <table className="formatter-table ranking-historico">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Gerado em</th>
                  <th>Por</th>
                  <th>Comentários</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {historicoOrdenado.map((h) => (
                  <tr key={h.id} className={h.id === registroId ? 'escala-linha-destaque' : ''}>
                    <td>{isoParaBr(h.dia)}</td>
                    <td>{dataHora(h.geradoEm)}</td>
                    <td>{h.geradoPor}</td>
                    <td>{NOME_DO_PROVEDOR[h.provedor]?.replace('Comentários: ', '')}</td>
                    <td className="ranking-historico-acoes">
                      <button type="button" className="btn btn-secondary" onClick={() => handleAbrir(h)} title="Abrir">
                        <FolderOpen size={14} />
                        Abrir
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => baixar(h.relatorio)} title="Baixar planilha">
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={async () => {
                          if (await copiar(h.legenda)) onNotify('Legenda copiada!', 'success');
                        }}
                        title="Copiar legenda"
                      >
                        <Copy size={14} />
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => handleRemover(h)} title="Apagar">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RankingConfiguracao config={config} statusIa={ranking.statusIa} onSalvar={ranking.salvarConfig} onAviso={avisoDaConfig} />
    </div>
  );
};

