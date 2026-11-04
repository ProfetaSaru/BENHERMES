import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  MessageSquare,
  Send,
  Calendar,
  Clock,
  Edit3,
  Trash2,
  CornerDownRight,
  AlertTriangle,
  HelpCircle,
  Bookmark,
  PhoneCall,
  MessageCircle,
  FileText,
  Bell,
} from 'lucide-react';
import type { NoteItem, NoteCommentItem } from '../../types/notes';
import { getAuthorInitials } from '../../types/notes';
import type { AuthUser, UserRole } from '../../types/auth';
import { ROLE_LABELS } from '../../types/auth';
import { apiRequest } from '../../utils/apiClient';

interface NoteDetailModalProps {
  isOpen: boolean;
  note: NoteItem | null;
  currentUser: AuthUser;
  onClose: () => void;
  onEdit: (note: NoteItem) => void;
  onDelete: (note: NoteItem) => void;
  onCommentsUpdated?: () => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
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

export const NoteDetailModal: React.FC<NoteDetailModalProps> = ({
  isOpen,
  note,
  currentUser,
  onClose,
  onEdit,
  onDelete,
  onCommentsUpdated,
  onNotify,
}) => {
  const [comments, setComments] = useState<NoteCommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const unreadDividerRef = useRef<HTMLDivElement>(null);

  // Encontra o índice da mensagem nova mais antiga (o primeiro comentário não lido)
  const firstUnreadIndex = comments.findIndex((c) => Boolean(c.isUnread));

  // Auto-scroll suave para começar pela mensagem nova mais antiga
  useEffect(() => {
    if (!isLoading && firstUnreadIndex !== -1 && unreadDividerRef.current) {
      const timer = setTimeout(() => {
        unreadDividerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isLoading, firstUnreadIndex]);

  const fetchComments = useCallback(async () => {
    if (!note) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await apiRequest<{ comments: NoteCommentItem[] }>(
        `/api/notes/${note.id}/comments`
      );
      const fetched = res.comments || [];
      setComments(fetched);

      // Se havia comentários não lidos, dá baixa via POST /read e sincroniza contadores
      if (fetched.some((c) => c.isUnread) || (note.unreadCommentsCount && note.unreadCommentsCount > 0)) {
        apiRequest(`/api/notes/${note.id}/read`, { method: 'POST' })
          .then(() => {
            if (onCommentsUpdated) {
              onCommentsUpdated();
            }
          })
          .catch(() => {});
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar comentários.');
    } finally {
      setIsLoading(false);
    }
  }, [note, onCommentsUpdated]);

  useEffect(() => {
    if (isOpen && note) {
      fetchComments();
    } else {
      setComments([]);
      setNewComment('');
      setErrorMsg(null);
    }
  }, [isOpen, note, fetchComments]);

  if (!isOpen || !note) return null;

  const canModify =
    currentUser.role === 'admin' ||
    (currentUser.role === 'gerente' && note.userId === currentUser.id) ||
    note.userId === currentUser.id;

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setIsSending(true);
      setErrorMsg(null);
      await apiRequest(`/api/notes/${note.id}/comments`, {
        method: 'POST',
        body: { content: newComment.trim() },
      });
      setNewComment('');
      await fetchComments();
      if (onCommentsUpdated) {
        onCommentsUpdated();
      }
      if (onNotify) {
        onNotify('Comentário enviado com sucesso!', 'success');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar comentário.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendComment(e);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
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
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`modal-card note-detail-modal-modern note-modal-${note.color}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '800px', width: '95%' }}
      >
        <div className="note-detail-top-accent" />

        <div className="modal-header">
          <div className="modal-title-group">
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

        <div className="modal-body note-detail-modal-body">
          {/* Barra de Informações do Autor e Datas */}
          <div className="note-detail-author-bar">
            <div className="author-cluster">
              <div className={`author-avatar-circle avatar-${note.authorRole}`}>
                {authorInitials}
              </div>
              <div className="author-text-meta">
                <span className="author-name">{note.authorName}</span>
                <span className={`role-badge role-badge-${note.authorRole}`}>
                  {ROLE_LABELS[note.authorRole as UserRole] || note.authorRole}
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
          <div className="note-detail-body-inner">
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
                comments.map((c, index) => {
                  const commentInitials = getAuthorInitials(c.authorName);
                  const isMe = c.userId === currentUser.id;
                  const isFirstUnread = index === firstUnreadIndex;
                  return (
                    <React.Fragment key={c.id}>
                      {isFirstUnread && (
                        <div ref={unreadDividerRef} className="discord-unread-divider">
                          <span className="discord-unread-divider-badge">
                            <Bell size={11} className="unread-divider-icon" />
                            <span>Novas Mensagens</span>
                          </span>
                        </div>
                      )}
                      <div
                        className={`comment-card ${isMe ? 'comment-is-me' : ''} ${c.isUnread ? 'comment-is-unread' : ''} role-card-${c.authorRole}`}
                      >
                        <div className="comment-card-header">
                          <div className="comment-author-group">
                            <div className={`author-avatar-circle avatar-small avatar-${c.authorRole}`}>
                              {commentInitials}
                            </div>
                            <span className="comment-author-name">{c.authorName}</span>
                            <span className={`role-badge role-badge-${c.authorRole}`}>
                              {ROLE_LABELS[c.authorRole as UserRole] || c.authorRole}
                            </span>
                            {c.isUnread && (
                              <span className="unread-comment-indicator">Novo</span>
                            )}
                          </div>
                          <span className="comment-timestamp">{formatDate(c.createdAt)}</span>
                        </div>
                        <div className="comment-card-body">{c.content}</div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendComment} className="comment-composer-form">
              <div className="composer-textarea-wrap">
                <textarea
                  className="textarea-field note-comment-input"
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
    </div>
  );
};
