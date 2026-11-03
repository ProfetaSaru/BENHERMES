import React, { useState, useMemo } from 'react';
import { Copy, Trash2, Check, Bookmark, BookmarkPlus } from 'lucide-react';
import { Task } from '../../types/task';
import { UserRole } from '../../types/auth';
import { Panel } from '../common/Panel';
import { SectionHeading } from '../common/SectionHeading';
import { Button } from '../common/Button';
import { SaveReportModal } from '../common/SaveReportModal';
import { ReportPreview } from './ReportPreview';
import { generateReport } from '../../utils/formatReport';

interface ReportPanelProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string, title: string) => void;
  onRequestClearAll: () => void;
  onSaveReportQuick: (customText?: string) => void;
  onSaveReportCustom: (params: {
    title: string;
    date: string;
    time: string;
    note?: string;
    customText?: string;
  }) => void;
  onNotify: (message: string, type: 'success' | 'error') => void;
  onNavigateToTemplates?: () => void;
  activeTemplateText?: string;
  activeTemplateTitle?: string;
  templateId?: string;
  fieldValues?: Record<string, string>;
  userRole?: UserRole;
}

function padZero(num: number): string {
  return String(num).padStart(2, '0');
}

export const ReportPanel: React.FC<ReportPanelProps> = ({
  tasks,
  onEditTask,
  onDeleteTask,
  onRequestClearAll,
  onSaveReportQuick,
  onSaveReportCustom,
  onNotify,
  onNavigateToTemplates,
  activeTemplateText,
  activeTemplateTitle,
  templateId,
  fieldValues,
  userRole,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const isOperator = userRole === 'operador';
  const canSaveAs = true;

  const currentReportText = useMemo(() => {
    if (activeTemplateText) {
      return activeTemplateText;
    }
    return generateReport(tasks);
  }, [tasks, activeTemplateText]);

  const defaultSaveTitle = useMemo(() => {
    const now = new Date();
    const dd = padZero(now.getDate());
    const mm = padZero(now.getMonth() + 1);
    const yyyy = now.getFullYear();
    const hh = padZero(now.getHours());
    const min = padZero(now.getMinutes());

    return activeTemplateTitle
      ? `${activeTemplateTitle} - ${dd}/${mm}`
      : `Relatório de ${dd}/${mm}/${yyyy} às ${hh}:${min}`;
  }, [activeTemplateTitle]);

  const handleCopyReport = async () => {
    if (tasks.length === 0) {
      onNotify('Adicione uma tarefa antes de copiar.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(currentReportText);
      setCopied(true);
      onNotify('Relatório copiado com sucesso!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('Não foi possível copiar o relatório.', 'error');
    }
  };

  const handleQuickSave = () => {
    if (tasks.length === 0) {
      onNotify('Adicione pelo menos uma tarefa para salvar o relatório.', 'error');
      return;
    }
    onSaveReportQuick(currentReportText);
  };

  const handleOpenSaveAsModal = () => {
    if (tasks.length === 0) {
      onNotify('Adicione pelo menos uma tarefa para salvar o relatório.', 'error');
      return;
    }
    setIsSaveAsModalOpen(true);
  };

  const handleConfirmSaveAs = (data: { title: string; date: string; time: string; note?: string }) => {
    onSaveReportCustom({
      title: data.title,
      date: data.date,
      time: data.time,
      note: data.note,
      customText: currentReportText,
    });
  };

  return (
    <>
      <Panel className="report-panel">
        <SectionHeading
          kicker="Seu registro"
          title="Atividades do dia"
          className="report-heading"
        >
          <div className="actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
            {/* Botão Salvar (1 Clique) */}
            <Button
              variant="secondary"
              icon={<Bookmark size={14} />}
              onClick={handleQuickSave}
              title="Salvar relatório no Histórico com data e hora atuais"
            >
              Salvar
            </Button>

            {/* Botão Salvar como... (Apenas para perfis administrativos e supervisão) */}
            {canSaveAs && (
              <Button
                variant="secondary"
                icon={<BookmarkPlus size={14} />}
                onClick={handleOpenSaveAsModal}
                title="Salvar relatório personalizando título, data ou horário"
              >
                Salvar como...
              </Button>
            )}

            {/* Copiar Relatório */}
            <Button
              variant="secondary"
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopyReport}
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>

            {/* Limpar tudo */}
            <Button
              variant="danger"
              icon={<Trash2 size={14} />}
              onClick={onRequestClearAll}
            >
              Limpar tudo
            </Button>
          </div>
        </SectionHeading>

        <ReportPreview
          tasks={tasks}
          reportText={currentReportText}
          title={activeTemplateTitle}
          templateId={templateId}
          fieldValues={fieldValues}
          onNavigateToTemplates={onNavigateToTemplates}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
        />
      </Panel>

      {/* Modal: Salvar Relatório Como... */}
      <SaveReportModal
        isOpen={isSaveAsModalOpen}
        defaultTitle={defaultSaveTitle}
        isOperator={isOperator}
        onClose={() => setIsSaveAsModalOpen(false)}
        onSave={handleConfirmSaveAs}
      />
    </>
  );
};
