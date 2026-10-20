export interface Task {
  id: string;
  start: string;
  end: string;
  title: string;
  description: string;
  category?: string;
}

export type TaskFormData = Omit<Task, 'id'>;

export type NotificationType = 'success' | 'error' | 'info' | '';

export interface NotificationState {
  message: string;
  type: NotificationType;
}

export interface SavedReport {
  id: string;
  title: string;
  createdAt: string; // ISO string
  displayDate: string; // YYYY-MM-DD
  displayTime: string; // HH:mm
  templateId: string; // ID do modelo (ex: 'atividades-padrao', 'relatorio-incidente', etc.)
  templateTitle: string;
  templateCategory?: string;
  isExpandable?: boolean;
  fieldValues?: Record<string, string>; // Valores dos campos de formulário preenchidos
  tasks: Task[];
  reportText: string;
  taskCount: number;
  periodSummary: string;
  note?: string;
  rawTemplateContent?: string;
}

export interface SaveReportParams {
  templateId: string;
  templateTitle: string;
  templateCategory?: string;
  isExpandable?: boolean;
  fieldValues?: Record<string, string>;
  tasks?: Task[];
  reportText: string;
  title?: string;
  date?: string;
  time?: string;
  note?: string;
}
