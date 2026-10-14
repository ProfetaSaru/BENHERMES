import { useState, useCallback } from 'react';
import { Task, SavedReport } from '../types/task';
import { generateReport } from '../utils/formatReport';

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
  if (tasks.length === 0) return 'Sem atividades';
  const first = tasks[0].start || '--:--';
  const last = tasks[tasks.length - 1].end || '--:--';
  return `${first} às ${last}`;
}

function loadStoredReports(): SavedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
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
  const [savedReports, setSavedReports] = useState<SavedReport[]>(loadStoredReports);

  /**
   * Salvamento rápido em 1 clique com data e hora atuais.
   */
  const saveReportQuick = useCallback((tasks: Task[], customText?: string): SavedReport => {
    const now = new Date();
    const dateStr = getFormattedDate(now);
    const timeStr = getFormattedTime(now);

    const [yyyy, mm, dd] = dateStr.split('-');
    const defaultTitle = `Relatório de ${dd}/${mm}/${yyyy} às ${timeStr}`;

    const newReport: SavedReport = {
      id: crypto.randomUUID(),
      title: defaultTitle,
      createdAt: now.toISOString(),
      displayDate: dateStr,
      displayTime: timeStr,
      tasks: [...tasks],
      reportText: customText || generateReport(tasks),
      taskCount: tasks.length,
      periodSummary: formatPeriodSummary(tasks),
    };

    setSavedReports((prev) => {
      const updated = [newReport, ...prev];
      persistReports(updated);
      return updated;
    });

    return newReport;
  }, []);

  /**
   * Salvamento customizado com título, data e horário editáveis.
   */
  const saveReportCustom = useCallback(
    (params: {
      tasks: Task[];
      title: string;
      date: string; // YYYY-MM-DD
      time: string; // HH:mm
      note?: string;
      customText?: string;
    }): SavedReport => {
      const now = new Date();
      const dateStr = params.date || getFormattedDate(now);
      const timeStr = params.time || getFormattedTime(now);

      const [yyyy, mm, dd] = dateStr.split('-');
      const fallbackTitle = `Relatório de ${dd}/${mm}/${yyyy} às ${timeStr}`;
      const finalTitle = params.title.trim() || fallbackTitle;

      const newReport: SavedReport = {
        id: crypto.randomUUID(),
        title: finalTitle,
        createdAt: now.toISOString(),
        displayDate: dateStr,
        displayTime: timeStr,
        tasks: [...params.tasks],
        reportText: params.customText || generateReport(params.tasks),
        taskCount: params.tasks.length,
        periodSummary: formatPeriodSummary(params.tasks),
        note: params.note?.trim(),
      };

      setSavedReports((prev) => {
        const updated = [newReport, ...prev];
        persistReports(updated);
        return updated;
      });

      return newReport;
    },
    []
  );

  /**
   * Excluir relatório salvo por id.
   */
  const deleteReport = useCallback((id: string) => {
    setSavedReports((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      persistReports(updated);
      return updated;
    });
  }, []);

  /**
   * Renomear título do relatório arquivado.
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

  /**
   * Salvar relatório diretamente com texto fornecido (usado por modelos Markdown).
   */
  const saveDirectReport = useCallback(
    (title: string, reportText: string, tasks: Task[] = []): SavedReport => {
      const now = new Date();
      const dateStr = getFormattedDate(now);
      const timeStr = getFormattedTime(now);

      const [yyyy, mm, dd] = dateStr.split('-');
      const fallbackTitle = `Relatório de ${dd}/${mm}/${yyyy} às ${timeStr}`;
      const finalTitle = title.trim() || fallbackTitle;

      const newReport: SavedReport = {
        id: crypto.randomUUID(),
        title: finalTitle,
        createdAt: now.toISOString(),
        displayDate: dateStr,
        displayTime: timeStr,
        tasks: [...tasks],
        reportText,
        taskCount: tasks.length,
        periodSummary: formatPeriodSummary(tasks),
      };

      setSavedReports((prev) => {
        const updated = [newReport, ...prev];
        persistReports(updated);
        return updated;
      });

      return newReport;
    },
    []
  );

  return {
    savedReports,
    saveReportQuick,
    saveReportCustom,
    saveDirectReport,
    deleteReport,
    renameReport,
    clearAllReports,
  };
}
