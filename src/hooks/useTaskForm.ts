import { useState, useCallback } from 'react';
import { Task, TaskFormData } from '../types/task';

const INITIAL_FORM_DATA: TaskFormData = {
  start: '',
  end: '',
  title: '',
  description: '',
  category: '',
};

export function useTaskForm() {
  const [formData, setFormData] = useState<TaskFormData>(INITIAL_FORM_DATA);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const setFieldValue = useCallback((field: keyof TaskFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === 'title' ? value.toUpperCase() : value,
    }));
  }, []);

  const startEditing = useCallback((task: Task) => {
    setEditingTaskId(task.id);
    setFormData({
      start: task.start,
      end: task.end,
      title: task.title.toUpperCase(),
      description: task.description,
      category: task.category || '',
    });
  }, []);

  const resetForm = useCallback(() => {
    setEditingTaskId(null);
    setFormData(INITIAL_FORM_DATA);
  }, []);

  const validate = useCallback(
    (isOptionalEnd = false): { valid: boolean; error?: string } => {
      if (!formData.start || !formData.title.trim()) {
        return { valid: false, error: 'Preencha o horário inicial e o título / CPF.' };
      }

      const isTentativa = (formData.category || '').toLowerCase().includes('tentativa');
      const allowNoEnd = isOptionalEnd || isTentativa;

      if (!allowNoEnd && !formData.end) {
        return { valid: false, error: 'Preencha a hora final.' };
      }

      if (formData.end && formData.end < formData.start) {
        return { valid: false, error: 'A hora final não pode ser anterior à hora inicial.' };
      }

      return { valid: true };
    },
    [formData]
  );

  return {
    formData,
    editingTaskId,
    isEditing: editingTaskId !== null,
    setFieldValue,
    startEditing,
    resetForm,
    validate,
  };
}
