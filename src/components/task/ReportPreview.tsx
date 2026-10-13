import React from 'react';
import { HardDrive, AlignLeft, Table, Layers, Wand2 } from 'lucide-react';
import { Task } from '../../types/task';
import { generateReport } from '../../utils/formatReport';

export type ReportFormat = 'classic' | 'table' | 'list';

interface ReportPreviewProps {
  tasks: Task[];
  reportText?: string;
  format?: ReportFormat;
  onSelectFormat?: (format: ReportFormat) => void;
  onNavigateToTemplates?: () => void;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  tasks,
  reportText,
  format = 'classic',
  onSelectFormat,
  onNavigateToTemplates,
}) => {
  const textToDisplay = reportText ?? generateReport(tasks);

  return (
    <div className="report-preview">
      <div className="preview-heading">
        <div className="preview-heading-left">
          <span className="preview-title">Formato:</span>
          {onSelectFormat && (
            <div className="preview-format-toggles">
              <button
                type="button"
                className={`preview-format-btn ${format === 'classic' ? 'active' : ''}`}
                onClick={() => onSelectFormat('classic')}
                title="Formato clássico com horários e títulos em maiúsculo"
              >
                <AlignLeft size={13} />
                Clássico
              </button>
              <button
                type="button"
                className={`preview-format-btn ${format === 'table' ? 'active' : ''}`}
                onClick={() => onSelectFormat('table')}
                title="Tabela Markdown com colunas Horário | Atividade | Detalhes"
              >
                <Table size={13} />
                Tabela (.md)
              </button>
              <button
                type="button"
                className={`preview-format-btn ${format === 'list' ? 'active' : ''}`}
                onClick={() => onSelectFormat('list')}
                title="Lista com marcadores de tópicos"
              >
                <Layers size={13} />
                Lista (.md)
              </button>
            </div>
          )}
        </div>

        <div className="preview-heading-right">
          {onNavigateToTemplates && (
            <button
              type="button"
              className="preview-templates-link"
              onClick={onNavigateToTemplates}
              title="Explorar e usar modelos completos em Markdown"
            >
              <Wand2 size={13} />
              Modelos Avançados
            </button>
          )}
          <span className="storage-status">
            <HardDrive size={13} />
            Salvo localmente
          </span>
        </div>
      </div>
      <pre>{textToDisplay}</pre>
    </div>
  );
};
