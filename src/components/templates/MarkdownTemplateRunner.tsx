import React, { useState, useMemo, useEffect } from 'react';
import {
  Copy,
  Check,
  Bookmark,
  BookmarkPlus,
  RotateCcw,
  Eye,
  EyeOff,
  FolderKanban,
  LayoutGrid,
  Terminal,
  FileSpreadsheet,
  FilePlus2,
} from 'lucide-react';
import { Task, SaveReportParams } from '../../types/task';
import { ParsedMarkdownTemplate } from '../../types/markdownTemplate';
import { UserRole } from '../../types/auth';
import { Button } from '../common/Button';
import { Panel } from '../common/Panel';
import { SectionHeading } from '../common/SectionHeading';
import { SaveReportModal } from '../common/SaveReportModal';
import { renderTemplate } from '../../utils/markdownTemplateParser';
import { generateBenhubEmail, formatToTitleCase } from '../../utils/templateHelpers';
import { ReportVisualRenderer, ReportVisualMode } from '../task/ReportVisualRenderer';

interface Props {
  template: ParsedMarkdownTemplate;
  tasks: Task[];
  fieldValues: Record<string, string>;
  onFieldChange: (fieldId: string, value: string) => void;
  onResetFields: () => void;
  onOpenSelector?: () => void;
  onStartNewReport?: () => void;
  onSaveQuick: (params: SaveReportParams) => void;
  onSaveCustom: (params: SaveReportParams) => void;
  onNotify: (message: string, type?: 'success' | 'error' | '') => void;
  userRole?: UserRole;
}

export const MarkdownTemplateRunner: React.FC<Props> = ({
  template,
  tasks,
  fieldValues,
  onFieldChange,
  onResetFields,
  onOpenSelector,
  onStartNewReport,
  onSaveQuick,
  onSaveCustom,
  onNotify,
  userRole,
}) => {
  const [copied, setCopied] = useState(false);
  const [visualMode, setVisualMode] = useState<ReportVisualMode>('cards');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [isNomeBenhubCustom, setIsNomeBenhubCustom] = useState(false);
  const [isEmailBenhubCustom, setIsEmailBenhubCustom] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const isOperator = userRole === 'operador';
  const canSaveAs = true;

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

  // Gera o texto substituindo as variáveis para cópia fiel no chat
  const renderedText = useMemo(() => {
    return renderTemplate(template.templateBody, fieldValues, tasks);
  }, [template.templateBody, fieldValues, tasks]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(renderedText);
      setCopied(true);
      onNotify('Relatório copiado para o chat da empresa com sucesso!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('Erro ao copiar relatório.', 'error');
    }
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

  const handleConfirmSaveAs = (data: {
    title: string;
    date: string;
    time: string;
    note?: string;
  }) => {
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
    onNotify('Relatório personalizado salvo no Histórico!', 'success');
  };

  const defaultSaveTitle = useMemo(() => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${template.meta.title} - ${dd}/${mm} às ${hh}:${min}`;
  }, [template.meta.title]);

  const manualFields = template.fields.filter((f) => !f.isSystemAuto);

  return (
    <div className="markdown-template-runner">
      {/* Barra de Título e Mudar Modelo */}
      <div className="runner-header-card">
        <div className="runner-header-info">
          <span className="runner-category-pill">{template.meta.category.toUpperCase()}</span>
          <h2 className="runner-title">{template.meta.title}</h2>
          <p className="runner-description">{template.meta.description}</p>
        </div>

        <div className="runner-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onStartNewReport && (
            <Button
              variant="secondary"
              onClick={onStartNewReport}
              title="Iniciar um novo relatório (mantendo o atual salvo no Histórico)"
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
            >
              <FilePlus2 size={14} />
              Novo Relatório
            </Button>
          )}
          {onOpenSelector && (
            <Button
              variant="primary"
              onClick={onOpenSelector}
              title="Abrir catálogo para escolher outro relatório"
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              <FolderKanban size={15} />
              Mudar Relatório
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

            {manualFields.length === 0 ? (
              <div className="empty-fields-note">
                <p>Este relatório utiliza apenas dados fixos ou calculados automaticamente.</p>
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

        {/* Coluna 2: Preview Visual & Ações */}
        <div className="runner-preview-column">
          <Panel>
            <div className="runner-panel-header">
              <SectionHeading title="Pré-Visualização do Relatório" />
              <div className="preview-format-toggles">
                <button
                  type="button"
                  className={`preview-format-btn ${visualMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setVisualMode('cards')}
                  title="Interface visual em cartões e métricas"
                >
                  <LayoutGrid size={13} />
                  Cartões &amp; KPIs
                </button>
                <button
                  type="button"
                  className={`preview-format-btn ${visualMode === 'terminal' ? 'active' : ''}`}
                  onClick={() => setVisualMode('terminal')}
                  title="Console Benzaiten clássico"
                >
                  <Terminal size={13} />
                  Console Benzaiten
                </button>
                <button
                  type="button"
                  className={`preview-format-btn ${visualMode === 'executive' ? 'active' : ''}`}
                  onClick={() => setVisualMode('executive')}
                  title="Ficha executiva corporativa"
                >
                  <FileSpreadsheet size={13} />
                  Ficha Executiva
                </button>
              </div>
            </div>

            <div className="runner-preview-content-box" style={{ padding: '4px', background: 'transparent', border: 'none' }}>
              <ReportVisualRenderer
                templateId={template.meta.id}
                visualMode={visualMode}
                tasks={tasks}
                fieldValues={fieldValues}
                rawReportText={renderedText}
                title={template.meta.title}
              />
            </div>

            <div className="runner-footer-actions">
              <Button
                variant="primary"
                onClick={handleCopy}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copiado para o Chat!' : 'Copiar Relatório'}
              </Button>

              <Button
                variant="secondary"
                icon={<Bookmark size={15} />}
                onClick={handleQuickSave}
                title="Salvar rapidamente no Histórico com data e hora atuais"
              >
                Salvar
              </Button>

              {canSaveAs && (
                <Button
                  variant="secondary"
                  icon={<BookmarkPlus size={15} />}
                  onClick={handleOpenSaveAs}
                  title="Salvar no Histórico personalizando título, data e notas"
                >
                  Salvar como...
                </Button>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <SaveReportModal
        isOpen={isSaveAsModalOpen}
        defaultTitle={defaultSaveTitle}
        isOperator={isOperator}
        onClose={() => setIsSaveAsModalOpen(false)}
        onSave={handleConfirmSaveAs}
      />
    </div>
  );
};
