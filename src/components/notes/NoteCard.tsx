import React from 'react';
import {
  MessageSquare,
  Bell,
  Edit3,
  Trash2,
  Calendar,
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

interface NoteCardProps {
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
      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      if (isToday) {
        return `Hoje às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      }

      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const initials = getAuthorInitials(note.authorName);

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
      {/* Barra de Acento Superior */}
      <div className="note-card-top-accent" />

      <div className="note-card-header">
        <div className="note-card-badges">
          <span className={`note-category-chip cat-${note.category.toLowerCase()}`}>
            {getCategoryIcon(note.category)}
            <span>{note.category}</span>
          </span>

          {note.unreadCommentsCount > 0 && (
            <span className="note-unread-pulse-badge" title="Novos comentários de superiores">
              <Bell size={11} className="pulse-icon" />
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
              <Edit3 size={13} />
            </button>
            <button
              type="button"
              className="note-action-btn delete-btn"
              title="Excluir anotação"
              onClick={onDelete}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      <h3 className="note-card-title">{note.title}</h3>
      <p className="note-card-content">{note.content}</p>

      <div className="note-card-footer">
        <div className="note-card-author-cluster">
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

        <div className="note-card-meta-cluster">
          <div className="note-date-chip" title="Data de criação">
            <Calendar size={11} />
            <span>{formatDate(note.createdAt)}</span>
          </div>
          <div className="note-comments-pill" title={`${note.commentsCount} comentário(s)`}>
            <MessageSquare size={12} />
            <span>{note.commentsCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
