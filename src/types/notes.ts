import type { UserRole } from './auth';

export type NoteColor = 'default' | 'yellow' | 'blue' | 'green' | 'purple' | 'rose';

export interface NoteItem {
  id: string;
  userId: string;
  authorName: string;
  authorRole: UserRole;
  supervisorId: string | null;
  supervisorName: string | null;
  title: string;
  content: string;
  category: string;
  color: NoteColor;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  unreadCommentsCount: number;
}

export interface NoteCommentItem {
  id: string;
  noteId: string;
  userId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export const NOTE_COLORS: { id: NoteColor; label: string; bgClass: string; borderClass: string }[] = [
  { id: 'default', label: 'Padrão', bgClass: 'note-color-default', borderClass: 'border-default' },
  { id: 'yellow', label: 'Amarelo (Lembrete)', bgClass: 'note-color-yellow', borderClass: 'border-yellow' },
  { id: 'blue', label: 'Azul (Informativo)', bgClass: 'note-color-blue', borderClass: 'border-blue' },
  { id: 'green', label: 'Verde (Concluído)', bgClass: 'note-color-green', borderClass: 'border-green' },
  { id: 'purple', label: 'Roxo (Estratégico)', bgClass: 'note-color-purple', borderClass: 'border-purple' },
  { id: 'rose', label: 'Vermelho (Urgente)', bgClass: 'note-color-rose', borderClass: 'border-rose' },
];

export const NOTE_CATEGORIES = [
  'Geral',
  'Rotina',
  'Dúvida',
  'Lembrete',
  'Urgente',
  'Atendimento',
  'Feedback',
] as const;

