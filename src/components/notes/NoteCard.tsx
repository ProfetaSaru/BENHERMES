import React from 'react';
import { MessageSquare, Bell, Edit3, Trash2, User } from 'lucide-react';
import type { NoteItem } from '../../types/notes';
import type { AuthUser } from '../../types/auth';
import { ROLE_LABELS } from '../../types/auth';

interface NoteCardProps {
  note: NoteItem;
  currentUser: AuthUser;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  currentUser,
  onClick,
  onEdit,
  onDelete,
}) => {
  const canModify = currentUser.role === 'admin' || note.userId === currentUser.id;

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
    <div
      className={`note-card note-card-${note.color} ${note.unreadCommentsCount > 0 ? 'has-unread' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="note-card-header">
        <div className="note-card-badges">
          <span className="note-category-badge">{note.category}</span>
          {note.unreadCommentsCount > 0 && (
            <span className="note-unread-badge" title="Novos comentários não lidos">
              <Bell size={12} className="animate-bounce" />
              <span>{note.unreadCommentsCount} novo{note.unreadCommentsCount > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>

        {canModify && (
          <div className="note-card-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="note-action-btn edit-btn"
              title="Editar anotação"
              onClick={onEdit}
            >
              <Edit3 size={14} />
            </button>
            <button
              type="button"
              className="note-action-btn delete-btn"
              title="Excluir anotação"
              onClick={onDelete}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <h3 className="note-card-title">{note.title}</h3>
      <p className="note-card-content">{note.content}</p>

      <div className="note-card-footer">
        <div className="note-card-author">
          <User size={13} />
          <span className="author-name">{note.authorName}</span>
          <span className={`role-pill role-${note.authorRole}`}>
            {ROLE_LABELS[note.authorRole] || note.authorRole}
          </span>
        </div>

        <div className="note-card-meta">
          <span className="note-date">{formatDate(note.createdAt)}</span>
          <span className="note-comments-counter" title={`${note.commentsCount} comentário(s)`}>
            <MessageSquare size={13} />
            <span>{note.commentsCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

