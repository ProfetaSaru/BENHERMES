import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Check,
  Tag,
  Palette,
  Type,
  AlignLeft,
  Eye,
  EyeOff,
  ChevronDown,
  AlertTriangle,
  Clock,
  HelpCircle,
  Bookmark,
  PhoneCall,
  MessageCircle,
  FileText,
} from 'lucide-react';
import type { NoteItem, NoteColor } from '../../types/notes';
import { NOTE_COLORS, NOTE_CATEGORIES, getAuthorInitials } from '../../types/notes';
import type { AuthUser } from '../../types/auth';

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
      return <AlertTriangle size={13} />;
    case 'Rotina':
      return <Clock size={13} />;
    case 'Dúvida':
      return <HelpCircle size={13} />;
    case 'Lembrete':
      return <Bookmark size={13} />;
    case 'Atendimento':
      return <PhoneCall size={13} />;
    case 'Feedback':
      return <MessageCircle size={13} />;
    default:
      return <FileText size={13} />;
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

  // Toggle de visualização da prévia (com persistência no localStorage)
  const [showPreview, setShowPreview] = useState(() => {
    try {
      return localStorage.getItem('benhermes_notes_show_preview') === 'true';
    } catch {
      return false;
    }
  });

  // Estados de abertura das listas expansíveis
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isColorOpen, setIsColorOpen] = useState(false);

  const categoryRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);

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
    setIsCategoryOpen(false);
    setIsColorOpen(false);
  }, [noteToEdit, isOpen]);

  // Fechamento ao clicar fora ou pressionar Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
      }
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setIsColorOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (isCategoryOpen || isColorOpen)) {
        e.stopPropagation();
        setIsCategoryOpen(false);
        setIsColorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCategoryOpen, isColorOpen]);

  if (!isOpen) return null;

  const handleTogglePreview = () => {
    setShowPreview((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('benhermes_notes_show_preview', String(next));
      } catch {
        // Ignora erros de localStorage
      }
      return next;
    });
  };

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

  const authorDisplayName = currentUser?.displayName || currentUser?.username || 'Você';
  const authorInitials = getAuthorInitials(authorDisplayName);
  const currentColorObj = NOTE_COLORS.find((c) => c.id === color) || NOTE_COLORS[0];

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card note-editor-modal-modern"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: showPreview ? '860px' : '520px',
          width: '95%',
          transition: 'max-width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-kicker">Mural de Anotações</span>
            <h2 className="modal-title">
              {noteToEdit ? 'Editar Anotação' : 'Nova Anotação'}
            </h2>
          </div>

          <div className="modal-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className={`note-preview-toggle-btn ${showPreview ? 'active' : ''}`}
              onClick={handleTogglePreview}
              title={showPreview ? 'Ocultar prévia do card' : 'Mostrar prévia do card'}
              aria-pressed={showPreview}
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{showPreview ? 'Ocultar Prévia' : 'Prévia'}</span>
            </button>

            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Fechar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="note-editor-modal-form">
          <div className="modal-body note-editor-modal-body">
            <div className={`editor-modal-layout ${showPreview ? 'has-preview' : 'no-preview'}`}>
              {/* Formulário Principal */}
              <div className="note-editor-form-left">
                {errorMsg && <div className="modal-error-banner">{errorMsg}</div>}

                <div className="form-group">
                  <label className="form-label" htmlFor="note-title-input">
                    <Type size={14} />
                    <span>Título da Anotação</span>
                  </label>
                  <input
                    id="note-title-input"
                    type="text"
                    className="field-input input-field note-form-input"
                    placeholder="Ex: Ponto de atenção com retorno do cliente..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                {/* Linha Compacta com Listas Expansíveis para Categoria e Cor */}
                <div className="note-meta-collapsible-row">
                  {/* Categoria Expansível */}
                  <div className="form-group expandable-selector-wrap" ref={categoryRef}>
                    <label className="form-label" id="note-category-label">
                      <Tag size={14} />
                      <span>Categoria</span>
                    </label>
                    <div className="expandable-selector">
                      <button
                        type="button"
                        id="note-category-trigger"
                        aria-haspopup="listbox"
                        aria-expanded={isCategoryOpen}
                        aria-labelledby="note-category-label note-category-trigger"
                        className={`expandable-selector-trigger ${isCategoryOpen ? 'open' : ''}`}
                        onClick={() => {
                          setIsCategoryOpen((prev) => !prev);
                          setIsColorOpen(false);
                        }}
                      >
                        <span className="trigger-value">
                          <span className="cat-trigger-icon">{getCategoryIcon(category)}</span>
                          <span className="cat-trigger-label">{category}</span>
                        </span>
                        <ChevronDown size={15} className={`trigger-chevron ${isCategoryOpen ? 'rotated' : ''}`} />
                      </button>

                      {isCategoryOpen && (
                        <div className="expandable-dropdown-menu" role="listbox">
                          {NOTE_CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              role="option"
                              aria-selected={category === cat}
                              className={`expandable-dropdown-item ${category === cat ? 'active' : ''}`}
                              onClick={() => {
                                setCategory(cat);
                                setIsCategoryOpen(false);
                              }}
                            >
                              <span className="dropdown-item-left">
                                {getCategoryIcon(cat)}
                                <span>{cat}</span>
                              </span>
                              {category === cat && <Check size={14} className="dropdown-item-check" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cor do Card Expansível */}
                  <div className="form-group expandable-selector-wrap" ref={colorRef}>
                    <label className="form-label" id="note-color-label">
                      <Palette size={14} />
                      <span>Cor do Card</span>
                    </label>
                    <div className="expandable-selector">
                      <button
                        type="button"
                        id="note-color-trigger"
                        aria-haspopup="listbox"
                        aria-expanded={isColorOpen}
                        aria-labelledby="note-color-label note-color-trigger"
                        className={`expandable-selector-trigger ${isColorOpen ? 'open' : ''}`}
                        onClick={() => {
                          setIsColorOpen((prev) => !prev);
                          setIsCategoryOpen(false);
                        }}
                      >
                        <span className="trigger-value">
                          <span
                            className="swatch-circle-compact"
                            style={{ background: currentColorObj.accentColor }}
                          />
                          <span className="color-trigger-label">{currentColorObj.label.split(' ')[0]}</span>
                        </span>
                        <ChevronDown size={15} className={`trigger-chevron ${isColorOpen ? 'rotated' : ''}`} />
                      </button>

                      {isColorOpen && (
                        <div className="expandable-dropdown-menu color-dropdown-menu" role="listbox">
                          <div className="expandable-color-grid">
                            {NOTE_COLORS.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                role="option"
                                aria-selected={color === c.id}
                                className={`expandable-color-item ${color === c.id ? 'active' : ''}`}
                                onClick={() => {
                                  setColor(c.id);
                                  setIsColorOpen(false);
                                }}
                              >
                                <span
                                  className="swatch-circle"
                                  style={{ background: c.accentColor }}
                                >
                                  {color === c.id && <Check size={12} color="#fff" />}
                                </span>
                                <span className="swatch-item-label">{c.label.split(' ')[0]}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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
                    className="textarea-field note-form-textarea"
                    placeholder="Escreva sua anotação ou recado aqui..."
                    rows={10}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Live Preview Lateral Condicional */}
              {showPreview && (
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

                    <p className="note-card-snippet">
                      {content.trim() || 'O conteúdo digitado aparecerá aqui como prévia visual.'}
                    </p>

                    <div className="note-card-footer">
                      <div className="note-author-info">
                        <div className={`author-avatar-circle avatar-${currentUser?.role || 'operador'}`}>
                          {authorInitials}
                        </div>
                        <div className="author-details">
                          <span className="author-name">{authorDisplayName}</span>
                          <span className={`author-role-badge role-${currentUser?.role || 'operador'}`}>
                            {currentUser?.role?.toUpperCase() || 'OPERADOR'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
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
