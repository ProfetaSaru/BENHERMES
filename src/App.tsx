import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useTasks } from './hooks/useTasks';
import { useTaskForm } from './hooks/useTaskForm';
import { useNotification } from './hooks/useNotification';
import { useTheme } from './hooks/useTheme';
import { useSavedReports, getFormattedTime } from './hooks/useSavedReports';
import { useMarkdownTemplates } from './hooks/useMarkdownTemplates';
import { Sidebar } from './components/layout/Sidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { ToolPlaceholder } from './components/layout/ToolPlaceholder';
import { ReportsHub } from './components/reports/ReportsHub';
import { LoginScreen } from './components/auth/LoginScreen';
import { Modal } from './components/common/Modal';
import { Task, SavedReport, SaveReportParams } from './types/task';
import { AuthUser, canSeeTool } from './types/auth';
import { getNavigationItems } from './utils/navigationItems';
import { renderTemplate } from './utils/markdownTemplateParser';
import { apiRequest, setStoredAuthToken } from './utils/apiClient';

// Lazy loading das ferramentas secundárias para otimização de bundle e code-splitting
const ReportsHistoryHub = lazy(() =>
  import('./components/history/ReportsHistoryHub').then((m) => ({ default: m.ReportsHistoryHub }))
);
const EscalaBasesHub = lazy(() =>
  import('./components/escala/EscalaBasesHub').then((m) => ({ default: m.EscalaBasesHub }))
);
const RelatorioUraHub = lazy(() =>
  import('./components/relatorioUra/RelatorioUraHub').then((m) => ({ default: m.RelatorioUraHub }))
);
const ConfiguracoesHub = lazy(() =>
  import('./components/configuracoes/ConfiguracoesHub').then((m) => ({ default: m.ConfiguracoesHub }))
);
const WhatsappHub = lazy(() =>
  import('./components/whatsapp/WhatsappHub').then((m) => ({ default: m.WhatsappHub }))
);
const UsersManagementHub = lazy(() =>
  import('./components/users/UsersManagementHub').then((m) => ({ default: m.UsersManagementHub }))
);

interface ServerUserDrafts {
  activeTemplateId: string;
  tasksByTemplate: Record<string, Task[]>;
  fieldsByTemplate: Record<string, Record<string, string>>;
  activeReportIds: Record<string, string>;
  theme?: 'light' | 'dark';
}

export const App: React.FC = () => {
  const { theme, setTheme, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [draftsHydratedForUser, setDraftsHydratedForUser] = useState<string | null>(null);

  const templateControls = useMarkdownTemplates();
  const {
    tasks,
    tasksByTemplate,
    addTask,
    updateTask,
    deleteTask,
    clearAllTasks,
    restoreTasks,
    replaceAllTasksByTemplate,
    resetAllTasks,
    getTemplateTaskCount,
  } = useTasks(templateControls.activeTemplateId);

  const {
    savedReports,
    refreshReports,
    autoSaveReport,
    saveReportQuick,
    saveReportCustom,
    deleteReport,
    renameReport,
    clearAllReports,
  } = useSavedReports(currentUser?.id);

  const {
    formData,
    editingTaskId,
    isEditing,
    setFieldValue,
    startEditing,
    resetForm,
    validate,
  } = useTaskForm();

  const [activeReportIds, setActiveReportIds] = useState<Record<string, string>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string | null>(null);
  const lastSignatureByTemplateRef = useRef<Record<string, string>>({});

  const clearWorkingReportState = useCallback(() => {
    setDraftsHydratedForUser(null);
    resetAllTasks();
    templateControls.resetAllDrafts();
    setActiveReportIds({});
    lastSignatureByTemplateRef.current = {};
    setAutoSaveStatus('idle');
    setLastAutoSavedTime(null);
    resetForm();
  }, [resetAllTasks, templateControls.resetAllDrafts, resetForm]);

  useEffect(() => {
    let active = true;
    apiRequest<{ user: AuthUser }>('/api/auth/me')
      .then((res) => {
        if (active && res.user) {
          setCurrentUser(res.user);
        }
      })
      .catch(() => {
        if (active) {
          setCurrentUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setAuthChecking(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Carrega os rascunhos isolados da conta logada a partir do banco SQLite (/api/drafts)
  useEffect(() => {
    if (!currentUser) {
      clearWorkingReportState();
      return;
    }

    let active = true;
    clearWorkingReportState();

    apiRequest<{ drafts: ServerUserDrafts }>('/api/drafts')
      .then((res) => {
        if (!active) return;
        const d = res?.drafts;
        if (d) {
          const nextTasks = d.tasksByTemplate && typeof d.tasksByTemplate === 'object' ? d.tasksByTemplate : {};
          const nextFields = d.fieldsByTemplate && typeof d.fieldsByTemplate === 'object' ? d.fieldsByTemplate : {};
          const nextIds = d.activeReportIds && typeof d.activeReportIds === 'object' ? d.activeReportIds : {};

          if (d.theme === 'light' || d.theme === 'dark') {
            setTheme(d.theme);
          }

          // Registra assinatura inicial de cada modelo para evitar auto-save duplicado ao abrir
          const initialSignatures: Record<string, string> = {};
          const allTemplateIds = new Set([
            ...Object.keys(nextTasks),
            ...Object.keys(nextFields),
            d.activeTemplateId || 'atividades-padrao',
          ]);
          for (const tplId of allTemplateIds) {
            initialSignatures[tplId] = JSON.stringify({
              tasks: nextTasks[tplId] || [],
              fields: nextFields[tplId] || {},
            });
          }
          lastSignatureByTemplateRef.current = initialSignatures;

          templateControls.hydrateDrafts(d.activeTemplateId, nextFields);
          replaceAllTasksByTemplate(nextTasks);
          setActiveReportIds(nextIds);
        }
      })
      .catch(() => {
        // Inicia com estado limpo caso servidor de rascunhos não responda (ex.: ambiente de teste)
      })
      .finally(() => {
        if (active) {
          setDraftsHydratedForUser(currentUser.id);
        }
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, clearWorkingReportState, templateControls.hydrateDrafts, replaceAllTasksByTemplate, setTheme]);

  // Sincroniza o rascunho exclusivo do usuário logado no servidor (/api/drafts)
  useEffect(() => {
    if (!currentUser || draftsHydratedForUser !== currentUser.id) return;

    const timer = window.setTimeout(() => {
      void apiRequest('/api/drafts', {
        method: 'PUT',
        body: {
          activeTemplateId: templateControls.activeTemplateId,
          tasksByTemplate,
          fieldsByTemplate: templateControls.fieldsByTemplate,
          activeReportIds,
          theme,
        },
      }).catch(() => {});
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    currentUser,
    draftsHydratedForUser,
    templateControls.activeTemplateId,
    tasksByTemplate,
    templateControls.fieldsByTemplate,
    activeReportIds,
    theme,
  ]);

  const handleLogout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout network error
    }
    setStoredAuthToken(null);
    clearWorkingReportState();
    setCurrentUser(null);
  }, [clearWorkingReportState]);

  // Reseta o formulário de cadastro de tarefas ao mudar de modelo
  useEffect(() => {
    resetForm();
  }, [templateControls.activeTemplateId, resetForm]);

  const { notification, notify } = useNotification();
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Navegação e Layout
  const [activeToolId, setActiveToolId] = useState<string>('relatorios');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Garante que a aba ativa seja permitida para o perfil logado
  useEffect(() => {
    if (currentUser && !canSeeTool(currentUser.role, activeToolId)) {
      setActiveToolId('relatorios');
    }
  }, [currentUser, activeToolId]);

  // Atualiza a lista de relatórios sempre que abrir a aba Histórico
  useEffect(() => {
    if (currentUser && activeToolId === 'historico') {
      void refreshReports();
    }
  }, [currentUser, activeToolId, refreshReports]);

  // --- SALVAMENTO AUTOMÁTICO DE RELATÓRIOS (ISOLADO POR CONTA LOGADA) ---
  const getOrAssignActiveReportId = useCallback(
    (templateId: string): string => {
      if (activeReportIds[templateId]) {
        return activeReportIds[templateId];
      }
      const newId = crypto.randomUUID();
      setActiveReportIds((prev) => ({ ...prev, [templateId]: newId }));
      return newId;
    },
    [activeReportIds]
  );

  useEffect(() => {
    if (!currentUser || draftsHydratedForUser !== currentUser.id) return;

    const tplId = templateControls.activeTemplateId;
    const fields = templateControls.fieldValues;
    const signature = JSON.stringify({ tasks, fields });

    // Inicializa a assinatura na primeira leitura do modelo para só salvar quando houver alteração
    if (lastSignatureByTemplateRef.current[tplId] === undefined) {
      lastSignatureByTemplateRef.current[tplId] = signature;
      return;
    }

    if (lastSignatureByTemplateRef.current[tplId] === signature) {
      return;
    }

    const hasTasks = tasks.length > 0;
    const hasFields = Object.values(fields).some((v) => typeof v === 'string' && v.trim().length > 0);
    if (!hasTasks && !hasFields) {
      lastSignatureByTemplateRef.current[tplId] = signature;
      return;
    }

    setAutoSaveStatus('saving');
    const timer = window.setTimeout(async () => {
      const reportId = getOrAssignActiveReportId(tplId);
      const parsed = templateControls.parsedActiveTemplate;
      const compiledText = renderTemplate(parsed.templateBody, fields, tasks);

      const saved = await autoSaveReport({
        id: reportId,
        templateId: parsed.meta.id,
        templateTitle: parsed.meta.title,
        templateCategory: parsed.meta.category,
        isExpandable: parsed.meta.expandable === true,
        fieldValues: fields,
        tasks,
        reportText: compiledText,
      });

      if (saved && saved.id && saved.id !== reportId) {
        setActiveReportIds((prev) => ({ ...prev, [tplId]: saved.id }));
      }

      lastSignatureByTemplateRef.current[tplId] = signature;
      setAutoSaveStatus('saved');
      setLastAutoSavedTime(getFormattedTime(new Date()));
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [
    currentUser,
    draftsHydratedForUser,
    tasks,
    templateControls.activeTemplateId,
    templateControls.fieldValues,
    templateControls.parsedActiveTemplate,
    getOrAssignActiveReportId,
    autoSaveReport,
  ]);

  const handleStartNewReport = useCallback(() => {
    const tplId = templateControls.activeTemplateId;
    const hasData =
      tasks.length > 0 ||
      Object.values(templateControls.fieldValues).some((v) => v && v.trim().length > 0);
    if (hasData) {
      const confirmed = window.confirm(
        'Iniciar um novo relatório em branco? O relatório atual já está salvo no Histórico.'
      );
      if (!confirmed) return;
    }
    const freshId = crypto.randomUUID();
    setActiveReportIds((prev) => ({ ...prev, [tplId]: freshId }));
    clearAllTasks();
    templateControls.resetFieldValues();
    resetForm();
    lastSignatureByTemplateRef.current[tplId] = JSON.stringify({ tasks: [], fields: {} });
    setAutoSaveStatus('idle');
    notify('Novo relatório iniciado!', 'info');
  }, [
    templateControls,
    tasks.length,
    clearAllTasks,
    resetForm,
    notify,
  ]);

  const navItems = getNavigationItems(
    tasks.length,
    savedReports.length,
    currentUser?.role || 'admin'
  );
  const activeItem = navItems.find((item) => item.id === activeToolId) || navItems[0];

  const handleSaveReportQuick = (params: SaveReportParams) => {
    const reportId = getOrAssignActiveReportId(params.templateId);
    saveReportQuick({ ...params, id: reportId });
    setAutoSaveStatus('saved');
    setLastAutoSavedTime(getFormattedTime(new Date()));
    notify('Relatório salvo com sucesso no Histórico!', 'success');
  };

  const handleSaveReportCustom = (params: SaveReportParams) => {
    const saved = saveReportCustom(params);
    setActiveReportIds((prev) => ({ ...prev, [params.templateId]: saved.id }));
    setAutoSaveStatus('saved');
    setLastAutoSavedTime(getFormattedTime(new Date()));
    notify('Relatório personalizado salvo no Histórico!', 'success');
  };

  /**
   * Restauração universal de um relatório no gerador da conta atual.
   * Se o relatório pertencer a outro usuário (ex.: Admin/Supervisor visualizando histórico),
   * gera um novo ID próprio para não sobrescrever o relatório da outra conta.
   */
  const handleRestoreReport = (report: SavedReport) => {
    const hasCurrentData =
      tasks.length > 0 || Object.keys(templateControls.fieldValues).length > 0;

    if (hasCurrentData) {
      const confirmed = window.confirm(
        `Deseja restaurar o relatório "${report.title}" no Gerador?\n\nO modelo correspondente ("${report.templateTitle}") será selecionado e os dados atuais do formulário serão substituídos.`
      );
      if (!confirmed) return;
    }

    const isOwnReport = !report.userId || report.userId === currentUser?.id;
    const targetReportId = isOwnReport ? report.id : crypto.randomUUID();

    setActiveReportIds((prev) => ({ ...prev, [report.templateId]: targetReportId }));
    lastSignatureByTemplateRef.current[report.templateId] = JSON.stringify({
      tasks: report.tasks || [],
      fields: report.fieldValues || {},
    });
    templateControls.restoreTemplateState(report.templateId, report.fieldValues || {});
    restoreTasks(report.templateId, report.tasks || []);
    resetForm();
    setActiveToolId('relatorios');
    notify(`Relatório "${report.title}" restaurado com sucesso!`, 'success');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const validationResult = validate();
    if (!validationResult.valid) {
      notify(validationResult.error || 'Erro na validação.', 'error');
      return;
    }

    if (editingTaskId) {
      updateTask(editingTaskId, formData);
      notify('Tarefa atualizada.', 'success');
      resetForm();
      return;
    }

    addTask(formData);
    notify('Tarefa adicionada.', 'success');
    resetForm();
  };

  const handleEditTask = (task: Task) => {
    startEditing(task);
  };

  const handleDeleteTask = (id: string, title: string) => {
    const confirmed = window.confirm(`Excluir a tarefa "${title}"?`);
    if (!confirmed) {
      return;
    }

    deleteTask(id);
    if (editingTaskId === id) {
      resetForm();
    }
    notify('Tarefa excluída.', 'success');
  };

  const handleOpenClearModal = () => {
    if (tasks.length === 0) {
      return;
    }
    setIsClearModalOpen(true);
  };

  const handleConfirmClear = () => {
    clearAllTasks();
    resetForm();
    setIsClearModalOpen(false);
    notify('Todas as tarefas foram excluídas.', 'success');
  };

  if (authChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
        }}
      >
        Carregando BENHERMES...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          clearWorkingReportState();
          setCurrentUser(user);
          setActiveToolId('relatorios');
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="dashboard-root">
      <Sidebar
        items={navItems}
        activeToolId={activeToolId}
        onSelectTool={setActiveToolId}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        currentUser={currentUser}
      />

      <div className="dashboard-main">
        <TopNavbar
          activeItem={activeItem}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          taskCount={tasks.length}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <div className="dashboard-content-area">
          {activeToolId === 'relatorios' || activeToolId === 'modelos' ? (
            <main className="container" style={{ maxWidth: '1480px', padding: '0 16px' }}>
              <ReportsHub
                tasks={tasks}
                formData={formData}
                isEditing={isEditing}
                onFieldChange={setFieldValue}
                onSubmitTask={handleSubmit}
                onCancelEditTask={resetForm}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onRequestClearAll={handleOpenClearModal}
                onSaveReportQuick={handleSaveReportQuick}
                onSaveReportCustom={handleSaveReportCustom}
                notification={notification}
                onNotify={notify}
                templateControls={templateControls}
                getTemplateTaskCount={getTemplateTaskCount}
                autoSaveStatus={autoSaveStatus}
                lastAutoSavedTime={lastAutoSavedTime}
                onStartNewReport={handleStartNewReport}
              />
            </main>
          ) : (
            <Suspense
              fallback={
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Carregando módulo...
                </div>
              }
            >
              {activeToolId === 'historico' ? (
                <main className="container" style={{ maxWidth: '1200px' }}>
                  <ReportsHistoryHub
                    savedReports={savedReports}
                    onDeleteReport={deleteReport}
                    onRenameReport={renameReport}
                    onClearAllReports={clearAllReports}
                    onRestoreReport={handleRestoreReport}
                    onNotify={notify}
                    onNavigateToGenerator={() => setActiveToolId('relatorios')}
                    currentUser={currentUser}
                  />
                </main>
              ) : activeToolId === 'usuarios' && currentUser.role === 'admin' ? (
                <main className="container" style={{ maxWidth: '1200px', padding: '0 16px' }}>
                  <UsersManagementHub currentUser={currentUser} onNotify={notify} />
                </main>
              ) : activeToolId === 'configuracoes' ? (
                <main className="container" style={{ maxWidth: '1100px', padding: '0 16px' }}>
                  <ConfiguracoesHub
                    onNotify={notify}
                    currentUser={currentUser}
                    theme={theme}
                    onToggleTheme={toggleTheme}
                  />
                </main>
              ) : activeToolId === 'escala' && currentUser.role === 'admin' ? (
                <main className="container" style={{ maxWidth: '1200px', padding: '0 16px' }}>
                  <EscalaBasesHub onNotify={notify} />
                </main>
              ) : activeToolId === 'whatsapp' && currentUser.role !== 'operador' ? (
                <main className="container" style={{ maxWidth: '1480px', padding: '0 16px' }}>
                  <WhatsappHub
                    notification={notification}
                    onNotify={notify}
                    userRole={currentUser.role}
                  />
                </main>
              ) : activeToolId === 'relatorio-ura' && currentUser.role === 'admin' ? (
                <main className="container" style={{ maxWidth: '1480px', padding: '0 16px' }}>
                  <RelatorioUraHub onNotify={notify} />
                </main>
              ) : (
                <ToolPlaceholder
                  tool={activeItem}
                  onBackToReports={() => setActiveToolId('relatorios')}
                />
              )}
            </Suspense>
          )}
        </div>
      </div>

      <Modal
        isOpen={isClearModalOpen}
        kicker="Atenção"
        title={`Excluir tarefas de "${templateControls.activeTemplate.title}"?`}
        message={`Essa ação removerá todas as tarefas salvas no rascunho de "${templateControls.activeTemplate.title}". Os rascunhos dos demais modelos serão mantidos.`}
        confirmLabel="Excluir tarefas"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmClear}
        onCancel={() => setIsClearModalOpen(false)}
      />
    </div>
  );
};

export default App;
