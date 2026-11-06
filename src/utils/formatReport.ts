import { Task } from '../types/task';

export function formatTaskLine(task: Task): string {
  const upperTitle = task.title.trim().toUpperCase();
  const title = task.description ? `*${upperTitle}:*` : `*${upperTitle}*`;
  const description = task.description ? ` - ${task.description}` : '';
  return `${task.start} – ${task.end} ${title}${description};`;
}

export function generateReport(tasks: Task[]): string {
  if (tasks.length === 0) {
    return 'Nenhuma tarefa para mostrar.';
  }

  const lines = ['---', '# 📋 RELATÓRIO DE CONCLUSÃO DE ATIVIDADES', '', ...tasks.map(formatTaskLine), '---'];
  return lines.join('\n');
}
