import React, { useState, useMemo } from 'react';
import {
  Search,
  FileText,
  Table,
  Clock,
  UserPlus,
  Mail,
  AlertTriangle,
  Layers,
  FileCode,
  CheckCircle2,
  X,
} from 'lucide-react';
import { MarkdownTemplateMeta } from '../../types/markdownTemplate';

interface Props {
  templates: MarkdownTemplateMeta[];
  activeTemplateId: string;
  onSelectTemplate: (id: string) => void;
  onClose?: () => void;
  taskCount?: number;
  getTemplateTaskCount?: (templateId: string) => number;
}

function renderTemplateIcon(iconName?: string) {
  const iconSize = 16;
  switch (iconName?.toLowerCase()) {
    case 'table':
    case 'tableproperties':
      return <Table size={iconSize} />;
    case 'clock':
      return <Clock size={iconSize} />;
    case 'userplus':
    case 'user':
      return <UserPlus size={iconSize} />;
    case 'mail':
      return <Mail size={iconSize} />;
    case 'alerttriangle':
    case 'alert':
      return <AlertTriangle size={iconSize} />;
    case 'layers':
      return <Layers size={iconSize} />;
    default:
      return <FileText size={iconSize} />;
  }
}

export const VerticalReportSelector: React.FC<Props> = ({
  templates,
  activeTemplateId,
  onSelectTemplate,
  onClose,
  taskCount = 0,
  getTemplateTaskCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filtragem pela busca
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  // Divisão entre Expansíveis e Não Expansíveis
  const expandableTemplates = useMemo(() => {
    return filteredTemplates.filter((t) => t.expandable === true);
  }, [filteredTemplates]);

  const nonExpandableTemplates = useMemo(() => {
    return filteredTemplates.filter((t) => t.expandable !== true);
  }, [filteredTemplates]);

  return (
    <aside className="report-vertical-selector">
      {/* Top Header com título e botão fechar */}
      <div className="selector-top-header">
        <div className="selector-top-title-wrap">
          <span className="selector-top-kicker">Catálogo</span>
          <h4 className="selector-top-title">Escolher Modelo</h4>
        </div>
        {onClose && (
          <button
            type="button"
            className="selector-close-drawer-btn"
            onClick={onClose}
            aria-label="Fechar lista"
            title="Fechar (ESC)"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Barra de pesquisa no topo */}
      <div className="selector-search-box">
        <Search size={15} className="selector-search-icon" />
        <input
          type="text"
          className="selector-search-input"
          placeholder="Pesquisar relatório..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="selector-clear-search-btn"
            onClick={() => setSearchQuery('')}
            title="Limpar pesquisa"
          >
            ×
          </button>
        )}
      </div>

      {/* Listas Verticais de Relatórios */}
      <div className="selector-groups-container">
        {/* GRUPO 1: Relatórios Expansíveis */}
        <div className="selector-group">
          <div className="selector-group-header">
            <span className="selector-group-title">
              <Layers size={14} className="group-header-icon" />
              Relatórios Expansíveis
            </span>
            <span className="selector-group-badge" title="Modelos que integram apontamentos de tarefas">
              {expandableTemplates.length}
            </span>
          </div>

          <div className="selector-group-items">
            {expandableTemplates.length === 0 ? (
              <div className="selector-empty-group">Nenhum relatório expansível encontrado.</div>
            ) : (
              expandableTemplates.map((template) => {
                const isActive = template.id === activeTemplateId;
                const itemTaskCount = getTemplateTaskCount
                  ? getTemplateTaskCount(template.id)
                  : isActive
                  ? taskCount
                  : 0;

                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`selector-item-card ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onSelectTemplate(template.id);
                      if (onClose) onClose();
                    }}
                  >
                    <div className="item-card-icon">{renderTemplateIcon(template.icon)}</div>
                    <div className="item-card-body">
                      <div className="item-card-title-row">
                        <span className="item-card-title">{template.title}</span>
                        {isActive && <CheckCircle2 size={13} className="item-active-check" />}
                      </div>
                      <span className="item-card-desc">{template.description}</span>
                      <div className="item-card-footer">
                        <span className="item-badge-pill expandable">
                          {itemTaskCount > 0
                            ? `${itemTaskCount} ${itemTaskCount === 1 ? 'tarefa ativa' : 'tarefas ativas'}`
                            : 'Com tarefas'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* GRUPO 2: Relatórios Não Expansíveis */}
        <div className="selector-group">
          <div className="selector-group-header">
            <span className="selector-group-title">
              <FileCode size={14} className="group-header-icon" />
              Formulários Diretos
            </span>
            <span className="selector-group-badge" title="Modelos com campos diretos sem grade de tarefas">
              {nonExpandableTemplates.length}
            </span>
          </div>

          <div className="selector-group-items">
            {nonExpandableTemplates.length === 0 ? (
              <div className="selector-empty-group">Nenhum relatório direto encontrado.</div>
            ) : (
              nonExpandableTemplates.map((template) => {
                const isActive = template.id === activeTemplateId;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`selector-item-card ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onSelectTemplate(template.id);
                      if (onClose) onClose();
                    }}
                  >
                    <div className="item-card-icon">{renderTemplateIcon(template.icon)}</div>
                    <div className="item-card-body">
                      <div className="item-card-title-row">
                        <span className="item-card-title">{template.title}</span>
                        {isActive && <CheckCircle2 size={13} className="item-active-check" />}
                      </div>
                      <span className="item-card-desc">{template.description}</span>
                      <div className="item-card-footer">
                        <span className="item-badge-pill direct">Formulário Direto</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
