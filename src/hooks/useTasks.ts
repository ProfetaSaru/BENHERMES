import { useState, useCallback, useMemo } from 'react';
import { Task, TaskFormData } from '../types/task';

function sortTaskList(items: Task[]): Task[] {
  return [...items].sort((a, b) => a.start.localeCompare(b.start));
}

export function useTasks(activeTemplateId: string = 'atividades-padrao') {
  const [tasksByTemplate, setTasksByTemplate] = useState<Record<string, Task[]>>({});

  // Lista de tarefas do modelo ativo no momento
  const tasks = useMemo(() => {
    return tasksByTemplate[activeTemplateId] || [];
  }, [tasksByTemplate, activeTemplateId]);

  const addTask = useCallback(
    (formData: TaskFormData): Task => {
      const newTask: Task = {
        id: crypto.randomUUID(),
        ...formData,
        title: formData.title.trim().toUpperCase(),
      };

      setTasksByTemplate((prev) => {
        const currentList = prev[activeTemplateId] || [];
        const updated = sortTaskList([...currentList, newTask]);
        return {
          ...prev,
          [activeTemplateId]: updated,
        };
      });

      return newTask;
    },
    [activeTemplateId]
  );

  const updateTask = useCallback(
    (id: string, formData: TaskFormData): boolean => {
      let wasUpdated = false;

      setTasksByTemplate((prev) => {
        const currentList = prev[activeTemplateId] || [];
        const taskIndex = currentList.findIndex((t) => t.id === id);
        if (taskIndex === -1) {
          return prev;
        }

        wasUpdated = true;
        const updatedList = [...currentList];
        updatedList[taskIndex] = {
          id,
          ...formData,
          title: formData.title.trim().toUpperCase(),
        };

        return {
          ...prev,
          [activeTemplateId]: sortTaskList(updatedList),
        };
      });

      return wasUpdated;
    },
    [activeTemplateId]
  );

  const deleteTask = useCallback(
    (id: string) => {
      setTasksByTemplate((prev) => {
        const currentList = prev[activeTemplateId] || [];
        return {
          ...prev,
          [activeTemplateId]: currentList.filter((t) => t.id !== id),
        };
      });
    },
    [activeTemplateId]
  );

  const clearAllTasks = useCallback(() => {
    setTasksByTemplate((prev) => ({
      ...prev,
      [activeTemplateId]: [],
    }));
  }, [activeTemplateId]);

  /**
   * Restaura tarefas no modelo alvo especificado (ou no modelo ativo se chamado sem id)
   */
  const restoreTasks = useCallback(
    (targetTemplateIdOrTasks: string | Task[], optionalTasks?: Task[]) => {
      let targetId = activeTemplateId;
      let taskList: Task[] = [];

      if (typeof targetTemplateIdOrTasks === 'string') {
        targetId = targetTemplateIdOrTasks;
        taskList = optionalTasks || [];
      } else if (Array.isArray(targetTemplateIdOrTasks)) {
        taskList = targetTemplateIdOrTasks;
      }

      const sorted = sortTaskList(
        taskList.map((t) => ({ ...t, title: String(t.title || '').toUpperCase() }))
      );

      setTasksByTemplate((prev) => ({
        ...prev,
        [targetId]: sorted,
      }));
    },
    [activeTemplateId]
  );

  const replaceAllTasksByTemplate = useCallback((rawMap: Record<string, Task[]>) => {
    const normalized: Record<string, Task[]> = {};
    if (rawMap && typeof rawMap === 'object') {
      for (const [key, list] of Object.entries(rawMap)) {
        if (Array.isArray(list)) {
          normalized[key] = sortTaskList(
            list.map((task) => ({
              ...task,
              title: String(task.title || '').toUpperCase(),
            }))
          );
        }
      }
    }
    setTasksByTemplate(normalized);
  }, []);

  const resetAllTasks = useCallback(() => {
    setTasksByTemplate({});
  }, []);

  const getTemplateTaskCount = useCallback(
    (templateId: string): number => {
      return (tasksByTemplate[templateId] || []).length;
    },
    [tasksByTemplate]
  );

  const totalAllTasksCount = useMemo(() => {
    return Object.values(tasksByTemplate).reduce(
      (acc, curr) => acc + (curr ? curr.length : 0),
      0
    );
  }, [tasksByTemplate]);

  return {
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
    totalAllTasksCount,
  };
}
