import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Tag,
  Palette,
  Type,
  AlignLeft,
  Eye,
  AlertTriangle,
  Clock,
  HelpCircle,
  Bookmark,
  PhoneCall,
  MessageCircle,
  FileText,
} from 'lucide-react';
import type { NoteItem, NoteColor } from '../../types/notes';
import { NOTE_COLORS, NOTE_CATEGORIES } from '../../types/notes';
import type { AuthUser } from '../../types/auth';
import { ROLE_LABELS } from '../../types/auth';

interface NoteEditorModalProps {
  isOpen: boolean;
  noteToEdit?: NoteItem | null;
  currentUser: AuthUser;
  onClose: () => void;
  onSave: (data: {
    title: string;
    content: string;
    category: string;
    color: NoteColor;
  }) => Promise<void>;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Urgente':
      return <AlertTriangle size={12} />;
    case 'Rotina':
      return <Clock size={12} />;
    case 'Dúvida':
      return <HelpCircle size={12} />;
    case 'Lembrete':
      return <Bookmark size={12} />;
    case 'Atendimento':
      return <PhoneCall size={12} />;
    case 'Feedback':
      return <MessageCircle size={12} />;
    default:
      return <FileText size={12} />;
  }
};

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  isOpen,
  noteToEdit,
  currentUser,
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
        className="modal-box note-editor-modal-modern"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', width: '94%' }}
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

        <div className="editor-modal-layout">
          {/* Formulário Principal */}
          <form onSubmit={handleSubmit} className="note-editor-form-left">
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
                placeholder="Ex: Ponto de atenção com retorno do cliente..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* Seletor de Categoria com Chips rápidos */}
            <div className="form-group">
              <label className="form-label">
                <Tag size={14} />
                <span>Categoria</span>
              </label>
              <div className="category-chips-selector">
                {NOTE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-select-chip ${category === cat ? 'active' : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    {getCategoryIcon(cat)}
                    <span>{cat}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seletor de Cores */}
            <div className="form-group">
              <label className="form-label">
                <Palette size={14} />
                <span>Cor do Card</span>
              </label>
              <div className="color-swatches-grid">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`color-choice-btn color-choice-${c.id} ${color === c.id ? 'active' : ''}`}
                    title={c.label}
                    onClick={() => setColor(c.id)}
                  >
                    <span className="swatch-circle" style={{ background: c.accentColor }}>
                      {color === c.id && <Check size={12} color="#fff" />}
                    </span>
                    <span className="swatch-label">{c.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo */}
            <div className="form-group">
              <label className="form-label" htmlFor="note-content-input">
                <AlignLeft size={14} />
                <span>Conteúdo da Anotação</span>
              </label>
              <textarea
                id="note-content-input"
                className="form-textarea"
                placeholder="Escreva sua anotação ou recado aqui..."
                rows={5}
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

          {/* Live Preview Lateral */}
          <div className="note-live-preview-wrap">
            <div className="preview-label">
              <Eye size={13} />
              <span>Prévia no Mural</span>
            </div>

            <div className={`note-card note-card-${color} note-preview-card`}>
              <div className="note-card-top-accent" />
              <div className="note-card-header">
                <div className="note-card-badges">
                  <span className={`note-category-chip cat-${category.toLowerCase()}`}>
                    {getCategoryIcon(category)}
                    <span>{category}</span>
                  </span>
                </div>
              </div>

              <h3 className="note-card-title">
                {title.trim() || 'Título da anotação'}
              </h3>
              <p className="note-card-content">
                {content.trim() || 'O conteúdo digitado aparecerá aqui como prévia visual.'}
              </p>

              <div className="note-card-footer">
                <div className="note-card-author-cluster">
                  <div className={`author-avatar-circle avatar-${currentUser.role}`}>
                    {currentUser.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : 'EU'}
                  </div>
                  <div className="author-text-meta">
                    <span className="author-name">{currentUser.displayName || currentUser.username}</span>
                    <span className={`role-badge role-badge-${currentUser.role}`}>
                      {ROLE_LABELS[currentUser.role] || currentUser.role}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
