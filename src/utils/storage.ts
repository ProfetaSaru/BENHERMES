import { Task } from '../types/task';

export const STORAGE_KEY = 'relatorio-atividades';
export const STORAGE_TEMPLATE_TASKS_KEY = 'benhermes_template_tasks';

/**
 * Carrega o mapa de tarefas por modelo de relatório (drafts isolados).
 * Realiza migração automática do armazenamento legado ('relatorio-atividades') para o modelo padrão ('atividades-padrao').
 */
export function loadStoredTasksByTemplate(): Record<string, Task[]> {
  try {
    const rawData = localStorage.getItem(STORAGE_TEMPLATE_TASKS_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Falha ao ler tarefas por modelo do localStorage:', error);
  }

  // Migração transparente de dados legados do armazenamento anterior
  try {
    const legacyRaw = localStorage.getItem(STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const migrated: Record<string, Task[]> = {
          'atividades-padrao': parsed,
        };
        saveStoredTasksByTemplate(migrated);
        return migrated;
      }
    }
  } catch {
    // Ignora erros na migração
  }

  return {};
}

/**
 * Salva o mapa de tarefas por modelo no localStorage.
 */
export function saveStoredTasksByTemplate(tasksByTemplate: Record<string, Task[]>): void {
  try {
    localStorage.setItem(STORAGE_TEMPLATE_TASKS_KEY, JSON.stringify(tasksByTemplate));
  } catch (error) {
    console.error('Falha ao salvar tarefas por modelo no localStorage:', error);
  }
}

/**
 * Funções legadas mantidas para retrocompatibilidade
 */
export function loadStoredTasks(): Task[] {
  const byTemplate = loadStoredTasksByTemplate();
  return byTemplate['atividades-padrao'] || [];
}

export function saveStoredTasks(tasks: Task[]): void {
  const byTemplate = loadStoredTasksByTemplate();
  byTemplate['atividades-padrao'] = tasks;
  saveStoredTasksByTemplate(byTemplate);
}
