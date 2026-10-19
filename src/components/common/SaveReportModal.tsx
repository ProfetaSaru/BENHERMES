import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, FileText, BookmarkPlus } from 'lucide-react';

interface SaveReportModalProps {
  isOpen: boolean;
  defaultTitle: string;
  defaultDate?: string;
  defaultTime?: string;
  defaultNote?: string;
  onClose: () => void;
  onSave: (data: { title: string; date: string; time: string; note?: string }) => void;
}

function padZero(num: number): string {
  return String(num).padStart(2, '0');
}

export const SaveReportModal: React.FC<SaveReportModalProps> = ({
  isOpen,
  defaultTitle,
  defaultDate,
  defaultTime,
  defaultNote = '',
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState(defaultNote);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = padZero(now.getMonth() + 1);
      const dd = padZero(now.getDate());
      const hh = padZero(now.getHours());
      const min = padZero(now.getMinutes());

      setTitle(defaultTitle);
      setDate(defaultDate || `${yyyy}-${mm}-${dd}`);
      setTime(defaultTime || `${hh}:${min}`);
      setNote(defaultNote);
    }
  }, [isOpen, defaultTitle, defaultDate, defaultTime, defaultNote]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      date,
      time,
      note: note.trim() || undefined,
    });
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-report-modal-title"
      onClick={handleBackdropClick}
    >
      <div className="modal-card" style={{ maxWidth: '520px', width: '92%' }}>
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <p className="section-kicker" style={{ margin: 0 }}>Histórico de Relatórios</p>
            <h3 id="save-report-modal-title" style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookmarkPlus size={18} style={{ color: 'var(--yellow)' }} />
              Salvar como...
            </h3>
          </div>
          <button
            type="button"
            className="field-icon-btn"
            style={{ position: 'static' }}
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="field-group">
              <label className="field-label" htmlFor="save-report-title">
                <span>
                  <FileText size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  Título do Relatório
                </span>
              </label>
              <input
                id="save-report-title"
                className="field-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
                placeholder="Nome de identificação do relatório..."
              />
            </div>

            <div className="form-grid-2">
              <div className="field-group">
                <label className="field-label" htmlFor="save-report-date">
                  <span>
                    <Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Data de Registro
                  </span>
                </label>
                <input
                  id="save-report-date"
                  className="field-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="save-report-time">
                  <span>
                    <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Horário
                  </span>
                </label>
                <input
                  id="save-report-time"
                  className="field-input"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="save-report-note">
                <span>Observação / Contexto (Opcional)</span>
              </label>
              <input
                id="save-report-note"
                className="field-input"
                type="text"
                placeholder="Ex: Plantão final de semana, Chamado urgente..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ width: 'auto' }}
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
  );
};
