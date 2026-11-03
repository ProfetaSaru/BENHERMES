import React from 'react';
import { MessageSquare, Bell, Edit3, Trash2, ArrowRight } from 'lucide-react';
import type { NoteItem } from '../../types/notes';
import type { AuthUser } from '../../types/auth';
import { ROLE_LABELS } from '../../types/auth';

interface NoteRowProps {
  note: NoteItem;
  currentUser: AuthUser;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const NoteRow: React.FC<NoteRowProps> = ({
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
    <tr
      className={`note-table-row note-row-${note.color} ${note.unreadCommentsCount > 0 ? 'has-unread' : ''}`}
      onClick={onClick}
    >
      <td className="note-cell-color">
        <span className={`color-dot color-dot-${note.color}`} title={`Cor: ${note.color}`} />
        <span className="note-category-badge">{note.category}</span>
      </td>

      <td className="note-cell-info">
        <div className="note-row-title-wrap">
          <strong className="note-row-title">{note.title}</strong>
          {note.unreadCommentsCount > 0 && (
            <span className="note-unread-badge" title="Novos comentários">
              <Bell size={11} />
              <span>{note.unreadCommentsCount} novo</span>
            </span>
          )}
        </div>
        <p className="note-row-snippet">{note.content}</p>
      </td>

      <td className="note-cell-author">
        <div className="author-wrap">
          <span className="author-name">{note.authorName}</span>
          <span className={`role-pill role-${note.authorRole}`}>
            {ROLE_LABELS[note.authorRole] || note.authorRole}
          </span>
        </div>
      </td>

      <td className="note-cell-date">
        <span>{formatDate(note.createdAt)}</span>
      </td>

      <td className="note-cell-comments">
        <span className="note-comments-counter">
          <MessageSquare size={14} />
          <span>{note.commentsCount}</span>
        </span>
      </td>

      <td className="note-cell-actions" onClick={(e) => e.stopPropagation()}>
        <div className="actions-cluster">
          <button
            type="button"
            className="note-table-btn view-btn"
            title="Ver anotação completa e comentários"
            onClick={onClick}
          >
            <ArrowRight size={14} />
          </button>
          {canModify && (
            <>
              <button
                type="button"
                className="note-table-btn edit-btn"
                title="Editar anotação"
                onClick={onEdit}
              >
                <Edit3 size={14} />
              </button>
              <button
                type="button"
                className="note-table-btn delete-btn"
                title="Excluir anotação"
                onClick={onDelete}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

