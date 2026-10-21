import React, { useState, useRef, useEffect } from 'react';
import {
  Shuffle,
  CalendarDays,
  Users,
  Layers,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Upload,
  FileDown,
  Trash2,
  History,
  ClipboardList,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { NotificationType } from '../../types/task';
import { ImportacaoEscala, ResultadoSorteio } from '../../types/escala';
import { useEscalaBases } from '../../hooks/useEscalaBases';
import {
  textoParaLista,
  realizarSorteio,
  ultimosSorteios,
  textoDaEscala,
  historicoParaCsv,
  gerarPlanilhaEscala,
  importarPlanilhaEscala,
  csvParaHistorico,
} from '../../utils/escalaBases';
import { hojeIso, isoParaBr, diaDaSemana, ehFimDeSemana, feriadoNacional, normalizarNome } from '../../utils/calendario';
import { baixarTexto } from '../../utils/csvTexto';
import { baixarPlanilha } from '../../utils/planilhaColorida';

interface EscalaBasesHubProps {
  onNotify: (message: string, type?: NotificationType) => void;
}

export const EscalaBasesHub: React.FC<EscalaBasesHubProps> = ({ onNotify }) => {
  const {
    cadastro,
    historico,
    resultados,
    atualizarCadastro,
    salvarSorteio,
    importar,
    removerSorteio,
    limparHistorico,
  } = useEscalaBases();

  const [data, setData] = useState<string>(hojeIso);
  const [ausentes, setAusentes] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  // Os campos de texto do cadastro são editados livremente e só viram lista ao sair do campo
  const [textoBases, setTextoBases] = useState(cadastro.bases.join('\n'));
  const [textoPessoas, setTextoPessoas] = useState(cadastro.pessoas.join('\n'));

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mantém os campos de texto em dia quando o cadastro muda por importação
  useEffect(() => {
    setTextoBases(cadastro.bases.join('\n'));
    setTextoPessoas(cadastro.pessoas.join('\n'));
  }, [cadastro]);

  // Ausentes que saíram do cadastro deixam de contar
  useEffect(() => {
    const cadastradas = new Set(cadastro.pessoas.map(normalizarNome));
    setAusentes((atual) => atual.filter((a) => cadastradas.has(normalizarNome(a))));
  }, [cadastro.pessoas]);

  const jaSorteado = historico.some((r) => r.data === data);
  const feriado = data ? feriadoNacional(data) : null;
  const disponiveis = cadastro.pessoas.length - ausentes.length;
  const podeSortear = Boolean(data) && cadastro.bases.length > 0 && disponiveis > 0;

  // Resultado da data escolhida: o completo (guardado ao sortear) ou o reconstruído do histórico
  const resultado: ResultadoSorteio | null =
    resultados[data] ??
    (jaSorteado
      ? {
          data,
          atribuicoes: historico.filter((r) => r.data === data).map(({ base, responsavel }) => ({ base, responsavel })),
          ausentes: [],
          semBase: [],
          avisos: [],
        }
      : null);

  const basesDaTabela = cadastro.bases.length > 0 ? cadastro.bases : [...new Set(historico.map((r) => r.base))];
  const ultimos = ultimosSorteios(historico, basesDaTabela);

  const handleToggleAusente = (pessoa: string) => {
    setAusentes((atual) =>
      atual.includes(pessoa) ? atual.filter((p) => p !== pessoa) : [...atual, pessoa]
    );
  };

  const handleSortear = () => {
    if (!podeSortear) return;

    if (jaSorteado) {
      const confirmado = window.confirm(
        `Já existe escala para ${isoParaBr(data)}. Deseja refazer (por exemplo, depois de marcar um ausente) e substituir?`
      );
      if (!confirmado) return;
    }

    try {
      const novo = realizarSorteio(cadastro, historico, data, ausentes);
      salvarSorteio(novo);
      onNotify(`Bases sorteadas para ${isoParaBr(data)}!`, 'success');
    } catch (err: any) {
      onNotify(err.message || 'Não foi possível fazer o sorteio.', 'error');
    }
  };

  const handleCopiar = async () => {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(textoDaEscala(resultado));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
      onNotify('Escala copiada! É só colar no chat ou no e-mail.', 'success');
    } catch {
      onNotify('Não foi possível copiar para a área de transferência.', 'error');
    }
  };

  const handleBaixarPlanilha = async () => {
    if (!resultado) return;
    try {
      const livro = await gerarPlanilhaEscala(resultado, historico, basesDaTabela);
      await baixarPlanilha(livro, `escala_${resultado.data}.xlsx`);
      onNotify('Download da planilha iniciado!', 'success');
    } catch (err: any) {
      onNotify(`Erro ao gerar a planilha: ${err.message}`, 'error');
    }
  };

  const handleExportarHistorico = () => {
    if (historico.length === 0) return;
    baixarTexto(historicoParaCsv(historico), 'historico_escalas.csv');
    onNotify('Histórico exportado (compatível com o BENZAITEN).', 'success');
  };

  const handleRemoverSorteio = () => {
    if (!jaSorteado) return;
    const confirmado = window.confirm(`Apagar o sorteio de ${isoParaBr(data)} do histórico?`);
    if (!confirmado) return;
    removerSorteio(data);
    onNotify(`Sorteio de ${isoParaBr(data)} apagado.`, 'success');
  };

  const handleLimparHistorico = () => {
    if (historico.length === 0) return;
    const confirmado = window.confirm(
      'Apagar TODO o histórico? Sem ele, o rodízio recomeça pela ordem do cadastro.\n\nDica: exporte o histórico antes.'
    );
    if (!confirmado) return;
    limparHistorico();
    onNotify('Histórico apagado.', 'success');
  };

  // Importa a planilha antiga (.xlsm), o bases.xlsx ou o historico_escalas.csv do BENZAITEN
  const handleImportarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!arquivo) return;

    try {
      let importacao: ImportacaoEscala;
      if (arquivo.name.toLowerCase().endsWith('.csv')) {
        importacao = { cadastro: null, registros: csvParaHistorico(await arquivo.text()) };
      } else {
        const livro = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
        importacao = importarPlanilhaEscala(livro);
      }

      if (cadastro.bases.length + cadastro.pessoas.length > 0 && importacao.cadastro) {
        const confirmado = window.confirm(
          `O arquivo traz um cadastro com ${importacao.cadastro.bases.length} bases e ${importacao.cadastro.pessoas.length} pessoas. Substituir o cadastro atual?`
        );
        if (!confirmado) importacao = { ...importacao, cadastro: null };
      }

      const diasNovos = importar(importacao);
      const partes = [
        importacao.cadastro ? `cadastro com ${importacao.cadastro.bases.length} bases e ${importacao.cadastro.pessoas.length} pessoas` : '',
        importacao.registros.length > 0 ? `${diasNovos} dia(s) novo(s) no histórico` : '',
      ].filter(Boolean);
      onNotify(`Importado: ${partes.join(' e ') || 'nada novo'}.`, 'success');
    } catch (err: any) {
      onNotify(`Erro ao importar: ${err.message || 'arquivo ilegível'}`, 'error');
    }
  };

  return (
    <div className="formatter-root">
      {/* Cabeçalho */}
      <header className="formatter-header">
        <div className="formatter-header-info">
          <p className="eyebrow">AUTOMAÇÕES & DADOS</p>
          <h1>
            <Shuffle size={32} />
            Escala de Bases — Ativo 2
          </h1>
          <p>
            Rodízio diário das bases entre os grupos dos supervisores: a cada dia, cada pessoa anda uma base para
            frente, então ninguém repete uma base antes de passar por todas. Mesmas regras do BENZAITEN e da
            planilha de escala, com tudo salvo apenas no seu navegador.
          </p>
        </div>

        <div className="task-count">
          <span className="task-count-number">{new Set(historico.map((r) => r.data)).size}</span>
          <span className="task-count-label">sorteios no histórico</span>
        </div>
      </header>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportarArquivo}
        accept=".xlsm,.xlsx,.xls,.csv"
        style={{ display: 'none' }}
      />

      {/* Cadastro vazio: orientação inicial */}
      {cadastro.bases.length === 0 && cadastro.pessoas.length === 0 && (
        <div className="formatter-dropzone" onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0}>
          <div className="formatter-dropzone-icon-box">
            <Upload size={36} />
          </div>
          <div className="formatter-dropzone-title">Primeira vez? Importe a planilha antiga da escala</div>
          <div className="formatter-dropzone-subtitle">
            Escala_Bases_Ativo2.xlsm (cadastro + histórico), bases.xlsx ou historico_escalas.csv do BENZAITEN.
            Ou preencha o cadastro mais abaixo.
          </div>
          <div className="formatter-dropzone-tags">
            <span className="formatter-format-tag">.XLSM</span>
            <span className="formatter-format-tag">.XLSX</span>
            <span className="formatter-format-tag">.CSV</span>
          </div>
        </div>
      )}

      {/* Sorteio do dia */}
      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <CalendarDays size={20} />
            Sorteio do dia
          </h2>
          <div className="badge-wrapper">
            <span className="badge badge-muted">
              {cadastro.bases.length} bases • {disponiveis} de {cadastro.pessoas.length} pessoas disponíveis
            </span>
          </div>
        </div>

        <div className="escala-sorteio-grid">
          <div className="formatter-mapping-field mapped">
            <label htmlFor="escala-data" className="formatter-field-label">
              Data do sorteio
            </label>
            <input
              id="escala-data"
              type="date"
              className="formatter-select"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
            {data && (
              <div className="formatter-field-sample">
                <span>{diaDaSemana(data)}</span>
                {jaSorteado && ' • já sorteado'}
              </div>
            )}
          </div>

          <div className="formatter-mapping-field mapped">
            <div className="formatter-field-label">Ausentes hoje (clique para marcar)</div>
            {cadastro.pessoas.length === 0 ? (
              <div className="formatter-field-sample">Cadastre as pessoas mais abaixo.</div>
            ) : (
              <div className="formatter-sheets-list">
                {cadastro.pessoas.map((pessoa) => (
                  <button
                    key={pessoa}
                    type="button"
                    className={`formatter-sheet-pill escala-pessoa-pill ${ausentes.includes(pessoa) ? 'ausente' : ''}`}
                    onClick={() => handleToggleAusente(pessoa)}
                    title={ausentes.includes(pessoa) ? 'Ausente: fica fora do sorteio' : 'Presente'}
                  >
                    {pessoa}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {data && (ehFimDeSemana(data) || feriado) && (
          <div className="escala-aviso">
            <AlertTriangle size={16} />
            {feriado ? `${isoParaBr(data)} é feriado (${feriado}).` : `${isoParaBr(data)} cai no fim de semana.`}
          </div>
        )}

        <div className="formatter-actions-buttons">
          <button type="button" className="btn btn-primary" onClick={handleSortear} disabled={!podeSortear}>
            <Shuffle size={16} />
            {jaSorteado ? 'Refazer a escala' : 'Gerar escala do dia'}
          </button>
        </div>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="formatter-card">
          <div className="formatter-card-header">
            <h2 className="formatter-card-title">
              <ClipboardList size={20} />
              Escala de {isoParaBr(resultado.data)} ({diaDaSemana(resultado.data)})
            </h2>
            <div className="formatter-actions-buttons escala-acoes">
              <button type="button" className="btn btn-secondary" onClick={handleCopiar}>
                {isCopied ? <Check size={16} /> : <Copy size={16} />}
                {isCopied ? 'Copiado!' : 'Copiar texto'}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleBaixarPlanilha}>
                <Download size={16} />
                Baixar planilha
              </button>
            </div>
          </div>

          <div className="formatter-table-scroll">
            <table className="formatter-table">
              <thead>
                <tr>
                  <th>Base</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {resultado.atribuicoes.map((a) => (
                  <tr key={a.base}>
                    <td>{a.base}</td>
                    <td>
                      <strong>{a.responsavel}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {resultado.ausentes.length > 0 && (
            <div className="formatter-field-sample">
              Ausentes: <span>{resultado.ausentes.join(', ')}</span>
            </div>
          )}

          {resultado.avisos.map((aviso) => (
            <div key={aviso} className="escala-aviso">
              <AlertTriangle size={16} />
              {aviso}
            </div>
          ))}
        </div>
      )}

      {/* Últimos sorteios */}
      <div className="formatter-table-wrapper">
        <div className="formatter-table-header-bar">
          <div className="formatter-table-header-title">
            <History size={18} />
            <span>Últimos sorteios</span>
          </div>
          <div className="formatter-actions-buttons escala-acoes">
            <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} />
              Importar
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportarHistorico}
              disabled={historico.length === 0}
            >
              <FileDown size={16} />
              Exportar histórico
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleRemoverSorteio} disabled={!jaSorteado}>
              <Trash2 size={16} />
              Apagar dia {data ? isoParaBr(data) : ''}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleLimparHistorico}
              disabled={historico.length === 0}
            >
              <Trash2 size={16} />
              Limpar tudo
            </button>
          </div>
        </div>

        {ultimos.length === 0 ? (
          <div className="formatter-table-footer-note">
            <span>Nenhum sorteio registrado ainda.</span>
          </div>
        ) : (
          <div className="formatter-table-scroll">
            <table className="formatter-table">
              <thead>
                <tr>
                  <th>Data</th>
                  {basesDaTabela.map((base) => (
                    <th key={base}>{base}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ultimos.map((linha) => (
                  <tr key={linha.data} className={linha.data === data ? 'escala-linha-destaque' : ''}>
                    <td style={{ fontWeight: 600 }}>{isoParaBr(linha.data)}</td>
                    {linha.responsaveis.map((pessoa, i) => (
                      <td key={basesDaTabela[i]}>{pessoa || <span className="formatter-cell-empty">-</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cadastro */}
      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <Users size={20} />
            Cadastro
          </h2>
          <div className="badge-wrapper">
            <span className="badge badge-muted">Um item por linha • salvo ao sair do campo</span>
          </div>
        </div>

        <div className="escala-cadastro-grid">
          <div className="formatter-mapping-field mapped">
            <label htmlFor="escala-bases" className="formatter-field-label">
              <Layers size={14} style={{ display: 'inline', marginRight: 6 }} />
              Bases ({cadastro.bases.length})
            </label>
            <textarea
              id="escala-bases"
              className="formatter-select escala-textarea"
              value={textoBases}
              onChange={(e) => setTextoBases(e.target.value)}
              onBlur={() => atualizarCadastro({ bases: textoParaLista(textoBases) })}
              placeholder={'BASE 1\nBASE 2'}
            />
          </div>

          <div className="formatter-mapping-field mapped">
            <label htmlFor="escala-pessoas" className="formatter-field-label">
              <Users size={14} style={{ display: 'inline', marginRight: 6 }} />
              Pessoas / grupos ({cadastro.pessoas.length})
            </label>
            <textarea
              id="escala-pessoas"
              className="formatter-select escala-textarea"
              value={textoPessoas}
              onChange={(e) => setTextoPessoas(e.target.value)}
              onBlur={() => atualizarCadastro({ pessoas: textoParaLista(textoPessoas) })}
              placeholder={'FULANO\nJOANA SOUSA'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
