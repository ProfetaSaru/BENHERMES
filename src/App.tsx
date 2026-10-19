import React, { useState, useEffect } from 'react';
import { useTasks } from './hooks/useTasks';
import { useTaskForm } from './hooks/useTaskForm';
import { useNotification } from './hooks/useNotification';
import { useTheme } from './hooks/useTheme';
import { useSavedReports } from './hooks/useSavedReports';
import { useMarkdownTemplates } from './hooks/useMarkdownTemplates';
import { Sidebar } from './components/layout/Sidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { ToolPlaceholder } from './components/layout/ToolPlaceholder';
import { ReportsHub } from './components/reports/ReportsHub';
import { ReportsHistoryHub } from './components/history/ReportsHistoryHub';
import { Modal } from './components/common/Modal';
import { Task, SavedReport, SaveReportParams } from './types/task';
import { getNavigationItems } from './utils/navigationItems';

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { tasks, addTask, updateTask, deleteTask, clearAllTasks, restoreTasks } = useTasks();
  const templateControls = useMarkdownTemplates();
  const {
    savedReports,
    saveReportQuick,
    saveReportCustom,
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

  const handleSaveReportQuick = (params: SaveReportParams) => {
    saveReportQuick(params);
    notify('Relatório salvo com sucesso no Histórico!', 'success');
  };

  const handleSaveReportCustom = (params: SaveReportParams) => {
    saveReportCustom(params);
    notify('Relatório personalizado salvo no Histórico!', 'success');
  };

  /**
   * Restauração universal de qualquer relatório do histórico.
   * Carrega o modelo exato, preenche seus campos, suas tarefas e navega para o gerador.
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

    templateControls.restoreTemplateState(report.templateId, report.fieldValues || {});
    restoreTasks(report.tasks || []);
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
              />
            </main>
          ) : activeToolId === 'historico' ? (
            <main className="container" style={{ maxWidth: '1200px' }}>
              <ReportsHistoryHub
                savedReports={savedReports}
                onDeleteReport={deleteReport}
                onRenameReport={renameReport}
                onClearAllReports={clearAllReports}
                onRestoreReport={handleRestoreReport}
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
