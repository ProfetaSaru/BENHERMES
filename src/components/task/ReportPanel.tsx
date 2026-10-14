import React, { useState, useMemo } from 'react';
import { Copy, Trash2, Check, Bookmark, BookmarkPlus, X, Calendar, Clock, FileText } from 'lucide-react';
import { Task } from '../../types/task';
import { Panel } from '../common/Panel';
import { SectionHeading } from '../common/SectionHeading';
import { Button } from '../common/Button';
import { TaskList } from './TaskList';
import { ReportPreview } from './ReportPreview';
import { generateReport } from '../../utils/formatReport';
import { formatTasksTable, formatTasksList } from '../../utils/markdownTemplateParser';

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
}) => {
  const [copied, setCopied] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const [reportFormat, setReportFormat] = useState<'classic' | 'table' | 'list'>('classic');

  // Estados do Modal "Salvar como..."
  const [customTitle, setCustomTitle] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [customNote, setCustomNote] = useState('');

  const currentReportText = useMemo(() => {
    if (activeTemplateText) {
      return activeTemplateText;
    }
    if (reportFormat === 'table') {
      return formatTasksTable(tasks);
    }
    if (reportFormat === 'list') {
      return formatTasksList(tasks);
    }
    return generateReport(tasks);
  }, [tasks, reportFormat, activeTemplateText]);

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

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = padZero(now.getMonth() + 1);
    const dd = padZero(now.getDate());
    const hh = padZero(now.getHours());
    const min = padZero(now.getMinutes());

    const baseTitle = activeTemplateTitle
      ? `${activeTemplateTitle} - ${dd}/${mm}`
      : `Relatório de ${dd}/${mm}/${yyyy} às ${hh}:${min}`;

    setCustomTitle(baseTitle);
    setCustomDate(`${yyyy}-${mm}-${dd}`);
    setCustomTime(`${hh}:${min}`);
    setCustomNote('');
    setIsSaveAsModalOpen(true);
  };

  const handleConfirmSaveAs = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveReportCustom({
      title: customTitle,
      date: customDate,
      time: customTime,
      note: customNote,
      customText: currentReportText,
    });
    setIsSaveAsModalOpen(false);
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

            {/* Botão Salvar como... */}
            <Button
              variant="secondary"
              icon={<BookmarkPlus size={14} />}
              onClick={handleOpenSaveAsModal}
              title="Salvar relatório personalizando título, data ou horário"
            >
              Salvar como...
            </Button>

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

        <TaskList
          tasks={tasks}
          onEdit={onEditTask}
          onDelete={onDeleteTask}
        />

        <ReportPreview
          tasks={tasks}
          reportText={currentReportText}
          format={reportFormat}
          onSelectFormat={setReportFormat}
          onNavigateToTemplates={onNavigateToTemplates}
        />
      </Panel>

      {/* Modal: Salvar Relatório Como... */}
      {isSaveAsModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsSaveAsModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="modal-kicker">Histórico & Arquivos</span>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookmarkPlus size={18} style={{ color: 'var(--yellow)' }} />
                  Salvar Relatório Como
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsSaveAsModalOpen(false)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmSaveAs}>
              <div className="modal-body">
                <div className="field-group">
                  <label className="field-label" htmlFor="save-as-title">
                    <span><FileText size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Título do Relatório</span>
                  </label>
                  <input
                    id="save-as-title"
                    className="field-input"
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-grid-2">
                  <div className="field-group">
                    <label className="field-label" htmlFor="save-as-date">
                      <span><Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Data de Registro</span>
                    </label>
                    <input
                      id="save-as-date"
                      className="field-input"
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="save-as-time">
                      <span><Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Horário</span>
                    </label>
                    <input
                      id="save-as-time"
                      className="field-input"
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="save-as-note">
                    <span>Observação / Contexto (Opcional)</span>
                  </label>
                  <input
                    id="save-as-note"
                    className="field-input"
                    type="text"
                    placeholder="Ex: Plantão especial, Fechamento quinzenal..."
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsSaveAsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: 'auto' }}
                >
                  Salvar no Histórico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
