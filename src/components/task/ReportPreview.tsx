import React, { useState } from 'react';
import { Database, LayoutGrid, Terminal, FileSpreadsheet, Wand2 } from 'lucide-react';
import { Task } from '../../types/task';
import { generateReport } from '../../utils/formatReport';
import { ReportVisualRenderer, ReportVisualMode } from './ReportVisualRenderer';

export type ReportFormat = 'classic' | 'table' | 'list';

interface ReportPreviewProps {
  tasks: Task[];
  reportText?: string;
  format?: ReportFormat;
  onSelectFormat?: (format: ReportFormat) => void;
  onNavigateToTemplates?: () => void;
  templateId?: string;
  fieldValues?: Record<string, string>;
  title?: string;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (id: string, title: string) => void;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  tasks,
  reportText,
  onNavigateToTemplates,
  templateId = 'atividades-padrao',
  fieldValues = {},
  title,
  onEditTask,
  onDeleteTask,
}) => {
  const [visualMode, setVisualMode] = useState<ReportVisualMode>('cards');
  const textToDisplay = reportText ?? generateReport(tasks);

  return (
    <div className="report-preview">
      <div className="preview-heading">
        <div className="preview-heading-left">
          <span className="preview-title">Visualização no Site:</span>
          <div className="preview-format-toggles">
            <button
              type="button"
              className={`preview-format-btn ${visualMode === 'cards' ? 'active' : ''}`}
              onClick={() => setVisualMode('cards')}
              title="Interface visual com cartões, tags de tempo e métricas em destaque"
            >
              <LayoutGrid size={13} />
              Cartões &amp; KPIs
            </button>
            <button
              type="button"
              className={`preview-format-btn ${visualMode === 'terminal' ? 'active' : ''}`}
              onClick={() => setVisualMode('terminal')}
              title="Estilo console operacional clássico Benzaiten de alto contraste"
            >
              <Terminal size={13} />
              Console Benzaiten
            </button>
            <button
              type="button"
              className={`preview-format-btn ${visualMode === 'executive' ? 'active' : ''}`}
              onClick={() => setVisualMode('executive')}
              title="Estrutura formal corporativa com cabeçalho timbrado e tabela zebrada"
            >
              <FileSpreadsheet size={13} />
              Ficha Executiva
            </button>
          </div>
        </div>

        <div className="preview-heading-right">
          {onNavigateToTemplates && (
            <button
              type="button"
              className="preview-templates-link"
              onClick={onNavigateToTemplates}
              title="Explorar e usar outros modelos de relatórios operacionais"
            >
              <Wand2 size={13} />
              Modelos de Relatório
            </button>
          )}
          <span className="storage-status" title="Relatórios e tarefas salvos de forma isolada na sua conta">
            <Database size={13} />
            Salvo no Banco
          </span>
        </div>
      </div>

      <div style={{ padding: '14px' }}>
        <ReportVisualRenderer
          templateId={templateId}
          visualMode={visualMode}
          tasks={tasks}
          fieldValues={fieldValues}
          rawReportText={textToDisplay}
          title={title}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
        />
      </div>
    </div>
  );
};
