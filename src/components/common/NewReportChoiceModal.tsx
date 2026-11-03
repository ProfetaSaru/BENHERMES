import React, { useEffect } from 'react';
import { X, FilePlus2, Copy, Trash2 } from 'lucide-react';
import { Button } from './Button';

interface NewReportChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeepData: () => void;
  onClearData: () => void;
}

export const NewReportChoiceModal: React.FC<NewReportChoiceModalProps> = ({
  isOpen,
  onClose,
  onKeepData,
  onClearData,
}) => {
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
      aria-labelledby="new-report-choice-title"
      onClick={handleBackdropClick}
    >
      <div className="modal-card" style={{ maxWidth: '540px', width: '92%' }}>
        <div
          className="modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.85rem',
          }}
        >
          <div>
            <p className="section-kicker" style={{ margin: 0 }}>
              Gerenciamento de Relatório
            </p>
            <h3
              id="new-report-choice-title"
              style={{
                margin: 0,
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <FilePlus2 size={20} style={{ color: 'var(--accent)' }} />
              Iniciar Novo Relatório
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

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5 }}>
            Existem tarefas ou campos preenchidos na tela. Como você deseja iniciar o novo relatório?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Opção 1: Manter dados atuais como base */}
            <button
              type="button"
              onClick={() => {
                onKeepData();
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.background = 'var(--bg-tertiary, var(--bg-hover))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
            >
              <div
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Copy size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  Manter dados atuais como base
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--green, #10b981)',
                    }}
                  >
                    Recomendado
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    marginTop: '4px',
                    lineHeight: 1.4,
                  }}
                >
                  Preserva as tarefas e campos atuais na tela. Na próxima vez que você clicar em Salvar,
                  ele será gravado como um <strong>novo relatório com um novo ID</strong> no Histórico,
                  sem alterar o relatório anterior.
                </div>
              </div>
            </button>

            {/* Opção 2: Limpar tudo e começar do zero */}
            <button
              type="button"
              onClick={() => {
                onClearData();
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--red, #ef4444)';
                e.currentTarget.style.background = 'var(--bg-tertiary, var(--bg-hover))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
            >
              <div
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--red, #ef4444)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Começar do zero (Limpar tela)
                </div>
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    marginTop: '4px',
                    lineHeight: 1.4,
                  }}
                >
                  Limpa todas as tarefas e campos do formulário para iniciar um relatório totalmente em
                  branco. O próximo salvamento criará um novo relatório com um novo ID.
                </div>
              </div>
            </button>
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
          <Button variant="secondary" onClick={onClose} style={{ width: 'auto' }}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
};
