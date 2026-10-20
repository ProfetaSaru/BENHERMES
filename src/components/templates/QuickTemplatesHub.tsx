import React, { useState, useRef, useMemo } from 'react';
import {
  Wand2,
  UserPlus,
  Plus,
  Upload,
  Download,
  Bot,
  Search,
  FileText,
  Clock,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import { Task, NotificationState, NotificationType } from '../../types/task';
import { NotificationToast } from '../common/NotificationToast';
import { Button } from '../common/Button';
import { NewCollaboratorTemplate } from './NewCollaboratorTemplate';
import { MarkdownTemplateRunner } from './MarkdownTemplateRunner';
import { MarkdownTemplateEditorModal } from './MarkdownTemplateEditorModal';
import { AiPromptModal } from './AiPromptModal';
import { useMarkdownTemplates } from '../../hooks/useMarkdownTemplates';
import { MarkdownTemplateMeta } from '../../types/markdownTemplate';

interface Props {
  notification: NotificationState;
  onNotify: (message: string, type?: NotificationType) => void;
  tasks?: Task[];
  onSaveToHistory?: (title: string, reportText: string) => void;
}

export const QuickTemplatesHub: React.FC<Props> = ({
  notification,
  onNotify,
  tasks = [],
  onSaveToHistory,
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

  // Visualização ativa: 'markdown' ou 'novo-colaborador' (template legada TI/RH)
  const [activeSpecialView, setActiveSpecialView] = useState<'markdown' | 'novo-colaborador'>('markdown');

  // Modais
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MarkdownTemplateMeta | null>(null);

  // Filtros
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Input de arquivo oculto para upload de .md
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesCategory =
        selectedCategory === 'todos' || tpl.category === selectedCategory;
      const matchesSearch =
        tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [templates, selectedCategory, searchQuery]);

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
    setActiveSpecialView('markdown');
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
      setActiveSpecialView('markdown');
      onNotify(`Modelo "${file.name}" importado com sucesso!`, 'success');
    } catch {
      onNotify('Falha ao importar arquivo .md.', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleSelectSpecialView = (view: 'markdown' | 'novo-colaborador', tplId?: string) => {
    setActiveSpecialView(view);
    if (tplId) {
      selectTemplate(tplId);
    }
  };

  const handleInternalSaveToHistory = (title: string, reportText: string) => {
    if (onSaveToHistory) {
      onSaveToHistory(title, reportText);
    } else {
      onNotify('Relatório salvo.', 'success');
    }
  };

  return (
    <div className="templates-container">
      {notification.message && (
        <NotificationToast message={notification.message} type={notification.type} />
      )}

      {/* Input oculto para importação de .md */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".md,text/markdown,text/plain"
        style={{ display: 'none' }}
      />

      {/* Header com seleção de modelos */}
      <div className="templates-header">
        <div className="templates-header-top">
          <div className="templates-header-info">
            <h2>
              <Wand2 size={24} style={{ color: 'var(--blue)' }} />
              Hub de Modelos de Relatórios & Textos
            </h2>
            <p>
              Gere relatórios dinâmicos a partir de modelos em Markdown (.md), utilize variáveis inteligentes
              ou crie novos modelos com auxílio de Inteligência Artificial.
            </p>
          </div>

          {/* Barra de Ações Rápidas */}
          <div className="templates-hub-actions-bar">
            <Button
              variant="secondary"
              onClick={() => setIsAiModalOpen(true)}
              title="Copiar prompt pronto para ChatGPT, Claude ou Gemini"
            >
              <Bot size={16} />
              Criar com IA / Prompt
            </Button>

            <Button
              variant="secondary"
              onClick={downloadExampleBase}
              title="Baixar arquivo de exemplo base em formato .md para editar no computador"
            >
              <Download size={16} />
              Baixar Exemplo (.md)
            </Button>

            <Button
              variant="secondary"
              onClick={handleTriggerUpload}
              title="Fazer upload de um arquivo .md do seu computador"
            >
              <Upload size={16} />
              Importar .md
            </Button>

            <Button
              variant="primary"
              onClick={handleOpenNewModal}
              title="Criar um novo modelo de relatório em Markdown"
            >
              <Plus size={16} />
              Novo Modelo
            </Button>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="templates-filter-row">
          <div className="templates-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar modelos por nome ou descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="templates-search-input"
            />
          </div>

          <div className="templates-category-chips">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'atividades', label: 'Atividades' },
              { id: 'operacional', label: 'Operacional' },
              { id: 'comunicados', label: 'Comunicados' },
              { id: 'incidentes', label: 'Incidentes' },
              { id: 'personalizado', label: 'Personalizados' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`category-chip-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Abas e Cartões de Seleção de Modelos */}
        <div className="templates-tabs-bar">
          {/* Aba do modelo de TI legado */}
          <button
            type="button"
            className={`template-tab-btn ${activeSpecialView === 'novo-colaborador' ? 'active' : ''}`}
            onClick={() => handleSelectSpecialView('novo-colaborador')}
          >
            <UserPlus size={16} />
            Novo Colaborador (TI/RH)
          </button>

          {/* Modelos em Markdown */}
          {filteredTemplates.map((tpl) => {
            const isActive =
              activeSpecialView === 'markdown' && activeTemplateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                className={`template-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectSpecialView('markdown', tpl.id)}
              >
                {tpl.category === 'incidentes' ? (
                  <AlertTriangle size={15} />
                ) : tpl.category === 'operacional' ? (
                  <Clock size={15} />
                ) : tpl.category === 'comunicados' ? (
                  <Mail size={15} />
                ) : (
                  <FileText size={15} />
                )}
                <span>{tpl.title}</span>
                {!tpl.isBuiltin && <span className="tab-custom-dot" title="Customizado" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo Ativo */}
      {activeSpecialView === 'novo-colaborador' ? (
        <NewCollaboratorTemplate onNotify={onNotify} />
      ) : (
        <MarkdownTemplateRunner
          template={parsedActiveTemplate}
          tasks={tasks}
          fieldValues={fieldValues}
          onFieldChange={setFieldValue}
          onResetFields={resetFieldValues}
          onEditTemplate={!activeTemplate.isBuiltin ? handleOpenEditModal : undefined}
          onDeleteTemplate={!activeTemplate.isBuiltin ? handleDeleteActiveTemplate : undefined}
          onExportTemplateFile={() => exportTemplateToFile(activeTemplate)}
          onSaveQuick={(p) => {
            handleInternalSaveToHistory(p.title || p.templateTitle, p.reportText);
          }}
          onSaveCustom={(p) => {
            handleInternalSaveToHistory(p.title || p.templateTitle, p.reportText);
          }}
          onNotify={onNotify}
        />
      )}

      {/* Modal de Criação / Edição de Template */}
      <MarkdownTemplateEditorModal
        isOpen={isEditorModalOpen}
        editingTemplate={editingTemplate}
        onClose={() => setIsEditorModalOpen(false)}
        onSave={handleSaveModal}
        onNotify={onNotify}
      />

      {/* Modal de Prompt para IA & Download de Exemplo */}
      <AiPromptModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onNotify={onNotify}
      />
    </div>
  );
};
