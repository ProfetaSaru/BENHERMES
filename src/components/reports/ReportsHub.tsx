import React, { useState, useMemo, useEffect } from 'react';
import {
  RotateCcw,
  FolderKanban,
  CheckCircle2,
  FilePlus2,
} from 'lucide-react';
import { Task, TaskFormData, NotificationState, NotificationType, SaveReportParams } from '../../types/task';
import { VerticalReportSelector } from './VerticalReportSelector';
import { TaskForm } from '../task/TaskForm';
import { ReportPanel } from '../task/ReportPanel';
import { MarkdownTemplateRunner } from '../templates/MarkdownTemplateRunner';
import { NotificationToast } from '../common/NotificationToast';
import { Panel } from '../common/Panel';
import { SectionHeading } from '../common/SectionHeading';
import { Button } from '../common/Button';
import { useMarkdownTemplates } from '../../hooks/useMarkdownTemplates';
import { renderTemplate } from '../../utils/markdownTemplateParser';

interface Props {
  tasks: Task[];
  formData: TaskFormData;
  isEditing: boolean;
  onFieldChange: (field: keyof TaskFormData, value: string) => void;
  onSubmitTask: (e: React.FormEvent) => void;
  onCancelEditTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string, title: string) => void;
  onRequestClearAll: () => void;
  onSaveReportQuick: (params: SaveReportParams) => void;
  onSaveReportCustom: (params: SaveReportParams) => void;
  notification: NotificationState;
  onNotify: (message: string, type?: NotificationType) => void;
  templateControls: ReturnType<typeof useMarkdownTemplates>;
  getTemplateTaskCount?: (templateId: string) => number;
  autoSaveStatus?: 'idle' | 'saving' | 'saved';
  lastAutoSavedTime?: string | null;
  onStartNewReport?: () => void;
}

export const ReportsHub: React.FC<Props> = ({
  tasks,
  formData,
  isEditing,
  onFieldChange,
  onSubmitTask,
  onCancelEditTask,
  onEditTask,
  onDeleteTask,
  onRequestClearAll,
  onSaveReportQuick,
  onSaveReportCustom,
  notification,
  onNotify,
  templateControls,
  getTemplateTaskCount,
  autoSaveStatus = 'idle',
  lastAutoSavedTime,
  onStartNewReport,
}) => {
  const {
    templates,
    activeTemplateId,
    parsedActiveTemplate,
    fieldValues,
    setFieldValue,
    resetFieldValues,
    selectTemplate,
  } = templateControls;

  // Drawer do Seletor de Modelos (escondido por padrão até o usuário clicar)
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectorOpen) {
        setIsSelectorOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectorOpen]);

  const isExpandable = parsedActiveTemplate.meta.expandable === true;

  // Texto renderizado para o modelo expansível atual
  const renderedTemplateMarkdown = useMemo(() => {
    return renderTemplate(parsedActiveTemplate.templateBody, fieldValues, tasks);
  }, [parsedActiveTemplate.templateBody, fieldValues, tasks]);

  // Campos manuais do modelo expansível (se houver, ex: colaborador, observações, etc.)
  const manualFieldsForExpandable = useMemo(() => {
    return parsedActiveTemplate.fields.filter((f) => !f.isSystemAuto);
  }, [parsedActiveTemplate.fields]);

  return (
    <div className="reports-hub-unified-container">
      {notification.message && (
        <NotificationToast message={notification.message} type={notification.type} />
      )}

      {/* Drawer / Painel Suspenso com o Seletor de Modelos */}
      {isSelectorOpen && (
        <div
          className="selector-drawer-backdrop"
          onClick={() => setIsSelectorOpen(false)}
          aria-modal="true"
          role="dialog"
        >
          <div className="selector-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <VerticalReportSelector
              templates={templates}
              activeTemplateId={activeTemplateId}
              onSelectTemplate={(id) => {
                selectTemplate(id);
                setIsSelectorOpen(false);
              }}
              onClose={() => setIsSelectorOpen(false)}
              taskCount={tasks.length}
              getTemplateTaskCount={getTemplateTaskCount}
            />
          </div>
        </div>
      )}

      <div className="reports-hub-main-split">
        <section className="reports-hub-content-area">
          {isExpandable ? (
            /* VISÃO PARA MODELOS EXPANSÍVEIS (Integrados com tarefas diárias) */
            <div className="expandable-workspace-wrapper">
              <div className="report-active-header-banner">
                <div className="active-header-info">
                  <div className="active-header-tags-row">
                    <span className="active-header-title">{parsedActiveTemplate.meta.title}</span>
                    <span className="active-header-badge expandable">Relatório Expansível</span>
                    <span className="active-header-badge tasks-count">
                      {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}
                    </span>
                    {autoSaveStatus === 'saving' && (
                      <span className="active-header-badge" style={{ opacity: 0.85 }}>
                        Salvando automaticamente...
                      </span>
                    )}
                    {autoSaveStatus === 'saved' && lastAutoSavedTime && (
                      <span
                        className="active-header-badge expandable"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <CheckCircle2 size={12} />
                        Salvo automaticamente às {lastAutoSavedTime}
                      </span>
                    )}
                  </div>
                  <p className="active-header-desc">{parsedActiveTemplate.meta.description}</p>
                </div>

                <div className="active-header-actions">
                  {onStartNewReport && (
                    <Button
                      variant="secondary"
                      onClick={onStartNewReport}
                      title="Iniciar um novo relatório limpo (mantendo o atual salvo no Histórico)"
                      style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                    >
                      <FilePlus2 size={14} />
                      Novo Relatório
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    onClick={() => setIsSelectorOpen(true)}
                    title="Abrir catálogo para mudar de modelo de relatório"
                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                  >
                    <FolderKanban size={15} />
                    Mudar Modelo
                  </Button>
                </div>
              </div>

              {/* Bloco de Campos Adicionais do Modelo */}
              {manualFieldsForExpandable.length > 0 && (
                <Panel className="expandable-extra-fields-panel">
                  <div className="extra-fields-header">
                    <SectionHeading
                      kicker="Informações do Relatório"
                      title="Campos do Modelo"
                    />
                    <button
                      type="button"
                      className="runner-reset-btn"
                      onClick={resetFieldValues}
                      title="Limpar campos do modelo"
                    >
                      <RotateCcw size={13} />
                      Limpar Campos
                    </button>
                  </div>

                  <div className="extra-fields-grid">
                    {manualFieldsForExpandable.map((field) => (
                      <div key={field.id} className="form-group extra-field-group">
                        <label className="form-label" htmlFor={`extra-${field.id}`}>
                          {field.label}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea
                            id={`extra-${field.id}`}
                            className="textarea-field"
                            rows={2}
                            value={fieldValues[field.id] || ''}
                            onChange={(e) => setFieldValue(field.id, e.target.value)}
                            placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
                          />
                        ) : (
                          <input
                            id={`extra-${field.id}`}
                            type="text"
                            className="input-field"
                            value={fieldValues[field.id] || ''}
                            onChange={(e) => {
                              const val =
                                field.id === 'nome_completo' ||
                                field.id === 'colaborador' ||
                                field.id === 'nome_colaborador'
                                  ? e.target.value.toUpperCase()
                                  : e.target.value;
                              setFieldValue(field.id, val);
                            }}
                            placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {/* Layout Dual Clássico: Cadastro de Tarefas + Painel de Pré-visualização e Cópia */}
              <div className="layout">
                <TaskForm
                  formData={formData}
                  isEditing={isEditing}
                  notification={notification}
                  onFieldChange={onFieldChange}
                  onSubmit={onSubmitTask}
                  onCancelEdit={onCancelEditTask}
                  templateCategories={parsedActiveTemplate.meta.categories}
                  itemLabel={parsedActiveTemplate.meta.itemLabel}
                />

                <ReportPanel
                  tasks={tasks}
                  onEditTask={onEditTask}
                  onDeleteTask={onDeleteTask}
                  onRequestClearAll={onRequestClearAll}
                  onSaveReportQuick={(customText) =>
                    onSaveReportQuick({
                      templateId: parsedActiveTemplate.meta.id,
                      templateTitle: parsedActiveTemplate.meta.title,
                      templateCategory: parsedActiveTemplate.meta.category,
                      isExpandable: true,
                      fieldValues,
                      tasks,
                      reportText: customText || renderedTemplateMarkdown,
                    })
                  }
                  onSaveReportCustom={(params) =>
                    onSaveReportCustom({
                      templateId: parsedActiveTemplate.meta.id,
                      templateTitle: parsedActiveTemplate.meta.title,
                      templateCategory: parsedActiveTemplate.meta.category,
                      isExpandable: true,
                      fieldValues,
                      tasks,
                      reportText: params.customText || renderedTemplateMarkdown,
                      title: params.title,
                      date: params.date,
                      time: params.time,
                      note: params.note,
                    })
                  }
                  onNotify={onNotify}
                  activeTemplateText={renderedTemplateMarkdown}
                  activeTemplateTitle={parsedActiveTemplate.meta.title}
                />
              </div>
            </div>
          ) : (
            /* VISÃO PARA MODELOS NÃO EXPANSÍVEIS (Formulários Diretos) */
            <div className="non-expandable-workspace-wrapper">
              <MarkdownTemplateRunner
                template={parsedActiveTemplate}
                tasks={tasks}
                fieldValues={fieldValues}
                onFieldChange={setFieldValue}
                onResetFields={resetFieldValues}
                onOpenSelector={() => setIsSelectorOpen(true)}
                onSaveQuick={onSaveReportQuick}
                onSaveCustom={onSaveReportCustom}
                onNotify={onNotify}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
