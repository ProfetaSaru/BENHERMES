import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  MessageSquare,
  User,
  Edit3,
  Trash2,
  Calendar,
  Clock,
} from 'lucide-react';
import type { NoteItem, NoteCommentItem } from '../../types/notes';
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

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-box note-detail-modal note-modal-${note.color}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '720px', width: '92%' }}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="detail-badges">
              <span className="note-category-badge">{note.category}</span>
              <span className={`color-dot color-dot-${note.color}`} title={`Cor: ${note.color}`} />
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

        <div className="note-detail-author-bar">
          <div className="author-meta">
            <User size={15} />
            <span className="author-name">{note.authorName}</span>
            <span className={`role-pill role-${note.authorRole}`}>
              {ROLE_LABELS[note.authorRole] || note.authorRole}
            </span>
          </div>
          <div className="date-meta">
            <Calendar size={13} />
            <span>Criado em {formatDate(note.createdAt)}</span>
            {note.updatedAt !== note.createdAt && (
              <span className="updated-meta">
                <Clock size={12} />
                Atualizado em {formatDate(note.updatedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="note-detail-body">
          <div className="note-full-content">{note.content}</div>
        </div>

        <div className="note-comments-section">
          <div className="comments-section-header">
            <MessageSquare size={16} />
            <h3>Comentários e Feedbacks ({comments.length})</h3>
          </div>

          {errorMsg && <div className="modal-error-banner">{errorMsg}</div>}

          <div className="comments-list">
            {isLoading ? (
              <div className="comments-loading">Carregando comentários...</div>
            ) : comments.length === 0 ? (
              <div className="comments-empty">
                Nenhum comentário registrado ainda. Deixe um feedback ou observação abaixo.
              </div>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className={`comment-bubble ${c.userId === currentUser.id ? 'is-me' : ''}`}
                >
                  <div className="comment-header">
                    <span className="comment-author">{c.authorName}</span>
                    <span className={`role-pill role-${c.authorRole}`}>
                      {ROLE_LABELS[c.authorRole] || c.authorRole}
                    </span>
                    <span className="comment-time">{formatDate(c.createdAt)}</span>
                  </div>
                  <div className="comment-text">{c.content}</div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendComment} className="comment-input-form">
            <textarea
              className="form-textarea comment-textarea"
              placeholder={
                currentUser.role === 'operador' && note.userId === currentUser.id
                  ? 'Responder aos comentários...'
                  : 'Escreva um comentário ou feedback para esta anotação...'
              }
              rows={2}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={isSending}
              required
            />
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
