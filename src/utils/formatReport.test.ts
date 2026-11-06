import { describe, it, expect } from 'vitest';
import { formatTaskLine, generateReport } from './formatReport';
import { Task } from '../types/task';

describe('formatReport util', () => {
  it('retorna mensagem padrão quando não há tarefas', () => {
    expect(generateReport([])).toBe('Nenhuma tarefa para mostrar.');
  });

  it('formata linha de tarefa com descrição', () => {
    const task: Task = {
      id: '1',
      title: 'Atendimento',
      description: 'Chamados na fila de suporte',
      start: '08:00',
      end: '12:00',
    };
    expect(formatTaskLine(task)).toBe('08:00 – 12:00 *ATENDIMENTO:* - Chamados na fila de suporte;');
  });

  it('formata linha de tarefa sem descrição', () => {
    const task: Task = {
      id: '2',
      title: 'Treinamento',
      description: '',
      start: '13:00',
      end: '14:00',
    };
    expect(formatTaskLine(task)).toBe('13:00 – 14:00 *TREINAMENTO*;');
  });

  it('gera relatório completo com réguas horizontais e cabeçalho formatado', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'Atendimento',
        description: 'Chamados',
        start: '08:00',
        end: '12:00',
      },
      {
        id: '2',
        title: 'Almoço',
        description: '',
        start: '12:00',
        end: '13:00',
      },
    ];

    const report = generateReport(tasks);
    const expected = [
      '---',
      '# 📋 RELATÓRIO DE CONCLUSÃO DE ATIVIDADES',
      '',
      '08:00 – 12:00 *ATENDIMENTO:* - Chamados;',
      '12:00 – 13:00 *ALMOÇO*;',
      '---',
    ].join('\n');

    expect(report).toBe(expected);
  });
});
