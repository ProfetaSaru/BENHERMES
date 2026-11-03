import React from 'react';
import {
  MessageSquare,
  Bell,
  Edit3,
  Trash2,
  ArrowRight,
  AlertTriangle,
  Clock,
  HelpCircle,
  Bookmark,
  PhoneCall,
  MessageCircle,
  FileText,
} from 'lucide-react';
import type { NoteItem } from '../../types/notes';
import { getAuthorInitials } from '../../types/notes';
import type { AuthUser } from '../../types/auth';
import { ROLE_LABELS } from '../../types/auth';

interface NoteRowProps {
  note: NoteItem;
  currentUser: AuthUser;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
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

  const initials = getAuthorInitials(note.authorName);

  return (
    <tr
      className={`note-table-row note-row-${note.color} ${note.unreadCommentsCount > 0 ? 'has-unread' : ''}`}
      onClick={onClick}
    >
      <td className="note-cell-color-accent">
        <div className={`color-accent-strip color-strip-${note.color}`} />
        <span className={`note-category-chip cat-${note.category.toLowerCase()}`}>
          {getCategoryIcon(note.category)}
          <span>{note.category}</span>
        </span>
      </td>

      <td className="note-cell-info">
        <div className="note-row-title-wrap">
          <strong className="note-row-title">{note.title}</strong>
          {note.unreadCommentsCount > 0 && (
            <span className="note-unread-pulse-badge" title="Novos comentários">
              <Bell size={11} className="pulse-icon" />
              <span>{note.unreadCommentsCount} novo</span>
            </span>
          )}
        </div>
        <p className="note-row-snippet">{note.content}</p>
      </td>

      <td className="note-cell-author">
        <div className="author-row-cluster">
          <div className={`author-avatar-circle avatar-${note.authorRole}`} title={note.authorName}>
            {initials}
          </div>
          <div className="author-text-meta">
            <span className="author-name">{note.authorName}</span>
            <span className={`role-badge role-badge-${note.authorRole}`}>
              {ROLE_LABELS[note.authorRole] || note.authorRole}
            </span>
          </div>
        </div>
      </td>

      <td className="note-cell-date">
        <span>{formatDate(note.createdAt)}</span>
      </td>

      <td className="note-cell-comments">
        <div className="note-comments-pill">
          <MessageSquare size={12} />
          <span>{note.commentsCount}</span>
        </div>
      </td>

      <td className="note-cell-actions" onClick={(e) => e.stopPropagation()}>
        <div className="actions-cluster">
          <button
            type="button"
            className="note-table-btn view-btn"
            title="Abrir detalhes e comentários"
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
