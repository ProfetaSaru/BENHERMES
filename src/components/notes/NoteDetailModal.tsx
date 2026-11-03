import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  MessageSquare,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  HelpCircle,
  Bookmark,
  PhoneCall,
  MessageCircle,
  FileText,
  CornerDownRight,
} from 'lucide-react';
import type { NoteItem, NoteCommentItem } from '../../types/notes';
import { getAuthorInitials } from '../../types/notes';
import type { AuthUser } from '../../types/auth';
import { ROLE_LABELS } from '../../types/auth';
import { apiRequest } from '../../utils/apiClient';

interface NoteDetailModalProps {
  isOpen: boolean;
  note: NoteItem | null;
  currentUser: AuthUser;
  onClose: () => void;
  onEdit: (note: NoteItem) => void;
  onDelete: (note: NoteItem) => void;
  onCommentsUpdated: () => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Urgente':
      return <AlertTriangle size={12} className="cat-icon-urgent" />;
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

export const NoteDetailModal: React.FC<NoteDetailModalProps> = ({
  isOpen,
  note,
  currentUser,
  onClose,
  onEdit,
  onDelete,
  onCommentsUpdated,
}) => {
  const [comments, setComments] = useState<NoteCommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !note) {
      setComments([]);
      setNewComment('');
      setErrorMsg(null);
      return;
    }

    let active = true;
    setIsLoading(true);

    // Carrega detalhes e comentários da anotação
    apiRequest<{ note: NoteItem; comments: NoteCommentItem[] }>(`/api/notes/${note.id}`)
      .then((res) => {
        if (!active) return;
        setComments(res.comments || []);
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(err.message || 'Erro ao carregar comentários.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    // Marca como lido automaticamente para o usuário logado
    apiRequest(`/api/notes/${note.id}/read`, { method: 'POST' })
      .then(() => {
        onCommentsUpdated();
      })
      .catch(() => {
        // silencioso
      });

    return () => {
      active = false;
    };
  }, [isOpen, note?.id]);

  if (!isOpen || !note) return null;

  const canModify = currentUser.role === 'admin' || note.userId === currentUser.id;

  const handleSendComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newComment.trim() || isSending) return;

    try {
      setIsSending(true);
      setErrorMsg(null);
      const res = await apiRequest<{ comment: NoteCommentItem }>(
        `/api/notes/${note.id}/comments`,
        {
          method: 'POST',
          body: { content: newComment.trim() },
        }
      );
      setComments((prev) => [...prev, res.comment]);
      setNewComment('');
      onCommentsUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar comentário.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSendComment();
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const authorInitials = getAuthorInitials(note.authorName);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-box note-detail-modal-modern note-modal-${note.color}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '780px', width: '94%' }}
      >
        <div className="note-detail-top-accent" />

        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="detail-badges">
              <span className={`note-category-chip cat-${note.category.toLowerCase()}`}>
                {getCategoryIcon(note.category)}
                <span>{note.category}</span>
              </span>
            </div>
            <h2 className="modal-title">{note.title}</h2>
          </div>

          <div className="modal-header-actions">
            {canModify && (
              <>
                <button
                  type="button"
                  className="note-action-btn edit-btn"
                  title="Editar anotação"
                  onClick={() => onEdit(note)}
                >
                  <Edit3 size={15} />
                </button>
                <button
                  type="button"
                  className="note-action-btn delete-btn"
                  title="Excluir anotação"
                  onClick={() => onDelete(note)}
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
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

        {/* Barra de Informações do Autor e Datas */}
        <div className="note-detail-author-bar">
          <div className="author-cluster">
            <div className={`author-avatar-circle avatar-${note.authorRole}`}>
              {authorInitials}
            </div>
            <div className="author-text-meta">
              <span className="author-name">{note.authorName}</span>
              <span className={`role-badge role-badge-${note.authorRole}`}>
                {ROLE_LABELS[note.authorRole] || note.authorRole}
              </span>
            </div>
          </div>

          <div className="date-cluster">
            <div className="date-pill">
              <Calendar size={12} />
              <span>Criado: {formatDate(note.createdAt)}</span>
            </div>
            {note.updatedAt !== note.createdAt && (
              <div className="date-pill updated">
                <Clock size={12} />
                <span>Atualizado: {formatDate(note.updatedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Leitor do Conteúdo */}
        <div className="note-detail-body">
          <div className="note-full-content-reader">{note.content}</div>
        </div>

        {/* Seção de Comentários / Thread */}
        <div className="note-comments-section">
          <div className="comments-section-header">
            <div className="comments-header-title">
              <MessageSquare size={16} />
              <h3>Comentários e Feedbacks ({comments.length})</h3>
            </div>
            <span className="comments-hint">Supervisores, gerentes e autores podem interagir</span>
          </div>

          {errorMsg && <div className="modal-error-banner">{errorMsg}</div>}

          <div className="comments-list-thread">
            {isLoading ? (
              <div className="comments-loading">Carregando comentários...</div>
            ) : comments.length === 0 ? (
              <div className="comments-empty-box">
                <CornerDownRight size={18} className="empty-thread-icon" />
                <p>Nenhum comentário registrado ainda. Deixe um feedback ou observação abaixo.</p>
              </div>
            ) : (
              comments.map((c) => {
                const commentInitials = getAuthorInitials(c.authorName);
                const isMe = c.userId === currentUser.id;
                return (
                  <div
                    key={c.id}
                    className={`comment-card ${isMe ? 'comment-is-me' : ''} role-card-${c.authorRole}`}
                  >
                    <div className="comment-card-header">
                      <div className="comment-author-group">
                        <div className={`author-avatar-circle avatar-small avatar-${c.authorRole}`}>
                          {commentInitials}
                        </div>
                        <span className="comment-author-name">{c.authorName}</span>
                        <span className={`role-badge role-badge-${c.authorRole}`}>
                          {ROLE_LABELS[c.authorRole] || c.authorRole}
                        </span>
                      </div>
                      <span className="comment-timestamp">{formatDate(c.createdAt)}</span>
                    </div>
                    <div className="comment-card-body">{c.content}</div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSendComment} className="comment-composer-form">
            <div className="composer-textarea-wrap">
              <textarea
                className="form-textarea comment-textarea"
                placeholder={
                  currentUser.role === 'operador' && note.userId === currentUser.id
                    ? 'Responder ao comentário (Ctrl + Enter para enviar)...'
                    : 'Escrever um feedback ou comentário (Ctrl + Enter para enviar)...'
                }
                rows={2}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                required
              />
              <span className="composer-shortcut-hint">Ctrl + Enter para enviar</span>
            </div>
            <button
              type="submit"
              className="btn btn-primary send-comment-btn"
              disabled={isSending || !newComment.trim()}
            >
              <Send size={15} />
              <span>{isSending ? 'Enviando...' : 'Comentar'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
