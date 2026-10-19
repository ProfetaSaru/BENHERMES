export type TemplateFieldType = 'text' | 'textarea' | 'tasks' | 'system' | 'password';

export type SystemAutoSource =
  | 'tarefas'
  | 'tarefas_tabela'
  | 'tarefas_lista'
  | 'data_atual'
  | 'hora_atual';

export interface TemplateField {
  id: string; // ex: 'cliente', 'tarefas_tabela'
  label: string; // ex: 'Cliente', 'Tabela de Tarefas'
  type: TemplateFieldType;
  defaultValue?: string;
  isSystemAuto: boolean;
  systemSource?: SystemAutoSource;
  placeholder?: string;
}

export interface MarkdownTemplateMeta {
  id: string;
  title: string;
  description: string;
  category: 'atividades' | 'operacional' | 'comunicados' | 'incidentes' | 'personalizado';
  icon?: string;
  isBuiltin: boolean;
  expandable?: boolean;
  categories?: string[];
  itemLabel?: string;
  createdAt?: string;
  rawContent: string;
}

export interface ParsedMarkdownTemplate {
  meta: MarkdownTemplateMeta;
  fields: TemplateField[];
  templateBody: string;
}
