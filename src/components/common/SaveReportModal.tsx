import React, { useState, useEffect } from 'react';
import { X, FileText, BookmarkPlus, Clock } from 'lucide-react';

interface SaveReportModalProps {
  isOpen: boolean;
  defaultTitle: string;
  defaultDate?: string;
  defaultTime?: string;
  defaultNote?: string;
  isOperator?: boolean;
  onClose: () => void;
  onSave: (data: { title: string; date: string; time: string; note?: string }) => void;
}

function padZero(num: number): string {
  return String(num).padStart(2, '0');
}

export const SaveReportModal: React.FC<SaveReportModalProps> = ({
  isOpen,
  defaultTitle,
  defaultNote = '',
  isOperator = false,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [note, setNote] = useState(defaultNote);

  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle);
      setNote(defaultNote);
    }
  }, [isOpen, defaultTitle, defaultNote]);

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

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = padZero(now.getMonth() + 1);
    const dd = padZero(now.getDate());
    const hh = padZero(now.getHours());
    const min = padZero(now.getMinutes());

    const currentDate = `${yyyy}-${mm}-${dd}`;
    const currentTime = `${hh}:${min}`;

    onSave({
      title: title.trim(),
      date: currentDate,
      time: currentTime,
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
        <div
          className="modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <div>
            <p className="section-kicker" style={{ margin: 0 }}>
              Histórico de Relatórios
            </p>
            <h3
              id="save-report-modal-title"
              style={{
                margin: 0,
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
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
          <div
            className="modal-body"
            style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
          >
            <div className="field-group">
              <label className="field-label" htmlFor="save-report-title">
                <span>
                  <FileText
                    size={14}
                    style={{
                      display: 'inline',
                      verticalAlign: 'middle',
                      marginRight: 4,
                    }}
                  />
                  Título do Novo Relatório
                </span>
              </label>
              <input
                id="save-report-title"
                className="field-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                readOnly={isOperator}
                autoFocus={!isOperator}
                placeholder="Nome de identificação do relatório..."
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  marginTop: '4px',
                }}
              >
                <Clock size={12} />
                <span>
                  {isOperator
                    ? 'Título e horário padronizados automaticamente para operadores.'
                    : 'A data e o horário serão registrados automaticamente com o momento atual.'}
                </span>
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

          <div
            className="modal-footer"
            style={{
              marginTop: '1.25rem',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
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
              Salvar como Novo Relatório
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
