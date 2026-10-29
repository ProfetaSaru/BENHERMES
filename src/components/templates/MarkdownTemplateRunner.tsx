import React, { useState, useMemo, useEffect } from 'react';
import {
  Copy,
  Check,
  Download,
  Bookmark,
  BookmarkPlus,
  RotateCcw,
  Eye,
  EyeOff,
  Code,
  Sparkles,
  Layers,
  Calendar,
  Clock,
  Table,
  FolderKanban,
} from 'lucide-react';
import { Task, SaveReportParams } from '../../types/task';
import { ParsedMarkdownTemplate } from '../../types/markdownTemplate';
import { Button } from '../common/Button';
import { Panel } from '../common/Panel';
import { SectionHeading } from '../common/SectionHeading';
import { SaveReportModal } from '../common/SaveReportModal';
import { renderTemplate } from '../../utils/markdownTemplateParser';
import { generateBenhubEmail, formatToTitleCase } from '../../utils/templateHelpers';

interface Props {
  template: ParsedMarkdownTemplate;
  tasks: Task[];
  fieldValues: Record<string, string>;
  onFieldChange: (fieldId: string, value: string) => void;
  onResetFields: () => void;
  onOpenSelector?: () => void;
  onSaveQuick: (params: SaveReportParams) => void;
  onSaveCustom: (params: SaveReportParams) => void;
  onNotify: (message: string, type?: 'success' | 'error' | '') => void;
}

export const MarkdownTemplateRunner: React.FC<Props> = ({
  template,
  tasks,
  fieldValues,
  onFieldChange,
  onResetFields,
  onOpenSelector,
  onSaveQuick,
  onSaveCustom,
  onNotify,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [isNomeBenhubCustom, setIsNomeBenhubCustom] = useState(false);
  const [isEmailBenhubCustom, setIsEmailBenhubCustom] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);

  useEffect(() => {
    setIsNomeBenhubCustom(false);
    setIsEmailBenhubCustom(false);
  }, [template.meta.id]);

  const togglePasswordVisibility = (fieldId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [fieldId]: !prev[fieldId],
    }));
  };

  const handleSmartFieldChange = (fieldId: string, rawValue: string) => {
    const isNameField = fieldId === 'nome_completo' || fieldId === 'nome_colaborador';
    const value = isNameField ? rawValue.toUpperCase() : rawValue;

    onFieldChange(fieldId, value);

    if (fieldId === 'nome_benhub') {
      setIsNomeBenhubCustom(value.trim().length > 0);
      return;
    }

    if (fieldId === 'email_benhub') {
      setIsEmailBenhubCustom(value.trim().length > 0);
      return;
    }

    if (isNameField) {
      const suggestedEmail = generateBenhubEmail(rawValue);
      const titleCased = formatToTitleCase(rawValue);

      if (template.fields.some((f) => f.id === 'nome_benhub') && !isNomeBenhubCustom) {
        onFieldChange('nome_benhub', titleCased);
      }

      if (template.fields.some((f) => f.id === 'email_benhub') && !isEmailBenhubCustom) {
        onFieldChange('email_benhub', suggestedEmail);
      }
    }
  };

  const handleReset = () => {
    setIsNomeBenhubCustom(false);
    setIsEmailBenhubCustom(false);
    onResetFields();
  };

  // Gera o texto substituindo as variáveis
  const renderedText = useMemo(() => {
    return renderTemplate(template.templateBody, fieldValues, tasks);
  }, [template.templateBody, fieldValues, tasks]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(renderedText);
      setCopied(true);
      onNotify('Relatório copiado com sucesso para a área de transferência!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('Erro ao copiar relatório.', 'error');
    }
  };

  const handleDownloadTxt = () => {
    const filename = `${template.meta.title
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.txt`;
    const blob = new Blob([renderedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify('Download do relatório em .txt realizado!', 'success');
  };

  const handleQuickSave = () => {
    onSaveQuick({
      templateId: template.meta.id,
      templateTitle: template.meta.title,
      templateCategory: template.meta.category,
      isExpandable: false,
      fieldValues,
      tasks: [],
      reportText: renderedText,
    });
    onNotify('Relatório salvo no Histórico com sucesso!', 'success');
  };

  const handleOpenSaveAs = () => {
    setIsSaveAsModalOpen(true);
  };

  const handleConfirmSaveAs = (data: { title: string; date: string; time: string; note?: string }) => {
    onSaveCustom({
      templateId: template.meta.id,
      templateTitle: template.meta.title,
      templateCategory: template.meta.category,
      isExpandable: false,
      fieldValues,
      tasks: [],
      reportText: renderedText,
      title: data.title,
      date: data.date,
      time: data.time,
      note: data.note,
    });
    onNotify('Relatório salvo no Histórico com sucesso!', 'success');
  };

  const defaultSaveTitle = useMemo(() => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${template.meta.title} - ${dd}/${mm}`;
  }, [template.meta.title]);

  const manualFields = template.fields.filter((f) => !f.isSystemAuto);
  const systemFields = template.fields.filter((f) => f.isSystemAuto);

  return (
    <div className="template-runner-container">
      {/* Barra de título do modelo ativo */}
      <div className="runner-header-bar">
        <div className="runner-header-meta">
          <div className="runner-title-badge-row">
            <h3 className="runner-title">{template.meta.title}</h3>
            <span className={`runner-category-tag cat-${template.meta.category}`}>
              {template.meta.category}
            </span>
            <span className="runner-origin-badge builtin">Padrão</span>
          </div>
          <p className="runner-desc">{template.meta.description}</p>
        </div>

        <div className="runner-header-actions">
          {onOpenSelector && (
            <Button
              variant="primary"
              onClick={onOpenSelector}
              title="Abrir catálogo para escolher outro modelo de relatório"
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              <FolderKanban size={15} />
              Mudar Modelo
            </Button>
          )}
        </div>
      </div>

      <div className="runner-grid-layout">
        {/* Coluna 1: Formulário Dinâmico */}
        <div className="runner-form-column">
          <Panel>
            <div className="runner-panel-header">
              <SectionHeading title="Preenchimento dos Dados" />
              {manualFields.length > 0 && (
                <button
                  type="button"
                  className="runner-reset-btn"
                  onClick={handleReset}
                  title="Limpar todos os campos digitados"
                >
                  <RotateCcw size={13} />
                  Limpar
                </button>
              )}
            </div>

            {systemFields.length > 0 && (
              <div className="system-auto-chips-box">
                <span className="system-auto-title">
                  <Sparkles size={13} style={{ color: 'var(--blue)' }} />
                  Dados Injetados Automaticamente:
                </span>
                <div className="system-chips-list">
                  {systemFields.map((f) => (
                    <span key={f.id} className="system-chip">
                      {f.id === 'tarefas' && <Clock size={12} />}
                      {f.id === 'tarefas_tabela' && <Table size={12} />}
                      {f.id === 'tarefas_lista' && <Layers size={12} />}
                      {(f.id === 'data_atual' || f.id === 'data') && <Calendar size={12} />}
                      <strong>{f.id}</strong>
                      <span className="chip-count">
                        {f.type === 'tasks' ? `${tasks.length} tarefas cadastradas` : 'Data/Hora'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {manualFields.length === 0 ? (
              <div className="empty-fields-note">
                <p>Este modelo utiliza apenas dados automáticos ou texto fixo.</p>
                <small>Não há campos manuais necessários para preencher.</small>
              </div>
            ) : (
              <div className="runner-fields-list">
                {manualFields.map((field) => (
                  <div key={field.id} className="form-group runner-form-group">
                    <label className="form-label" htmlFor={`field-${field.id}`}>
                      {field.label}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={`field-${field.id}`}
                        className="textarea-field"
                        rows={3}
                        value={fieldValues[field.id] || ''}
                        onChange={(e) => handleSmartFieldChange(field.id, e.target.value)}
                        placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
                      />
                    ) : field.type === 'password' ? (
                      <div className="password-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          id={`field-${field.id}`}
                          type={visiblePasswords[field.id] ? 'text' : 'password'}
                          className="input-field"
                          style={{ paddingRight: '40px' }}
                          value={fieldValues[field.id] || ''}
                          onChange={(e) => handleSmartFieldChange(field.id, e.target.value)}
                          placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => togglePasswordVisibility(field.id)}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={visiblePasswords[field.id] ? 'Ocultar senha' : 'Ver senha'}
                        >
                          {visiblePasswords[field.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    ) : (
                      <input
                        id={`field-${field.id}`}
                        type="text"
                        className="input-field"
                        value={fieldValues[field.id] || ''}
                        onChange={(e) => handleSmartFieldChange(field.id, e.target.value)}
                        placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Coluna 2: Preview & Ações */}
        <div className="runner-preview-column">
          <Panel>
            <div className="runner-panel-header">
              <SectionHeading title="Pré-Visualização do Relatório" />
              <div className="preview-view-toggle">
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === 'formatted' ? 'active' : ''}`}
                  onClick={() => setViewMode('formatted')}
                  title="Visualização estruturada"
                >
                  <Eye size={14} />
                  Formatado
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === 'raw' ? 'active' : ''}`}
                  onClick={() => setViewMode('raw')}
                  title="Texto puro para cópia"
                >
                  <Code size={14} />
                  Texto Puro
                </button>
              </div>
            </div>

            <div className="runner-preview-content-box">
              {viewMode === 'raw' ? (
                <pre className="raw-markdown-view">{renderedText}</pre>
              ) : (
                <div className="formatted-markdown-view">
                  <FormattedReportRenderer content={renderedText} />
                </div>
              )}
            </div>

            <div className="runner-footer-actions">
              <Button
                variant="primary"
                onClick={handleCopy}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copiado para Transferência!' : 'Copiar Relatório'}
              </Button>

              <Button
                variant="secondary"
                icon={<Bookmark size={15} />}
                onClick={handleQuickSave}
                title="Salvar rapidamente no Histórico com data e hora atuais"
              >
                Salvar
              </Button>

              <Button
                variant="secondary"
                icon={<BookmarkPlus size={15} />}
                onClick={handleOpenSaveAs}
                title="Salvar no Histórico personalizando título, data e notas"
              >
                Salvar como...
              </Button>

              <Button
                variant="secondary"
                onClick={handleDownloadTxt}
                title="Baixar este relatório em arquivo .txt"
              >
                <Download size={16} />
                Baixar .txt
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      <SaveReportModal
        isOpen={isSaveAsModalOpen}
        defaultTitle={defaultSaveTitle}
        onClose={() => setIsSaveAsModalOpen(false)}
        onSave={handleConfirmSaveAs}
      />
    </div>
  );
};

const FormattedReportRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');

  return (
    <div className="rendered-doc">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="doc-spacer" />;
        }

        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={idx} className="doc-h1">
              {trimmed.slice(2)}
            </h1>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="doc-h2">
              {trimmed.slice(3)}
            </h2>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="doc-h3">
              {trimmed.slice(4)}
            </h3>
          );
        }

        if (trimmed === '---') {
          return <hr key={idx} className="doc-hr" />;
        }

        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          const cells = trimmed
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
          const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));

          if (isSeparator) {
            return null;
          }

          return (
            <div key={idx} className="doc-table-row">
              {cells.map((cell, cIdx) => (
                <div key={cIdx} className="doc-table-cell">
                  {cell.replace(/\*\*(.*?)\*\*/g, '$1')}
                </div>
              ))}
            </div>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="doc-bullet-line">
              <span className="doc-bullet-dot">•</span>
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="doc-p">
            {line}
          </p>
        );
      })}
    </div>
  );
};
