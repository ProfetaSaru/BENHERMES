import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ReportVisualRenderer,
  calculateDuration,
  ReportVisualMode,
} from './ReportVisualRenderer';
import { Task } from '../../types/task';

describe('ReportVisualRenderer Component', () => {
  const mockTasks: Task[] = [
    {
      id: '1',
      title: '123.456.789-00',
      start: '08:00',
      end: '08:25',
      category: 'Desbloqueados',
      description: 'Atendimento prioritário',
    },
    {
      id: '2',
      title: '987.654.321-00',
      start: '08:30',
      end: '08:50',
      category: 'Formalização',
      description: '',
    },
    {
      id: '3',
      title: '111.222.333-44',
      start: '09:00',
      end: '',
      category: 'Tentativa',
      description: 'Cliente ocupado',
    },
  ];

  it('calcula a duração entre horários corretamente', () => {
    expect(calculateDuration('08:00', '08:25')).toBe('25 min');
    expect(calculateDuration('08:00', '09:30')).toBe('1h 30m');
    expect(calculateDuration('08:00', '09:00')).toBe('1h');
    expect(calculateDuration('08:00', '08:00')).toBe('0 min');
    expect(calculateDuration('', '')).toBe('');
  });

  const modes: ReportVisualMode[] = ['cards', 'terminal', 'executive'];

  it.each(modes)('renderiza produtividade-atendimento no modo %s sem erros', (mode) => {
    const html = renderToStaticMarkup(
      <ReportVisualRenderer
        templateId="produtividade-atendimento"
        visualMode={mode}
        tasks={mockTasks}
        fieldValues={{ nome_colaborador: 'João Silva' }}
        rawReportText="RELATÓRIO DE PRODUTIVIDADE - JOÃO SILVA"
        title="Relatório de Produtividade & TMA"
        onEditTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />
    );
    expect(html).toBeDefined();
    if (mode === 'cards') {
      expect(html).toContain('JOÃO SILVA');
      expect(html).toContain('Desbloqueados');
    }
  });

  it.each(modes)('renderiza novo-colaborador no modo %s sem erros', (mode) => {
    const html = renderToStaticMarkup(
      <ReportVisualRenderer
        templateId="novo-colaborador"
        visualMode={mode}
        tasks={[]}
        fieldValues={{
          nome_completo: 'Amanda Silva',
          setor: 'Operações',
          equipe: 'Alpha',
          login_vanguard: 'amanda.vanguard',
          senha_vanguard: 'Vanguard@123',
        }}
        rawReportText="NOVO COLABORADOR: AMANDA SILVA"
        title="Novo Colaborador (TI / Acessos)"
      />
    );
    expect(html).toBeDefined();
    if (mode === 'cards') {
      expect(html).toContain('AMANDA SILVA');
      expect(html).toContain('Sistema Vanguard');
    }
  });

  it.each(modes)('renderiza passagem-plantao no modo %s sem erros', (mode) => {
    const html = renderToStaticMarkup(
      <ReportVisualRenderer
        templateId="passagem-plantao"
        visualMode={mode}
        tasks={mockTasks}
        fieldValues={{
          turno_saindo: 'Manhã',
          responsavel_saindo: 'Carlos',
          turno_entrando: 'Tarde',
          responsavel_entrando: 'Mariana',
          pendencias_criticas: 'Aguardando baia 4',
        }}
        rawReportText="PASSAGEM DE PLANTÃO"
        title="Passagem de Plantão & Troca de Turno"
        onEditTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />
    );
    expect(html).toBeDefined();
  });

  it.each(modes)('renderiza comunicado-geral no modo %s sem erros', (mode) => {
    const html = renderToStaticMarkup(
      <ReportVisualRenderer
        templateId="comunicado-geral"
        visualMode={mode}
        tasks={[]}
        fieldValues={{
          assunto: 'Manutenção Preventiva',
          nivel_prioridade: 'Alta',
          mensagem_principal: 'Servidores serão reiniciados às 22h',
        }}
        rawReportText="COMUNICADO OFICIAL: Manutenção Preventiva"
        title="Comunicado Geral & Aviso Interno"
      />
    );
    expect(html).toBeDefined();
  });

  it.each(modes)('renderiza relatorio-incidente no modo %s sem erros', (mode) => {
    const html = renderToStaticMarkup(
      <ReportVisualRenderer
        templateId="relatorio-incidente"
        visualMode={mode}
        tasks={[]}
        fieldValues={{
          ticket_id: 'INC-999',
          sistema_afetado: 'API Vanguard',
          impacto_observado: 'Lentidão nas consultas',
        }}
        rawReportText="RELATÓRIO DE INCIDENTE"
        title="Relatório de Incidente / Pós-Mortem"
      />
    );
    expect(html).toBeDefined();
  });

  it.each(modes)('renderiza atividades-padrao no modo %s sem erros com ações integradas', (mode) => {
    const html = renderToStaticMarkup(
      <ReportVisualRenderer
        templateId="atividades-padrao"
        visualMode={mode}
        tasks={mockTasks}
        fieldValues={{}}
        rawReportText="RELATÓRIO DE CONCLUSÃO DE ATIVIDADES"
        title="Relatório de Atividades Padrão"
        onEditTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />
    );
    expect(html).toBeDefined();
  });
});
