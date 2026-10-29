import { useState, useCallback, useEffect } from 'react';
import { Task, SavedReport, SaveReportParams } from '../types/task';
import { apiRequest } from '../utils/apiClient';

function padZero(num: number): string {
  return String(num).padStart(2, '0');
}

export function getFormattedDate(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

export function getFormattedTime(d: Date): string {
  return `${padZero(d.getHours())}:${padZero(d.getMinutes())}`;
}

export function formatPeriodSummary(tasks: Task[]): string {
  if (!tasks || tasks.length === 0) return 'Sem tarefas';
  const first = tasks[0]?.start || '--:--';
  const last = tasks[tasks.length - 1]?.end || '--:--';
  return `${first} às ${last}`;
}

function buildReportPayload(params: SaveReportParams, isCustom = false): SavedReport {
  const now = new Date();
  const dateStr = isCustom && params.date ? params.date : getFormattedDate(now);
  const timeStr = isCustom && params.time ? params.time : getFormattedTime(now);
  const [yyyy, mm, dd] = dateStr.split('-');

  const fallbackTitle = params.isExpandable
    ? `${params.templateTitle || 'Relatório'} - ${dd}/${mm}/${yyyy} às ${timeStr}`
    : `${params.templateTitle || 'Relatório'} - ${dd}/${mm} às ${timeStr}`;

  const finalTitle = params.title?.trim() || fallbackTitle;
  const tasks = params.tasks || [];

  return {
    id: params.id || crypto.randomUUID(),
    title: finalTitle,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
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
}

export function useSavedReports(currentUserId?: string | null) {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  const refreshReports = useCallback(async () => {
    if (!currentUserId) {
      setSavedReports([]);
      return;
    }
    try {
      const res = await apiRequest<{ reports: SavedReport[] }>('/api/reports');
      if (Array.isArray(res.reports)) {
        setSavedReports(res.reports);
      }
    } catch {
      // Mantém lista atual caso offline em ambiente de teste
    }
  }, [currentUserId]);

  useEffect(() => {
    setSavedReports([]);
    void refreshReports();
  }, [currentUserId, refreshReports]);

  const upsertInState = useCallback((report: SavedReport) => {
    setSavedReports((prev) => {
      const idx = prev.findIndex((r) => r.id === report.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = report;
        return updated;
      }
      return [report, ...prev];
    });
  }, []);

  /**
   * Salvamento automático (atualiza o relatório ativo da conta logada ou cria um novo exclusivo dessa conta).
   */
  const autoSaveReport = useCallback(
    async (params: SaveReportParams): Promise<SavedReport> => {
      const payload = buildReportPayload(params, false);
      try {
        const res = await apiRequest<{ report: SavedReport }>('/api/reports/autosave', {
          method: 'POST',
          body: payload,
        });
        const saved = res.report || payload;
        upsertInState(saved);
        return saved;
      } catch {
        upsertInState(payload);
        return payload;
      }
    },
    [upsertInState]
  );

  /**
   * Salvamento rápido (1 clique) com metadados estruturados.
   */
  const saveReportQuick = useCallback(
    (params: SaveReportParams): SavedReport => {
      const newReport = buildReportPayload(params, false);
      upsertInState(newReport);

      void apiRequest<{ report: SavedReport }>('/api/reports', {
        method: 'POST',
        body: newReport,
      })
        .then((res) => {
          if (res.report) upsertInState(res.report);
        })
        .catch(() => {});

      return newReport;
    },
    [upsertInState]
  );

  /**
   * Salvamento customizado com título, data, horário e notas editáveis.
   */
  const saveReportCustom = useCallback(
    (params: SaveReportParams): SavedReport => {
      const newReport = buildReportPayload(params, true);
      upsertInState(newReport);

      void apiRequest<{ report: SavedReport }>('/api/reports', {
        method: 'POST',
        body: newReport,
      })
        .then((res) => {
          if (res.report) upsertInState(res.report);
        })
        .catch(() => {});

      return newReport;
    },
    [upsertInState]
  );

  /**
   * Excluir relatório arquivado por ID.
   */
  const deleteReport = useCallback((id: string) => {
    setSavedReports((prev) => prev.filter((r) => r.id !== id));
    void apiRequest(`/api/reports/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});
  }, []);

  /**
   * Renomear título de relatório arquivado.
   */
  const renameReport = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    setSavedReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, title: trimmed || r.title } : r))
    );
    void apiRequest(`/api/reports/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: { title: trimmed },
    }).catch(() => {});
  }, []);

  /**
   * Limpar todos os relatórios arquivados.
   */
  const clearAllReports = useCallback(() => {
    setSavedReports([]);
    void apiRequest('/api/reports', {
      method: 'DELETE',
    }).catch(() => {});
  }, []);

  return {
    savedReports,
    refreshReports,
    autoSaveReport,
    saveReportQuick,
    saveReportCustom,
    deleteReport,
    renameReport,
    clearAllReports,
  };
}
