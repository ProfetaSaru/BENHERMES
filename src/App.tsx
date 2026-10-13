import React, { useState, useEffect } from 'react';
import { useTasks } from './hooks/useTasks';
import { useTaskForm } from './hooks/useTaskForm';
import { useNotification } from './hooks/useNotification';
import { useTheme } from './hooks/useTheme';
import { useSavedReports } from './hooks/useSavedReports';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { ToolPlaceholder } from './components/layout/ToolPlaceholder';
import { QuickTemplatesHub } from './components/templates/QuickTemplatesHub';
import { ReportsHistoryHub } from './components/history/ReportsHistoryHub';
import { TaskForm } from './components/task/TaskForm';
import { ReportPanel } from './components/task/ReportPanel';
import { Modal } from './components/common/Modal';
import { Task } from './types/task';
import { getNavigationItems } from './utils/navigationItems';

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { tasks, addTask, updateTask, deleteTask, clearAllTasks, restoreTasks } = useTasks();
  const {
    savedReports,
    saveReportQuick,
    saveReportCustom,
    saveDirectReport,
    deleteReport,
    renameReport,
    clearAllReports,
  } = useSavedReports();
  const {
    formData,
    editingTaskId,
    isEditing,
    setFieldValue,
    startEditing,
    resetForm,
    validate,
  } = useTaskForm();
  const { notification, notify } = useNotification();
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Navegação e Layout
  const [activeToolId, setActiveToolId] = useState<string>('relatorios');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem('benhermes_sidebar_collapsed') === 'true' ||
        localStorage.getItem('autohub_sidebar_collapsed') === 'true'
      );
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('benhermes_sidebar_collapsed', String(isSidebarCollapsed));
    } catch {
      // Ignore localStorage exceptions
    }
  }, [isSidebarCollapsed]);

  const navItems = getNavigationItems(tasks.length, savedReports.length);
  const activeItem = navItems.find((item) => item.id === activeToolId) || navItems[0];

  const handleSaveReportQuick = () => {
    if (tasks.length === 0) {
      notify('Adicione pelo menos uma tarefa para salvar o relatório.', 'error');
      return;
    }
    saveReportQuick(tasks);
    notify('Relatório salvo com sucesso no Histórico!', 'success');
  };

  const handleSaveReportCustom = (params: {
    title: string;
    date: string;
    time: string;
    note?: string;
  }) => {
    if (tasks.length === 0) {
      notify('Adicione pelo menos uma tarefa para salvar o relatório.', 'error');
      return;
    }
    saveReportCustom({ tasks, ...params });
    notify('Relatório personalizado salvo no Histórico!', 'success');
  };

  const handleRestoreTasksFromHistory = (restoredTasks: Task[]) => {
    restoreTasks(restoredTasks);
    resetForm();
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
      />

      <div className="dashboard-main">
        <TopNavbar
          activeItem={activeItem}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          taskCount={tasks.length}
        />

        <div className="dashboard-content-area">
          {activeToolId === 'relatorios' ? (
            <main className="container">
              <Header taskCount={tasks.length} />

              <div className="layout">
                <TaskForm
                  formData={formData}
                  isEditing={isEditing}
                  notification={notification}
                  onFieldChange={setFieldValue}
                  onSubmit={handleSubmit}
                  onCancelEdit={resetForm}
                />

                <ReportPanel
                  tasks={tasks}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                  onRequestClearAll={handleOpenClearModal}
                  onSaveReportQuick={handleSaveReportQuick}
                  onSaveReportCustom={handleSaveReportCustom}
                  onNotify={notify}
                  onNavigateToTemplates={() => setActiveToolId('modelos')}
                />
              </div>
            </main>
          ) : activeToolId === 'modelos' ? (
            <main className="container" style={{ maxWidth: '1360px' }}>
              <QuickTemplatesHub
                notification={notification}
                onNotify={notify}
                tasks={tasks}
                onSaveToHistory={(title, reportText) => {
                  saveDirectReport(title, reportText, tasks);
                  notify('Relatório salvo no Histórico!', 'success');
                }}
              />
            </main>
          ) : activeToolId === 'historico' ? (
            <main className="container" style={{ maxWidth: '1200px' }}>
              <ReportsHistoryHub
                savedReports={savedReports}
                onDeleteReport={deleteReport}
                onRenameReport={renameReport}
                onClearAllReports={clearAllReports}
                onRestoreTasks={handleRestoreTasksFromHistory}
                onNotify={notify}
                onNavigateToGenerator={() => setActiveToolId('relatorios')}
              />
            </main>
          ) : (
            <ToolPlaceholder
              tool={activeItem}
              onBackToReports={() => setActiveToolId('relatorios')}
            />
          )}
        </div>
      </div>

      <Modal
        isOpen={isClearModalOpen}
        kicker="Atenção"
        title="Excluir tarefas?"
        message="Essa ação removerá todas as tarefas salvas neste navegador."
        confirmLabel="Excluir tudo"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmClear}
        onCancel={() => setIsClearModalOpen(false)}
      />
    </div>
  );
};

export default App;
