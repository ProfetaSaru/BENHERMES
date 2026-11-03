import React, { useState, useEffect } from 'react';
import { X, Check, Tag, Palette, Type, AlignLeft } from 'lucide-react';
import type { NoteItem, NoteColor } from '../../types/notes';
import { NOTE_COLORS, NOTE_CATEGORIES } from '../../types/notes';

interface NoteEditorModalProps {
  isOpen: boolean;
  noteToEdit?: NoteItem | null;
  onClose: () => void;
  onSave: (data: {
    title: string;
    content: string;
    category: string;
    color: NoteColor;
  }) => Promise<void>;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  isOpen,
  noteToEdit,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Geral');
  const [color, setColor] = useState<NoteColor>('default');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (noteToEdit) {
      setTitle(noteToEdit.title);
      setContent(noteToEdit.content);
      setCategory(noteToEdit.category || 'Geral');
      setColor(noteToEdit.color || 'default');
    } else {
      setTitle('');
      setContent('');
      setCategory('Geral');
      setColor('default');
    }
    setErrorMsg(null);
  }, [noteToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Informe o título da anotação.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Informe o conteúdo da anotação.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSave({
        title: title.trim(),
        content: content.trim(),
        category: category.trim() || 'Geral',
        color,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar anotação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box note-editor-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '92%' }}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-kicker">Mural de Anotações</span>
            <h2 className="modal-title">
              {noteToEdit ? 'Editar Anotação' : 'Nova Anotação'}
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="note-editor-form">
          {errorMsg && <div className="modal-error-banner">{errorMsg}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="note-title-input">
              <Type size={14} />
              <span>Título da Anotação</span>
            </label>
            <input
              id="note-title-input"
              type="text"
              className="form-input"
              placeholder="Ex: Ponto de atenção no fechamento do mês..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-row-two-cols">
            <div className="form-group">
              <label className="form-label" htmlFor="note-category-select">
                <Tag size={14} />
                <span>Categoria / Etiqueta</span>
              </label>
              <select
                id="note-category-select"
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {NOTE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Palette size={14} />
                <span>Cor do Card</span>
              </label>
              <div className="note-color-picker">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`color-swatch-btn color-swatch-${c.id} ${color === c.id ? 'active' : ''}`}
                    title={c.label}
                    onClick={() => setColor(c.id)}
                  >
                    {color === c.id && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="note-content-input">
              <AlignLeft size={14} />
              <span>Conteúdo da Anotação</span>
            </label>
            <textarea
              id="note-content-input"
              className="form-textarea"
              placeholder="Escreva sua anotação, recado ou detalhe importante..."
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : noteToEdit ? 'Salvar Alterações' : 'Criar Anotação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

