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
  isUnread?: boolean;
}

export type NoteComment = NoteCommentItem;

export const NOTE_COLORS: {
  id: NoteColor;
  label: string;
  accentColor: string;
  bgLight: string;
  bgDark: string;
}[] = [
  { id: 'default', label: 'Padrão (Slate)', accentColor: '#64748b', bgLight: '#f8fafc', bgDark: '#1e293b' },
  { id: 'yellow', label: 'Amarelo (Lembrete)', accentColor: '#f59e0b', bgLight: '#fefce8', bgDark: '#292212' },
  { id: 'blue', label: 'Azul (Informativo)', accentColor: '#3b82f6', bgLight: '#eff6ff', bgDark: '#172554' },
  { id: 'green', label: 'Verde (Concluído)', accentColor: '#10b981', bgLight: '#f0fdf4', bgDark: '#143322' },
  { id: 'purple', label: 'Roxo (Estratégico)', accentColor: '#8b5cf6', bgLight: '#faf5ff', bgDark: '#261b40' },
  { id: 'rose', label: 'Vermelho (Urgente)', accentColor: '#ef4444', bgLight: '#fef2f2', bgDark: '#381616' },
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

export function getAuthorInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
