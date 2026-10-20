import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  Check,
  Trash2,
  Layers,
  TableProperties,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ParsedSheetData, ColumnMapping } from '../../types/formatter';
import { NotificationType } from '../../types/task';
import {
  parseSpreadsheetFile,
  extractSheetData,
  autoDetectColumns,
  getFormattedRows,
  generateFormattedCsv,
  downloadCsvFile,
  formatFileSize,
} from '../../utils/spreadsheetFormatter';

interface DataFormatterHubProps {
  onNotify: (message: string, type?: NotificationType) => void;
}

const PREVIEW_LIMIT = 50;

export const DataFormatterHub: React.FC<DataFormatterHubProps> = ({ onNotify }) => {
  const [parsedData, setParsedData] = useState<ParsedSheetData | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    cpf: '',
    beneficio: '',
    nome: '',
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processa o arquivo selecionado ou arrastado
  const handleProcessFile = async (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv', '.tsv', '.txt'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      onNotify('Formato não suportado. Por favor, envie um arquivo .xlsx, .xls, .csv, .tsv ou .txt.', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const { workbook: wb, data } = await parseSpreadsheetFile(file);

      if (data.headers.length === 0 || data.totalRows === 0) {
        onNotify('A planilha parece estar vazia ou sem dados legíveis.', 'error');
        setIsLoading(false);
        return;
      }

      setWorkbook(wb);
      setParsedData(data);

      // Auto-detecção inicial de colunas
      const detected = autoDetectColumns(data.headers);
      setMapping(detected);

      const detectedCount = [detected.cpf, detected.beneficio, detected.nome].filter(Boolean).length;
      if (detectedCount === 3) {
        onNotify(`Arquivo carregado! Todas as 3 colunas foram identificadas automaticamente.`, 'success');
      } else if (detectedCount > 0) {
        onNotify(`Arquivo carregado! ${detectedCount} de 3 colunas foram identificadas automaticamente.`, 'info');
      } else {
        onNotify(`Arquivo carregado! Por favor, selecione as colunas correspondentes abaixo.`, 'info');
      }
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err);
      onNotify(`Erro ao processar o arquivo: ${err.message || 'Arquivo corrompido ou ilegível'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
    }
  };

  // Alterna aba da planilha Excel
  const handleSelectSheet = (sheetName: string) => {
    if (!workbook || !parsedData || sheetName === parsedData.activeSheet) return;

    try {
      const newData = extractSheetData(
        workbook,
        sheetName,
        parsedData.fileName,
        parsedData.fileSizeBytes
      );

      setParsedData(newData);
      const detected = autoDetectColumns(newData.headers);
      setMapping(detected);
      onNotify(`Aba "${sheetName}" selecionada.`, 'info');
    } catch (err: any) {
      onNotify(`Erro ao alternar para a aba ${sheetName}: ${err.message}`, 'error');
    }
  };

  // Reseta estado para carregar outro arquivo
  const handleResetFile = () => {
    setParsedData(null);
    setWorkbook(null);
    setMapping({ cpf: '', beneficio: '', nome: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Verifica se o mapeamento essencial foi concluído
  const isMappingComplete = Boolean(mapping.cpf && mapping.beneficio && mapping.nome);

  // Copia o CSV formatado completo para a área de transferência
  const handleCopyCsv = async () => {
    if (!parsedData || !isMappingComplete) return;

    try {
      const csvText = generateFormattedCsv(parsedData.headers, parsedData.rows, mapping);
      await navigator.clipboard.writeText(csvText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
      onNotify(`${parsedData.totalRows.toLocaleString('pt-BR')} registros copiados no formato CSV!`, 'success');
    } catch (err) {
      onNotify('Não foi possível copiar para a área de transferência.', 'error');
    }
  };

  // Baixa o arquivo CSV com BOM UTF-8
  const handleDownloadCsv = () => {
    if (!parsedData || !isMappingComplete) return;

    try {
      const csvText = generateFormattedCsv(parsedData.headers, parsedData.rows, mapping);
      downloadCsvFile(csvText, parsedData.fileName);
      onNotify(`Download do CSV iniciado com sucesso!`, 'success');
    } catch (err: any) {
      onNotify(`Erro ao gerar download: ${err.message}`, 'error');
    }
  };

  // Obtém o valor de exemplo da primeira linha de dados para determinada coluna
  const getSampleValue = (columnName: string): string => {
    if (!parsedData || !columnName) return '';
    const colIdx = parsedData.headers.indexOf(columnName);
    if (colIdx < 0 || parsedData.rows.length === 0) return '';
    const sample = parsedData.rows[0][colIdx];
    return sample !== null && sample !== undefined ? String(sample) : '';
  };

  // Linhas formatadas para a pré-visualização (máximo 50 para ultra performance)
  const previewRows = parsedData
    ? getFormattedRows(parsedData.headers, parsedData.rows, mapping, PREVIEW_LIMIT)
    : [];

  return (
    <div className="formatter-root">
      {/* Cabeçalho */}
      <header className="formatter-header">
        <div className="formatter-header-info">
          <p className="eyebrow">AUTOMAÇÕES & DADOS</p>
          <h1>
            <TableProperties size={32} />
            Formatador de Planilha para CSV
          </h1>
          <p>
            Converta planilhas Excel e arquivos de texto para o layout oficial estruturado com colunas de
            CPF, Benefício, Nome e posições de telefone. Processamento seguro 100% no seu navegador.
          </p>
        </div>

        {parsedData && (
          <div className="task-count">
            <span className="task-count-number">{parsedData.totalRows.toLocaleString('pt-BR')}</span>
            <span className="task-count-label">linhas lidas</span>
          </div>
        )}
      </header>

      {/* Input oculto para seleção de arquivos */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".xlsx,.xls,.csv,.tsv,.txt"
        style={{ display: 'none' }}
      />

      {/* Estado 1: Upload (Dropzone) quando nenhum arquivo está carregado */}
      {!parsedData && (
        <div
          className={`formatter-dropzone ${isDragging ? 'drag-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          {isLoading ? (
            <div className="formatter-loading-box">
              <div className="formatter-spinner" />
              <p className="formatter-dropzone-title">Lendo e estruturando dados da planilha...</p>
              <p className="formatter-dropzone-subtitle">Isso pode levar alguns segundos dependendo do tamanho.</p>
            </div>
          ) : (
            <>
              <div className="formatter-dropzone-icon-box">
                <UploadCloud size={36} />
              </div>

              <div className="formatter-dropzone-title">
                Arraste e solte sua planilha aqui ou clique para selecionar
              </div>

              <div className="formatter-dropzone-subtitle">
                Detecção inteligente de colunas e conversão instantânea para CSV padrão
              </div>

              <div className="formatter-dropzone-tags">
                <span className="formatter-format-tag">.XLSX</span>
                <span className="formatter-format-tag">.XLS</span>
                <span className="formatter-format-tag">.CSV</span>
                <span className="formatter-format-tag">.TSV</span>
                <span className="formatter-format-tag">.TXT</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Estado 2: Planilha carregada */}
      {parsedData && (
        <>
          {/* Barra com dados do arquivo carregado */}
          <div className="formatter-file-bar">
            <div className="formatter-file-info">
              <div className="formatter-file-icon">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <div className="formatter-file-name">{parsedData.fileName}</div>
                <div className="formatter-file-meta">
                  <span>{formatFileSize(parsedData.fileSizeBytes)}</span>
                  <span>•</span>
                  <span>{parsedData.totalRows.toLocaleString('pt-BR')} registros identificados</span>
                  <span>•</span>
                  <span>{parsedData.headers.length} colunas</span>
                  {parsedData.headerRowIndex > 0 && (
                    <>
                      <span>•</span>
                      <span>Cabeçalho na linha {parsedData.headerRowIndex + 1}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetFile}
              title="Carregar outro arquivo"
            >
              <Trash2 size={16} />
              Substituir arquivo
            </button>
          </div>

          {/* Seletor de Abas (se houver mais de uma) */}
          {parsedData.sheetNames.length > 1 && (
            <div className="formatter-sheets-container">
              <div className="formatter-sheets-label">
                <Layers size={14} style={{ display: 'inline', marginRight: 6 }} />
                Planilha com múltiplas abas. Selecione a aba que deseja processar:
              </div>
              <div className="formatter-sheets-list">
                {parsedData.sheetNames.map((sheet) => (
                  <button
                    key={sheet}
                    type="button"
                    className={`formatter-sheet-pill ${sheet === parsedData.activeSheet ? 'active' : ''}`}
                    onClick={() => handleSelectSheet(sheet)}
                  >
                    {sheet}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Card de Mapeamento de Colunas */}
          <div className="formatter-card">
            <div className="formatter-card-header">
              <h2 className="formatter-card-title">
                <TableProperties size={20} />
                Mapeamento das Colunas Obrigatórias
              </h2>

              <div className="badge-wrapper">
                {isMappingComplete ? (
                  <span className="badge badge-success">
                    <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 4 }} />
                    Todas as 3 colunas vinculadas
                  </span>
                ) : (
                  <span className="badge badge-warning">
                    <AlertCircle size={14} style={{ display: 'inline', marginRight: 4 }} />
                    Selecione as colunas pendentes
                  </span>
                )}
              </div>
            </div>

            <div className="formatter-mapping-grid">
              {/* Coluna CPF */}
              <div className={`formatter-mapping-field ${mapping.cpf ? 'mapped' : 'missing'}`}>
                <div className="formatter-field-header">
                  <label htmlFor="select-cpf" className="formatter-field-label">
                    1. Coluna de CPF
                  </label>
                  <span className="formatter-field-required">Obrigatório</span>
                </div>

                <select
                  id="select-cpf"
                  className="formatter-select"
                  value={mapping.cpf}
                  onChange={(e) => setMapping((prev) => ({ ...prev, cpf: e.target.value }))}
                >
                  <option value="">-- Selecione a coluna de CPF --</option>
                  {parsedData.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>

                {mapping.cpf && (
                  <div className="formatter-field-sample">
                    1ª linha: <span>{getSampleValue(mapping.cpf) || '(vazio)'}</span>
                  </div>
                )}
              </div>

              {/* Coluna Benefício */}
              <div className={`formatter-mapping-field ${mapping.beneficio ? 'mapped' : 'missing'}`}>
                <div className="formatter-field-header">
                  <label htmlFor="select-beneficio" className="formatter-field-label">
                    2. Coluna de BENEFÍCIO
                  </label>
                  <span className="formatter-field-required">Obrigatório</span>
                </div>

                <select
                  id="select-beneficio"
                  className="formatter-select"
                  value={mapping.beneficio}
                  onChange={(e) => setMapping((prev) => ({ ...prev, beneficio: e.target.value }))}
                >
                  <option value="">-- Selecione a coluna de Benefício --</option>
                  {parsedData.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>

                {mapping.beneficio && (
                  <div className="formatter-field-sample">
                    1ª linha: <span>{getSampleValue(mapping.beneficio) || '(vazio)'}</span>
                  </div>
                )}
              </div>

              {/* Coluna Nome */}
              <div className={`formatter-mapping-field ${mapping.nome ? 'mapped' : 'missing'}`}>
                <div className="formatter-field-header">
                  <label htmlFor="select-nome" className="formatter-field-label">
                    3. Coluna de NOME
                  </label>
                  <span className="formatter-field-required">Obrigatório</span>
                </div>

                <select
                  id="select-nome"
                  className="formatter-select"
                  value={mapping.nome}
                  onChange={(e) => setMapping((prev) => ({ ...prev, nome: e.target.value }))}
                >
                  <option value="">-- Selecione a coluna de Nome --</option>
                  {parsedData.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>

                {mapping.nome && (
                  <div className="formatter-field-sample">
                    1ª linha: <span>{getSampleValue(mapping.nome) || '(vazio)'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Barra de Ações (Download e Cópia) */}
          <div className="formatter-actions-card">
            <div className="formatter-actions-stats">
              <div className="formatter-stat-pill">
                <CheckCircle2 size={18} style={{ color: isMappingComplete ? 'var(--green)' : 'var(--muted)' }} />
                <span>
                  {isMappingComplete
                    ? `${parsedData.totalRows.toLocaleString('pt-BR')} registros prontos para exportar`
                    : 'Aguardando mapeamento das 3 colunas'}
                </span>
              </div>
            </div>

            <div className="formatter-actions-buttons">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopyCsv}
                disabled={!isMappingComplete}
                title="Copiar todo o CSV formatado para a área de transferência"
              >
                {isCopied ? <Check size={16} /> : <Copy size={16} />}
                {isCopied ? 'Copiado para Área de Transferência!' : 'Copiar CSV'}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownloadCsv}
                disabled={!isMappingComplete}
                title="Baixar arquivo CSV formatado com delimitador ;"
              >
                <Download size={16} />
                Baixar CSV ({parsedData.totalRows.toLocaleString('pt-BR')} linhas)
              </button>
            </div>
          </div>

          {/* Tabela de Pré-visualização com limite de 50 linhas para fluidez máxima */}
          <div className="formatter-table-wrapper">
            <div className="formatter-table-header-bar">
              <div className="formatter-table-header-title">
                <TableProperties size={18} />
                <span>Pré-visualização do CSV Formatado</span>
              </div>

              <div className="badge-wrapper">
                <span className="badge badge-primary">
                  Exibindo as primeiras {Math.min(PREVIEW_LIMIT, parsedData.totalRows)} de {parsedData.totalRows.toLocaleString('pt-BR')} linhas
                </span>
              </div>
            </div>

            <div className="formatter-table-scroll">
              <table className="formatter-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>CPF</th>
                    <th>BENEFICIO</th>
                    <th>NOME</th>
                    <th>TELEFONE1</th>
                    <th>TELEFONE2</th>
                    <th>TELEFONE3</th>
                    <th>TELEFONE4</th>
                    <th>TELEFONE5</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ color: 'var(--muted)', fontWeight: 600 }}>{idx + 1}</td>
                      <td>{row.cpf || <span className="formatter-cell-empty">-</span>}</td>
                      <td>{row.beneficio || <span className="formatter-cell-empty">-</span>}</td>
                      <td>{row.nome || <span className="formatter-cell-empty">-</span>}</td>
                      <td><span className="formatter-cell-empty">;</span></td>
                      <td><span className="formatter-cell-empty">;</span></td>
                      <td><span className="formatter-cell-empty">;</span></td>
                      <td><span className="formatter-cell-empty">;</span></td>
                      <td><span className="formatter-cell-empty">;</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="formatter-table-footer-note">
              <span>
                💡 O arquivo gerado contém o cabeçalho oficial e as 5 colunas de telefones com delimitador ponto-e-vírgula (<code>;</code>) vazias para preenchimento.
              </span>
              <span>
                Exportação processa 100% dos dados.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
