import { describe, it, expect } from 'vitest';
import {
  extractBaseTitle,
  updateReportTitleWithCurrentTimestamp,
} from '../hooks/useSavedReports';
import { AuthUser } from '../types/auth';

describe('Ciclo de Vida de Relatórios: Títulos e Atualização de Timestamp', () => {
  it('extractBaseTitle deve extrair corretamente o título base removendo sufixos de data e hora', () => {
    expect(
      extractBaseTitle('Relatório de Atividades - 03/11/2026 às 11:05')
    ).toBe('Relatório de Atividades');

    expect(
      extractBaseTitle('Incidente Servidor Produção - 25/10 às 14:30')
    ).toBe('Incidente Servidor Produção');

    expect(
      extractBaseTitle('Chamado Urgente - 12/05/2025 - 08:00')
    ).toBe('Chamado Urgente');

    expect(
      extractBaseTitle('Meu Relatório Sem Data')
    ).toBe('Meu Relatório Sem Data');

    expect(extractBaseTitle('')).toBe('');
  });

  it('updateReportTitleWithCurrentTimestamp deve atualizar o título preservando a base e inserindo a nova data/hora', () => {
    const originalTitle = 'Relatório de Atividades - 20/10/2026 às 09:00';
    const updated = updateReportTitleWithCurrentTimestamp(
      originalTitle,
      'Relatório de Atividades Padrão',
      '2026-11-03',
      '11:45',
      {
        id: 'user-1',
        username: 'supervisor1',
        displayName: 'Carlos Supervisor',
        role: 'supervisor',
        supervisorId: null,
        supervisorName: null,
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      }
    );

    expect(updated).toBe('Relatório de Atividades - 03/11/2026 às 11:45');
  });

  it('updateReportTitleWithCurrentTimestamp deve usar o templateTitle caso o título original seja vazio', () => {
    const updated = updateReportTitleWithCurrentTimestamp(
      '',
      'Incidente Crítico',
      '2026-11-03',
      '12:00',
      null
    );

    expect(updated).toBe('Incidente Crítico - 03/11/2026 às 12:00');
  });

  it('updateReportTitleWithCurrentTimestamp deve formatar no padrão de operador caso role seja operador', () => {
    const operatorUser: AuthUser = {
      id: 'op-1',
      username: 'joao.silva',
      displayName: 'João Carlos Silva',
      role: 'operador',
      supervisorId: 'sup-1',
      supervisorName: 'Supervisor Teste',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const updated = updateReportTitleWithCurrentTimestamp(
      'Qualquer Título Anterior',
      'Relatório Padrão',
      '2026-11-03',
      '11:50',
      operatorUser
    );

    expect(updated).toBe('João Silva - 03/11/2026 - 11:50');
  });
});
