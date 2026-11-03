import { describe, it, expect } from 'vitest';
import {
  canSeeTool,
  canManageWhatsappMaintenance,
  canDeleteWhatsappItems,
  canImportOverwriteWhatsappMap,
  canDeleteReports,
  canEditFeriados,
  isTemplateAllowedForRole,
  formatFirstAndLastName,
  formatOperatorReportTitle,
} from './auth';
import { getNavigationItems } from '../utils/navigationItems';

describe('RBAC e Visibilidade de Abas por Perfil', () => {
  it('remove completamente a aba Formatador de Planilhas para todos os perfis', () => {
    for (const role of ['admin', 'gerente', 'supervisor', 'operador'] as const) {
      expect(canSeeTool(role, 'formatador')).toBe(false);
      const ids = getNavigationItems(0, 0, role).map((i) => i.id);
      expect(ids).not.toContain('formatador');
    }
  });

  it('Admin vê todas as abas (incluindo Gestão de Contas) e tem acesso total no WhatsApp Baias', () => {
    const ids = getNavigationItems(0, 0, 'admin').map((i) => i.id);
    expect(ids).toEqual([
      'relatorios',
      'escala',
      'relatorio-ura',
      'whatsapp',
      'metricas',
      'historico',
      'usuarios',
      'configuracoes',
    ]);
    expect(canManageWhatsappMaintenance('admin')).toBe(true);
    expect(canDeleteWhatsappItems('admin')).toBe(true);
    expect(canImportOverwriteWhatsappMap('admin')).toBe(true);
    expect(canDeleteReports('admin')).toBe(true);
    expect(canEditFeriados('admin')).toBe(true);
  });

  it('Supervisor e Gerente veem Central de Relatórios, WhatsApp Baias, Histórico e Configurações, sem manutenção ou exclusão', () => {
    for (const role of ['supervisor', 'gerente'] as const) {
      const ids = getNavigationItems(0, 0, role).map((i) => i.id);
      expect(ids).toEqual(['relatorios', 'whatsapp', 'historico', 'configuracoes']);
      expect(canManageWhatsappMaintenance(role)).toBe(false);
      expect(canDeleteWhatsappItems(role)).toBe(false);
      expect(canImportOverwriteWhatsappMap(role)).toBe(false);
      expect(canDeleteReports(role)).toBe(false);
      expect(canEditFeriados(role)).toBe(false);
    }
  });

  it('Operador vê apenas Central de Relatórios, Histórico e Configurações', () => {
    const ids = getNavigationItems(0, 0, 'operador').map((i) => i.id);
    expect(ids).toEqual(['relatorios', 'historico', 'configuracoes']);
    expect(canManageWhatsappMaintenance('operador')).toBe(false);
    expect(canDeleteWhatsappItems('operador')).toBe(false);
  });

  it('restringe modelos de relatórios para operador exclusivamente para atividades e tma', () => {
    expect(isTemplateAllowedForRole('operador', 'atividades-padrao')).toBe(true);
    expect(isTemplateAllowedForRole('operador', 'produtividade-atendimento')).toBe(true);
    expect(isTemplateAllowedForRole('operador', 'atividades-tabela')).toBe(false);
    expect(isTemplateAllowedForRole('operador', 'passagem-plantao')).toBe(false);
    expect(isTemplateAllowedForRole('operador', 'novo-colaborador')).toBe(false);
    expect(isTemplateAllowedForRole('operador', 'comunicado-geral')).toBe(false);
    expect(isTemplateAllowedForRole('operador', 'relatorio-incidente')).toBe(false);

    // Outros papéis têm acesso total
    for (const role of ['admin', 'gerente', 'supervisor'] as const) {
      expect(isTemplateAllowedForRole(role, 'atividades-padrao')).toBe(true);
      expect(isTemplateAllowedForRole(role, 'atividades-tabela')).toBe(true);
      expect(isTemplateAllowedForRole(role, 'passagem-plantao')).toBe(true);
      expect(isTemplateAllowedForRole(role, 'novo-colaborador')).toBe(true);
    }
  });

  it('formata primeiro e último nome corretamente', () => {
    expect(formatFirstAndLastName('Carlos Eduardo da Silva')).toBe('Carlos Silva');
    expect(formatFirstAndLastName('Beatriz Mendes')).toBe('Beatriz Mendes');
    expect(formatFirstAndLastName('Lucas')).toBe('Lucas');
    expect(formatFirstAndLastName('   Mariana   Alves   Ferreira   ')).toBe('Mariana Ferreira');
    expect(formatFirstAndLastName('')).toBe('');
  });

  it('padroniza o título do relatório de operador como Primeiro Ultimo - Data - Hora', () => {
    const user = { username: 'carlos123', displayName: 'Carlos Eduardo da Silva' };
    const title = formatOperatorReportTitle(user, '2026-10-30', '12:45');
    expect(title).toBe('Carlos Silva - 30/10/2026 - 12:45');

    const singleNameUser = { username: 'beatriz', displayName: 'Beatriz' };
    const title2 = formatOperatorReportTitle(singleNameUser, '2026-10-30', '09:00');
    expect(title2).toBe('Beatriz - 30/10/2026 - 09:00');

    const noDisplayNameUser = { username: 'operador_joao' };
    const title3 = formatOperatorReportTitle(noDisplayNameUser, '15/08/2026', '14:20');
    expect(title3).toBe('operador_joao - 15/08/2026 - 14:20');
  });
});

