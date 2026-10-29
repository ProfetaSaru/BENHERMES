import { describe, it, expect } from 'vitest';
import {
  canSeeTool,
  canManageWhatsappMaintenance,
  canDeleteWhatsappItems,
  canImportOverwriteWhatsappMap,
  canDeleteReports,
  canEditFeriados,
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
});

