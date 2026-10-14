import React, { useState, useMemo, useEffect } from 'react';
import {
  Copy,
  Check,
  Download,
  Bookmark,
  RotateCcw,
  Edit3,
  Trash2,
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
import { Task } from '../../types/task';
import { ParsedMarkdownTemplate } from '../../types/markdownTemplate';
import { Button } from '../common/Button';
import { Panel } from '../common/Panel';
import { SectionHeading } from '../common/SectionHeading';
import { renderTemplate } from '../../utils/markdownTemplateParser';
import { downloadMarkdownFile } from '../../utils/aiPromptTemplate';
import { generateBenhubEmail, formatToTitleCase } from '../../utils/templateHelpers';

interface Props {
  template: ParsedMarkdownTemplate;
  tasks: Task[];
  fieldValues: Record<string, string>;
  onFieldChange: (fieldId: string, value: string) => void;
  onResetFields: () => void;
  onOpenSelector?: () => void;
  onEditTemplate?: () => void;
  onDeleteTemplate?: () => void;
  onExportTemplateFile: () => void;
  onSaveToHistory: (title: string, reportText: string) => void;
  onNotify: (message: string, type?: 'success' | 'error' | '') => void;
}

export const MarkdownTemplateRunner: React.FC<Props> = ({
  template,
  tasks,
  fieldValues,
  onFieldChange,
  onResetFields,
  onOpenSelector,
  onEditTemplate,
  onDeleteTemplate,
  onExportTemplateFile,
  onSaveToHistory,
  onNotify,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [isNomeBenhubCustom, setIsNomeBenhubCustom] = useState(false);
  const [isEmailBenhubCustom, setIsEmailBenhubCustom] = useState(false);

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

    // Se o usuário digitou diretamente em nome_benhub ou email_benhub, marca como customizado
    if (fieldId === 'nome_benhub') {
      setIsNomeBenhubCustom(value.trim().length > 0);
      return;
    }

    if (fieldId === 'email_benhub') {
      setIsEmailBenhubCustom(value.trim().length > 0);
      return;
    }

    // Sugestão automática de e-mail e formatação se estiver digitando o nome do colaborador
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

  // Gera o texto Markdown substituindo as variáveis
  const renderedMarkdown = useMemo(() => {
    return renderTemplate(template.templateBody, fieldValues, tasks);
  }, [template.templateBody, fieldValues, tasks]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(renderedMarkdown);
      setCopied(true);
      onNotify('Relatório copiado com sucesso para a área de transferência!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('Erro ao copiar relatório.', 'error');
    }
  };

  const handleDownloadFilled = () => {
    const filename = `${template.meta.title.toLowerCase().replace(/\s+/g, '-')}-${new Date()
      .toISOString()
      .slice(0, 10)}`;
    downloadMarkdownFile(filename, renderedMarkdown);
    onNotify('Download do relatório em .md realizado!', 'success');
  };

  const handleSaveHistory = () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const title = `${template.meta.title} - ${dd}/${mm}`;
    onSaveToHistory(title, renderedMarkdown);
    onNotify('Relatório salvo no Histórico com sucesso!', 'success');
  };

  // Separa campos manuais dos campos que possuem preenchimento automático pelo sistema
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
            {template.meta.isBuiltin ? (
              <span className="runner-origin-badge builtin">Padrão</span>
            ) : (
              <span className="runner-origin-badge custom">Customizado</span>
            )}
          </div>
          <p className="runner-desc">{template.meta.description}</p>
        </div>

        <div className="runner-header-actions">
          {onOpenSelector && (
            <Button
              variant="primary"
              onClick={onOpenSelector}
              title="Abrir catálogo para escolher outro modelo ou relatório"
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              <FolderKanban size={15} />
              Mudar Modelo
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={onExportTemplateFile}
            title="Baixar arquivo de template (.md) original"
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <Download size={15} />
            Baixar Template
          </Button>

          {onEditTemplate && (
            <Button
              variant="secondary"
              onClick={onEditTemplate}
              title="Editar código deste modelo"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              <Edit3 size={15} />
              Editar
            </Button>
          )}

          {onDeleteTemplate && (
            <Button
              variant="danger"
              onClick={onDeleteTemplate}
              title="Excluir este modelo customizado"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              <Trash2 size={15} />
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

            {/* Informações de variáveis automáticas do sistema */}
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

            {/* Campos Manuais */}
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
                  title="Código Markdown bruto"
                >
                  <Code size={14} />
                  Markdown Bruto
                </button>
              </div>
            </div>

            {/* Caixa de visualização */}
            <div className="runner-preview-content-box">
              {viewMode === 'raw' ? (
                <pre className="raw-markdown-view">{renderedMarkdown}</pre>
              ) : (
                <div className="formatted-markdown-view">
                  <FormattedMarkdownRenderer content={renderedMarkdown} />
                </div>
              )}
            </div>

            {/* Barra de Ações do Relatório Final */}
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
                onClick={handleSaveHistory}
                title="Salvar cópia na aba Histórico do BENHERMES"
              >
                <Bookmark size={16} />
                Salvar no Histórico
              </Button>

              <Button
                variant="secondary"
                onClick={handleDownloadFilled}
                title="Baixar este relatório em arquivo .md"
              >
                <Download size={16} />
                Baixar .md
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

// Renderizador visual elegante de Markdown puro (sem dependências externas)
const FormattedMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
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
          // Renderização de linha de tabela
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
