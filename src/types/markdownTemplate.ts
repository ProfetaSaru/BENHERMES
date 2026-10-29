export type TemplateFieldType = 'text' | 'textarea' | 'tasks' | 'system' | 'password';

export type SystemAutoSource =
  | 'tarefas'
  | 'tarefas_tabela'
  | 'tarefas_lista'
  | 'data_atual'
  | 'hora_atual';

export interface TemplateField {
  id: string;
  label: string;
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
  fields?: TemplateField[];
  templateBody?: string;
  rawContent: string;
}

export interface ParsedMarkdownTemplate {
  meta: MarkdownTemplateMeta;
  fields: TemplateField[];
  templateBody: string;
}
