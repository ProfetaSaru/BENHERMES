import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  RotateCcw,
  Download,
  Edit3,
  Trash2,
  FolderKanban,
} from 'lucide-react';
import { Task, TaskFormData, NotificationState, NotificationType } from '../../types/task';
import { VerticalReportSelector } from './VerticalReportSelector';
import { TaskForm } from '../task/TaskForm';
import { ReportPanel } from '../task/ReportPanel';
import { MarkdownTemplateRunner } from '../templates/MarkdownTemplateRunner';
import { MarkdownTemplateEditorModal } from '../templates/MarkdownTemplateEditorModal';
import { AiPromptModal } from '../templates/AiPromptModal';
import { NotificationToast } from '../common/NotificationToast';
import { Panel } from '../common/Panel';
import { SectionHeading } from '../common/SectionHeading';
import { Button } from '../common/Button';
import { useMarkdownTemplates } from '../../hooks/useMarkdownTemplates';
import { renderTemplate } from '../../utils/markdownTemplateParser';
import { MarkdownTemplateMeta } from '../../types/markdownTemplate';

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
  onSaveReportQuick: (tasks: Task[], customText?: string) => void;
  onSaveReportCustom: (params: {
    tasks: Task[];
    title: string;
    date: string;
    time: string;
    note?: string;
    customText?: string;
  }) => void;
  onSaveDirectReport: (title: string, reportText: string, tasks: Task[]) => void;
  notification: NotificationState;
  onNotify: (message: string, type?: NotificationType) => void;
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
  onSaveDirectReport,
  notification,
  onNotify,
}) => {
  const {
    templates,
    activeTemplateId,
    activeTemplate,
    parsedActiveTemplate,
    fieldValues,
    setFieldValue,
    resetFieldValues,
    selectTemplate,
    addCustomTemplate,
    updateCustomTemplate,
    deleteCustomTemplate,
    importTemplateFromFile,
    exportTemplateToFile,
    downloadExampleBase,
  } = useMarkdownTemplates();

  // Modais
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MarkdownTemplateMeta | null>(null);

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

  // Input oculto para upload de .md
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenNewModal = () => {
    setEditingTemplate(null);
    setIsEditorModalOpen(true);
  };

  const handleOpenEditModal = () => {
    if (!activeTemplate.isBuiltin) {
      setEditingTemplate(activeTemplate);
      setIsEditorModalOpen(true);
    }
  };

  const handleSaveModal = (title: string, content: string) => {
    if (editingTemplate) {
      updateCustomTemplate(editingTemplate.id, title, content);
    } else {
      addCustomTemplate(title, content);
    }
  };

  const handleDeleteActiveTemplate = () => {
    if (activeTemplate.isBuiltin) return;
    const confirm = window.confirm(`Excluir o modelo customizado "${activeTemplate.title}"?`);
    if (confirm) {
      deleteCustomTemplate(activeTemplate.id);
      onNotify('Modelo excluído com sucesso.', 'success');
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const newId = await importTemplateFromFile(file);
      selectTemplate(newId);
      onNotify(`Modelo "${file.name}" importado com sucesso!`, 'success');
    } catch {
      onNotify('Falha ao importar arquivo .md.', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

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

      {/* Input oculto para upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".md,text/markdown,text/plain"
        style={{ display: 'none' }}
      />

      {/* Drawer / Painel Suspenso com o Seletor de Modelos (escondido até o usuário clicar) */}
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
              onOpenNewTemplateModal={() => {
                setIsSelectorOpen(false);
                handleOpenNewModal();
              }}
              onOpenAiPromptModal={() => {
                setIsSelectorOpen(false);
                setIsAiModalOpen(true);
              }}
              onImportTemplateFile={() => {
                setIsSelectorOpen(false);
                handleTriggerUpload();
              }}
              onDownloadExampleBase={downloadExampleBase}
              taskCount={tasks.length}
            />
          </div>
        </div>
      )}

      <div className="reports-hub-main-split">
        {/* ÁREA DE TRABALHO ATIVA */}
        <section className="reports-hub-content-area">
          {isExpandable ? (
            /* VISÃO PARA MODELOS EXPANSÍVEIS (Integrados com tarefas diárias) */
            <div className="expandable-workspace-wrapper">
              {/* Barra superior de informações do modelo selecionado */}
              <div className="report-active-header-banner">
                <div className="active-header-info">
                  <div className="active-header-tags-row">
                    <span className="active-header-title">{parsedActiveTemplate.meta.title}</span>
                    <span className="active-header-badge expandable">Relatório Expansível</span>
                    <span className="active-header-badge tasks-count">
                      {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}
                    </span>
                    {!activeTemplate.isBuiltin && (
                      <span className="active-header-badge custom">Customizado</span>
                    )}
                  </div>
                  <p className="active-header-desc">{parsedActiveTemplate.meta.description}</p>
                </div>

                <div className="active-header-actions">
                  <Button
                    variant="primary"
                    onClick={() => setIsSelectorOpen(true)}
                    title="Abrir catálogo para mudar de modelo ou relatório"
                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                  >
                    <FolderKanban size={15} />
                    Mudar Modelo
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => exportTemplateToFile(activeTemplate)}
                    title="Baixar arquivo deste modelo (.md)"
                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  >
                    <Download size={14} />
                    Template (.md)
                  </Button>

                  {!activeTemplate.isBuiltin && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={handleOpenEditModal}
                        title="Editar código deste modelo"
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                      >
                        <Edit3 size={14} />
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        onClick={handleDeleteActiveTemplate}
                        title="Excluir este modelo customizado"
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Bloco de Campos Adicionais do Modelo (se houver variáveis manuais além das tarefas) */}
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
                />

                <ReportPanel
                  tasks={tasks}
                  onEditTask={onEditTask}
                  onDeleteTask={onDeleteTask}
                  onRequestClearAll={onRequestClearAll}
                  onSaveReportQuick={(customText) => onSaveReportQuick(tasks, customText)}
                  onSaveReportCustom={(params) => onSaveReportCustom({ tasks, ...params })}
                  onNotify={onNotify}
                  activeTemplateText={renderedTemplateMarkdown}
                  activeTemplateTitle={parsedActiveTemplate.meta.title}
                />
              </div>
            </div>
          ) : (
            /* VISÃO PARA MODELOS NÃO EXPANSÍVEIS (Formulários Diretos, Comunicados, Novo Colaborador, etc.) */
            <div className="non-expandable-workspace-wrapper">
              <MarkdownTemplateRunner
                template={parsedActiveTemplate}
                tasks={tasks}
                fieldValues={fieldValues}
                onFieldChange={setFieldValue}
                onResetFields={resetFieldValues}
                onOpenSelector={() => setIsSelectorOpen(true)}
                onEditTemplate={!activeTemplate.isBuiltin ? handleOpenEditModal : undefined}
                onDeleteTemplate={!activeTemplate.isBuiltin ? handleDeleteActiveTemplate : undefined}
                onExportTemplateFile={() => exportTemplateToFile(activeTemplate)}
                onSaveToHistory={(title, reportText) => {
                  onSaveDirectReport(title, reportText, tasks);
                  onNotify('Relatório salvo no Histórico com sucesso!', 'success');
                }}
                onNotify={onNotify}
              />
            </div>
          )}
        </section>
      </div>

      {/* Modal de Criação / Edição de Modelo Markdown */}
      <MarkdownTemplateEditorModal
        isOpen={isEditorModalOpen}
        editingTemplate={editingTemplate}
        onClose={() => setIsEditorModalOpen(false)}
        onSave={handleSaveModal}
        onNotify={onNotify}
      />

      {/* Modal de Prompt de IA */}
      <AiPromptModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onNotify={onNotify}
      />
    </div>
  );
};
