import { useState, useCallback } from 'react';
import { Task, SavedReport, SaveReportParams } from '../types/task';

const STORAGE_SAVED_REPORTS_KEY = 'benhermes_saved_reports';

function padZero(num: number): string {
  return String(num).padStart(2, '0');
}

function getFormattedDate(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function getFormattedTime(d: Date): string {
  return `${padZero(d.getHours())}:${padZero(d.getMinutes())}`;
}

function formatPeriodSummary(tasks: Task[]): string {
  if (!tasks || tasks.length === 0) return 'Sem tarefas';
  const first = tasks[0]?.start || '--:--';
  const last = tasks[tasks.length - 1]?.end || '--:--';
  return `${first} às ${last}`;
}

/**
 * Lê e migra relatórios salvos retrocompativelmente para o novo esquema universal.
 */
function loadAndMigrateStoredReports(): SavedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any): SavedReport => {
      const tasks = Array.isArray(item.tasks) ? item.tasks : [];
      const isExpandable = item.isExpandable ?? (tasks.length > 0 || !item.templateId);

      return {
        id: item.id || crypto.randomUUID(),
        title: item.title || 'Relatório sem título',
        createdAt: item.createdAt || new Date().toISOString(),
        displayDate: item.displayDate || getFormattedDate(new Date()),
        displayTime: item.displayTime || getFormattedTime(new Date()),
        templateId: item.templateId || 'atividades-padrao',
        templateTitle: item.templateTitle || 'Relatório de Atividades',
        templateCategory: item.templateCategory || 'geral',
        isExpandable,
        fieldValues: item.fieldValues && typeof item.fieldValues === 'object' ? item.fieldValues : {},
        tasks,
        reportText: item.reportText || '',
        taskCount: typeof item.taskCount === 'number' ? item.taskCount : tasks.length,
        periodSummary: item.periodSummary || formatPeriodSummary(tasks),
        note: item.note || undefined,
        rawTemplateContent: item.rawTemplateContent || undefined,
      };
    });
  } catch (err) {
    console.error('Erro ao ler relatórios arquivados do localStorage:', err);
    return [];
  }
}

function persistReports(reports: SavedReport[]): void {
  try {
    localStorage.setItem(STORAGE_SAVED_REPORTS_KEY, JSON.stringify(reports));
  } catch (err) {
    console.error('Falha ao salvar relatórios arquivados no localStorage:', err);
  }
}

export function useSavedReports() {
  const [savedReports, setSavedReports] = useState<SavedReport[]>(loadAndMigrateStoredReports);

  /**
   * Salvamento rápido (1 clique) com metadados estruturados.
   */
  const saveReportQuick = useCallback((params: SaveReportParams): SavedReport => {
    const now = new Date();
    const dateStr = getFormattedDate(now);
    const timeStr = getFormattedTime(now);
    const [yyyy, mm, dd] = dateStr.split('-');

    const defaultTitle = params.title?.trim()
      ? params.title.trim()
      : params.isExpandable
      ? `${params.templateTitle || 'Relatório'} - ${dd}/${mm}/${yyyy} às ${timeStr}`
      : `${params.templateTitle || 'Relatório'} - ${dd}/${mm} às ${timeStr}`;

    const tasks = params.tasks || [];

    const newReport: SavedReport = {
      id: crypto.randomUUID(),
      title: defaultTitle,
      createdAt: now.toISOString(),
      displayDate: dateStr,
      displayTime: timeStr,
      templateId: params.templateId,
      templateTitle: params.templateTitle,
      templateCategory: params.templateCategory,
      isExpandable: params.isExpandable,
      fieldValues: params.fieldValues ? { ...params.fieldValues } : {},
      tasks: [...tasks],
      reportText: params.reportText,
      taskCount: tasks.length,
      periodSummary: formatPeriodSummary(tasks),
      note: params.note?.trim() || undefined,
    };

    setSavedReports((prev) => {
      const updated = [newReport, ...prev];
      persistReports(updated);
      return updated;
    });

    return newReport;
  }, []);

  /**
   * Salvamento customizado com título, data, horário e notas editáveis.
   */
  const saveReportCustom = useCallback((params: SaveReportParams): SavedReport => {
    const now = new Date();
    const dateStr = params.date || getFormattedDate(now);
    const timeStr = params.time || getFormattedTime(now);
    const [yyyy, mm, dd] = dateStr.split('-');

    const fallbackTitle = params.isExpandable
      ? `${params.templateTitle || 'Relatório'} - ${dd}/${mm}/${yyyy} às ${timeStr}`
      : `${params.templateTitle || 'Relatório'} - ${dd}/${mm} às ${timeStr}`;

    const finalTitle = params.title?.trim() || fallbackTitle;
    const tasks = params.tasks || [];

    const newReport: SavedReport = {
      id: crypto.randomUUID(),
      title: finalTitle,
      createdAt: now.toISOString(),
      displayDate: dateStr,
      displayTime: timeStr,
      templateId: params.templateId,
      templateTitle: params.templateTitle,
      templateCategory: params.templateCategory,
      isExpandable: params.isExpandable,
      fieldValues: params.fieldValues ? { ...params.fieldValues } : {},
      tasks: [...tasks],
      reportText: params.reportText,
      taskCount: tasks.length,
      periodSummary: formatPeriodSummary(tasks),
      note: params.note?.trim() || undefined,
    };

    setSavedReports((prev) => {
      const updated = [newReport, ...prev];
      persistReports(updated);
      return updated;
    });

    return newReport;
  }, []);

  /**
   * Excluir relatório arquivado por ID.
   */
  const deleteReport = useCallback((id: string) => {
    setSavedReports((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      persistReports(updated);
      return updated;
    });
  }, []);

  /**
   * Renomear título de relatório arquivado.
   */
  const renameReport = useCallback((id: string, newTitle: string) => {
    setSavedReports((prev) => {
      const updated = prev.map((r) =>
        r.id === id ? { ...r, title: newTitle.trim() || r.title } : r
      );
      persistReports(updated);
      return updated;
    });
  }, []);

  /**
   * Limpar todos os relatórios arquivados.
   */
  const clearAllReports = useCallback(() => {
    setSavedReports([]);
    persistReports([]);
  }, []);

  return {
    savedReports,
    saveReportQuick,
    saveReportCustom,
    deleteReport,
    renameReport,
    clearAllReports,
  };
}
