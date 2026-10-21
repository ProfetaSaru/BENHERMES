import React, { useState, useRef, useEffect } from 'react';
import {
  PhoneCall,
  UploadCloud,
  FileSpreadsheet,
  X,
  CalendarDays,
  Play,
  Copy,
  Check,
  Download,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CloudDownload,
} from 'lucide-react';
import { NotificationType } from '../../types/task';
import { ArquivoCarregado, ResultadoUra, TipoExportacao } from '../../types/relatorioUra';
import { useRelatorioUra } from '../../hooks/useRelatorioUra';
import { diaDaSemana, diaUtilAnterior, hojeIso, isoParaBr, normalizarNome } from '../../utils/calendario';
import { baixarTexto } from '../../utils/csvTexto';
import {
  NOMES_DOS_TIPOS,
  cadastroDaExportacao,
  comoDicionarios,
  converterData,
  importarCadastroBenzaiten,
  importarHistoricoUra,
  importarMetasBenzaiten,
  lerArquivo,
  tipoDeConfiguracao,
  tipoDoArquivo,
} from '../../utils/uraLeitura';
import { calcularRelatorio, metasAtivas } from '../../utils/uraCalculo';
import { baixarDoArgus } from '../../utils/argusApi';
import { baixarPlanilha } from '../../utils/planilhaColorida';
import { gerarPlanilhaUra, historicoUraParaCsv, htmlDoRelatorio, textoDaCelula, textoDoRelatorio } from '../../utils/uraExportacao';
import { UraTabela } from './UraTabela';
import { UraConferencia } from './UraConferencia';
import { UraConfiguracoes } from './UraConfiguracoes';

interface RelatorioUraHubProps {
  onNotify: (message: string, type?: NotificationType) => void;
}

/** Exportações esperadas para um relatório completo, na ordem em que aparecem na tela */
const ESPERADOS: TipoExportacao[] = ['desempenho', 'leads', 'tarifacao', 'esteira', 'operadores'];

/** Diferença em relação ao relatório anterior, com seta e cor (verde = melhorou) */
const Diferenca: React.FC<{ valor?: number; formato: 'dif_inteiro' | 'dif_reais'; subirEBom: boolean }> = ({
  valor,
  formato,
  subirEBom,
}) => {
  if (valor === undefined) return null;
  const bom = valor === 0 ? null : valor > 0 === subirEBom;
  return (
    <span className={`ura-dif ${bom === null ? '' : bom ? 'bom' : 'ruim'}`}>
      {valor > 0 ? <TrendingUp size={14} /> : valor < 0 ? <TrendingDown size={14} /> : null}
      {textoDaCelula(valor, formato)}
    </span>
  );
};

export const RelatorioUraHub: React.FC<RelatorioUraHubProps> = ({ onNotify }) => {
  const ura = useRelatorioUra();
  const [arquivos, setArquivos] = useState<ArquivoCarregado[]>([]);
  // O relatório é sempre do dia útil anterior (feito em 20/10 -> relatório de 19/10)
  const [dia, setDia] = useState<string>(() => diaUtilAnterior(hojeIso()));
  const [resultado, setResultado] = useState<ResultadoUra | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [regerar, setRegerar] = useState(false);
  const [isBaixandoArgus, setIsBaixandoArgus] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const metas = metasAtivas(ura.metas);

  // Arquivos ou data mudaram: o relatório na tela não vale mais
  useEffect(() => setResultado(null), [arquivos, dia]);

  // Datas presentes no desempenho e nos leads (para sugerir a data certa)
  const datasDosArquivos = [
    ...new Set(
      arquivos
        .filter((a) => a.tipo === 'desempenho' || a.tipo === 'leads')
        .flatMap((a) => a.linhas.map((l) => converterData(l['DATA'])))
        .filter(Boolean) as string[]
    ),
  ].sort();
  const sugestaoDeData = datasDosArquivos.length === 1 && datasDosArquivos[0] !== dia ? datasDosArquivos[0] : null;
  const faltando = ESPERADOS.filter((tipo) => tipo !== 'operadores' && !arquivos.some((a) => a.tipo === tipo));

  const handleArquivos = async (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    setIsLoading(true);
    const novos: ArquivoCarregado[] = [];
    const mensagens: string[] = [];
    const desconhecidos: string[] = [];

    for (const arquivo of Array.from(lista)) {
      try {
        const tabela = await lerArquivo(arquivo);
        const tipo = tipoDoArquivo(tabela.cabecalho);

        if (tipo) {
          const linhas = comoDicionarios(tabela.cabecalho, tabela.linhas);
          novos.push({ id: `${arquivo.name}-${arquivo.lastModified}`, nome: arquivo.name, tipo, linhas });
          if (tipo === 'operadores') {
            const cadastro = cadastroDaExportacao(linhas);
            ura.atualizarCadastro(cadastro);
            mensagens.push(`cadastro atualizado (${cadastro.length} operadores)`);
          }
          continue;
        }

        const configuracao = tipoDeConfiguracao(tabela);
        if (configuracao === 'cadastro_benzaiten' && tabela.livro) {
          const { operadores, apelidos } = importarCadastroBenzaiten(tabela.livro);
          ura.atualizarCadastro(operadores);
          if (apelidos.length > 0) ura.atualizarApelidos(apelidos);
          mensagens.push(`cadastro do BENZAITEN (${operadores.length} operadores, ${apelidos.length} apelidos)`);
        } else if (configuracao === 'metas_benzaiten' && tabela.livro) {
          ura.atualizarMetas(importarMetasBenzaiten(tabela.livro));
          mensagens.push('metas do BENZAITEN');
        } else if (configuracao === 'historico_benzaiten') {
          const dias = ura.importarHistorico(importarHistoricoUra(tabela.cabecalho, tabela.linhas));
          mensagens.push(`${dias} dia(s) novo(s) no histórico`);
        } else {
          desconhecidos.push(arquivo.name);
        }
      } catch (err: any) {
        console.error('Erro ao ler arquivo:', err);
        desconhecidos.push(arquivo.name);
      }
    }

    if (novos.length > 0) {
      // Um arquivo com o mesmo nome substitui o anterior
      setArquivos((atuais) => [...atuais.filter((a) => !novos.some((n) => n.nome === a.nome)), ...novos]);
      mensagens.unshift(`${novos.length} exportação(ões) carregada(s)`);
    }
    if (mensagens.length > 0) onNotify(`${mensagens.join('; ')}.`, 'success');
    if (desconhecidos.length > 0) {
      onNotify(`Não reconheci: ${desconhecidos.join(', ')}. As colunas não batem com nenhuma exportação esperada.`, 'error');
    }
    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Desempenho, leads e operadores pela API (a tarifação e a esteira continuam manuais)
  const handleBaixarArgus = async () => {
    if (!ura.argus.token.trim()) {
      onNotify('Cole o token da API do Argus em Configurações (mais abaixo) para baixar direto.', 'error');
      return;
    }
    setIsBaixandoArgus(true);
    try {
      const baixados = await baixarDoArgus(dia, ura.argus);
      // Substitui downloads anteriores da API e exportações manuais dos mesmos tipos
      const tipos = new Set(baixados.map((a) => a.tipo));
      setArquivos((atuais) => [...atuais.filter((a) => !tipos.has(a.tipo)), ...baixados]);
      const operadores = baixados.find((a) => a.tipo === 'operadores');
      if (operadores) ura.atualizarCadastro(cadastroDaExportacao(operadores.linhas));
      const [desempenho, leads] = baixados;
      onNotify(
        `Argus: ${desempenho.linhas.length} operador(es) no desempenho e ${leads.linhas.length} nos leads de ${isoParaBr(dia)}.`,
        'success'
      );
    } catch (err: any) {
      onNotify(err.message || 'Não foi possível baixar do Argus.', 'error');
    } finally {
      setIsBaixandoArgus(false);
    }
  };

  const handleRemoverArquivo = (id: string) => {
    setArquivos((atuais) => atuais.filter((a) => a.id !== id));
  };

  const handleGerar = () => {
    if (ura.cadastro.length === 0) {
      onNotify('Carregue a exportação de OPERADORES do Argus: ela forma o cadastro das equipes.', 'error');
      return;
    }
    const novo = calcularRelatorio({
      dia,
      arquivos,
      cadastro: ura.cadastro,
      apelidos: ura.apelidos,
      historico: ura.historico,
      diaAnterior: diaUtilAnterior(dia),
    });
    ura.salvarRelatorio(novo);
    setResultado(novo);
    onNotify(`Relatório de ${isoParaBr(dia)} gerado e salvo no histórico.`, 'success');
  };

  // Depois de ligar um nome pelo apelido, gera de novo com o apelido já salvo
  useEffect(() => {
    if (!regerar) return;
    setRegerar(false);
    handleGerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ura.apelidos]);

  const handleVincular = (noSistema: string, oficial: string) => {
    ura.adicionarApelido({ noSistema, oficial });
    setRegerar(true);
    onNotify(`"${noSistema}" agora conta como ${oficial}.`, 'success');
  };

  // Copia com cores (Excel e Outlook mantêm) e, de reserva, em texto com tabulação
  const handleCopiar = async () => {
    if (!resultado) return;
    try {
      const html = htmlDoRelatorio(resultado, metas);
      const texto = textoDoRelatorio(resultado);
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([texto], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(texto);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
      onNotify('Relatório copiado! Cole no Excel, no e-mail ou no chat.', 'success');
    } catch {
      onNotify('Não foi possível copiar para a área de transferência.', 'error');
    }
  };

  const handleBaixar = async () => {
    if (!resultado) return;
    try {
      await baixarPlanilha(await gerarPlanilhaUra(resultado, metas), `relatorio_produtividade_${resultado.data}.xlsx`);
      onNotify('Download da planilha iniciado!', 'success');
    } catch (err: any) {
      onNotify(`Erro ao gerar a planilha: ${err.message}`, 'error');
    }
  };

  const handleExportarHistorico = () => {
    baixarTexto(historicoUraParaCsv(ura.historico), 'relatorio_ura.csv');
    onNotify('Histórico exportado (compatível com o BENZAITEN).', 'success');
  };

  const handleRemoverDia = (data: string) => {
    if (!window.confirm(`Apagar o relatório de ${isoParaBr(data)} do histórico?`)) return;
    ura.removerDia(data);
  };

  const handleLimparHistorico = () => {
    if (!window.confirm('Apagar TODO o histórico? Sem ele, a comparação com o dia anterior recomeça do zero.')) return;
    ura.limparHistorico();
  };

  const totalGeral = resultado?.linhas.find((l) => l.tipo === 'total_geral');
  const operadoresNoRelatorio = resultado?.linhas.filter((l) => l.tipo === 'operador').length ?? 0;

  return (
    <div className="formatter-root">
      <header className="formatter-header">
        <div className="formatter-header-info">
          <p className="eyebrow">AUTOMAÇÕES & DADOS</p>
          <h1>
            <PhoneCall size={32} />
            Relatório de Produtividade URA
          </h1>
          <p>
            Arraste as exportações do dia (Argus e Vanguard) e gere o relatório com TMA, TMO, leads, custo, vendas e
            clientes por operador e por equipe. Mesmas contas do BENZAITEN, processadas 100% no seu navegador.
          </p>
        </div>
        <div className="task-count">
          <span className="task-count-number">{new Set(ura.historico.map((r) => r.data)).size}</span>
          <span className="task-count-label">relatórios no histórico</span>
        </div>
      </header>

      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".csv,.xlsx,.xls"
        onChange={(e) => handleArquivos(e.target.files)}
        style={{ display: 'none' }}
      />

      {/* Arquivos do dia */}
      <div
        className={`formatter-dropzone ${arquivos.length > 0 ? 'ura-dropzone-compacta' : ''} ${isDragging ? 'drag-active' : ''}`}
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
          handleArquivos(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {isLoading ? (
          <div className="formatter-loading-box">
            <div className="formatter-spinner" />
            <p className="formatter-dropzone-title">Lendo as exportações...</p>
          </div>
        ) : (
          <>
            <div className="formatter-dropzone-icon-box">
              <UploadCloud size={arquivos.length > 0 ? 24 : 36} />
            </div>
            <div className="formatter-dropzone-title">
              {arquivos.length > 0 ? 'Arraste mais arquivos ou clique para adicionar' : 'Arraste aqui todas as exportações do dia'}
            </div>
            {arquivos.length === 0 && (
              <div className="formatter-dropzone-subtitle">
                Desempenho (TMA/TME) e Leads URA do Argus, tarifações VENDITORE e 4NET, esteira do Vanguard e, quando
                mudar alguém de equipe, a exportação de Operadores. O nome dos arquivos não importa: eles são reconhecidos
                pelas colunas.
              </div>
            )}
            <div className="formatter-dropzone-tags">
              <span className="formatter-format-tag">.CSV</span>
              <span className="formatter-format-tag">.XLSX</span>
              <span className="formatter-format-tag">.XLS</span>
            </div>
          </>
        )}
      </div>

      {arquivos.length > 0 && (
        <div className="ura-arquivos">
          {arquivos.map((a) => (
            <div key={a.id} className="ura-arquivo">
              <FileSpreadsheet size={18} />
              <div>
                <strong>{a.nome}</strong>
                <span>
                  {NOMES_DOS_TIPOS[a.tipo]} • {a.linhas.length} linha(s)
                </span>
              </div>
              <button type="button" className="ura-arquivo-remover" onClick={() => handleRemoverArquivo(a.id)} title="Remover">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dia do relatório */}
      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <CalendarDays size={20} />
            Gerar relatório
          </h2>
          <div className="badge-wrapper">
            <span className="badge badge-muted">
              {ura.cadastro.filter((op) => normalizarNome(op.status) === 'ATIVO').length} operadores ativos no cadastro
            </span>
          </div>
        </div>

        <div className="escala-sorteio-grid">
          <div className="formatter-mapping-field mapped">
            <label htmlFor="ura-dia" className="formatter-field-label">
              Dia do relatório
            </label>
            <input id="ura-dia" type="date" className="formatter-select" value={dia} onChange={(e) => setDia(e.target.value)} />
            {dia && (
              <div className="formatter-field-sample ura-quebra">
                <span>{diaDaSemana(dia)}</span> • compara com {isoParaBr(diaUtilAnterior(dia))}
              </div>
            )}
          </div>

          <div className="formatter-mapping-field mapped">
            <div className="formatter-field-label">Exportações</div>
            <div className="formatter-sheets-list">
              {ESPERADOS.map((tipo) => {
                const tem = arquivos.some((a) => a.tipo === tipo);
                return (
                  <span key={tipo} className={`ura-check ${tem ? 'ok' : tipo === 'operadores' ? 'opcional' : 'falta'}`}>
                    {tem ? '✓' : tipo === 'operadores' ? '○' : '!'} {NOMES_DOS_TIPOS[tipo]}
                  </span>
                );
              })}
            </div>
            <div className="formatter-field-sample ura-quebra">
              Operadores é opcional: o cadastro fica salvo e só precisa ser enviado quando houver mudança.
            </div>
          </div>
        </div>

        {sugestaoDeData && (
          <div className="escala-aviso">
            <AlertTriangle size={16} />
            Os arquivos de desempenho e leads são de {isoParaBr(sugestaoDeData)}.
            <button type="button" className="btn btn-secondary ura-botao-inline" onClick={() => setDia(sugestaoDeData)}>
              Usar {isoParaBr(sugestaoDeData)}
            </button>
          </div>
        )}
        {arquivos.length > 0 && faltando.length > 0 && (
          <div className="escala-aviso">
            <AlertTriangle size={16} />
            Faltando: {faltando.map((t) => NOMES_DOS_TIPOS[t]).join(', ')}. O relatório sai, mas com essas colunas zeradas.
          </div>
        )}

        <div className="formatter-actions-buttons ura-acoes-gerar">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleBaixarArgus}
            disabled={!dia || isBaixandoArgus}
            title="Baixa desempenho (TMA/TME), leads da URA e operadores pela API do Argus"
          >
            <CloudDownload size={16} />
            {isBaixandoArgus ? 'Baixando do Argus...' : `Baixar do Argus (${dia ? isoParaBr(dia) : '...'})`}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleGerar} disabled={!dia || arquivos.length === 0}>
            <Play size={16} />
            Gerar relatório de {dia ? isoParaBr(dia) : '...'}
          </button>
        </div>
      </div>

      {/* Resultado */}
      {resultado && totalGeral && (
        <>
          <div className="formatter-actions-card">
            <div className="ura-resumo">
              <div>
                <span>Operadores</span>
                <strong>{operadoresNoRelatorio}</strong>
              </div>
              <div>
                <span>Leads URA</span>
                <strong>{textoDaCelula(totalGeral.leads, 'inteiro')}</strong>
                <Diferenca valor={totalGeral.d_leads} formato="dif_inteiro" subirEBom />
              </div>
              <div>
                <span>Vendas</span>
                <strong>{textoDaCelula(totalGeral.vendas, 'reais')}</strong>
                <Diferenca valor={totalGeral.d_vendas} formato="dif_reais" subirEBom />
              </div>
              <div>
                <span>Clientes efetivados</span>
                <strong>{textoDaCelula(totalGeral.clientes, 'inteiro')}</strong>
              </div>
              <div>
                <span>Custo total</span>
                <strong>{textoDaCelula(totalGeral.custo, 'reais')}</strong>
                <Diferenca valor={totalGeral.d_custo} formato="dif_reais" subirEBom={false} />
              </div>
            </div>
            <div className="formatter-actions-buttons escala-acoes">
              <button type="button" className="btn btn-secondary" onClick={handleCopiar}>
                {isCopied ? <Check size={16} /> : <Copy size={16} />}
                {isCopied ? 'Copiado!' : 'Copiar tabela'}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleBaixar}>
                <Download size={16} />
                Baixar planilha
              </button>
            </div>
          </div>

          <UraTabela resultado={resultado} metas={metas} />
          {resultado.dataAnterior && (
            <p className="ura-ajuda">
              Comparação com o relatório de {isoParaBr(resultado.dataAnterior)}: ▲ subiu, ▼ desceu. Verde é bom (mais leads e
              vendas, menos custo); vermelho é ruim.
            </p>
          )}
          <UraConferencia resultado={resultado} cadastro={ura.cadastro} onVincular={handleVincular} />
        </>
      )}

      <UraConfiguracoes
        cadastro={ura.cadastro}
        apelidos={ura.apelidos}
        metas={ura.metas}
        historico={ura.historico}
        argus={ura.argus}
        onArgusChange={ura.atualizarArgus}
        onApelidosChange={ura.atualizarApelidos}
        onMetasChange={ura.atualizarMetas}
        onExportarHistorico={handleExportarHistorico}
        onRemoverDia={handleRemoverDia}
        onLimparHistorico={handleLimparHistorico}
      />
    </div>
  );
};
