import React, { useEffect } from 'react';
import { PlusCircle, Check, X, Clock } from 'lucide-react';
import { TaskFormData, NotificationState } from '../../types/task';
import { Panel } from '../common/Panel';
import { SectionHeading } from '../common/SectionHeading';
import { FormField } from '../common/FormField';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { NotificationToast } from '../common/NotificationToast';

interface TaskFormProps {
  formData: TaskFormData;
  isEditing: boolean;
  notification: NotificationState;
  onFieldChange: (field: keyof TaskFormData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancelEdit: () => void;
  templateCategories?: string[];
  itemLabel?: string;
}

export const TaskForm: React.FC<TaskFormProps> = ({
  formData,
  isEditing,
  notification,
  onFieldChange,
  onSubmit,
  onCancelEdit,
  templateCategories,
  itemLabel,
}) => {
  const hasCategories = Boolean(templateCategories && templateCategories.length > 0);

  // Auto-selecionar a primeira categoria se nenhuma estiver definida
  useEffect(() => {
    if (hasCategories && !formData.category && templateCategories && templateCategories[0]) {
      onFieldChange('category', templateCategories[0]);
    }
  }, [hasCategories, formData.category, templateCategories, onFieldChange]);

  const activeCategory = formData.category || (hasCategories && templateCategories ? templateCategories[0] : '');
  const isTentativa = activeCategory.toLowerCase().includes('tentativa');

  const defaultTitleLabel = itemLabel || 'Título';
  const titlePlaceholder = itemLabel?.toLowerCase().includes('cpf')
    ? 'Ex.: 000.000.000-00'
    : 'Ex.: Revisão de código';

  const formTitle = isEditing
    ? 'Editar entrada'
    : itemLabel
    ? `Adicionar ${itemLabel}`
    : 'Adicionar tarefa';

  const submitLabel = isEditing
    ? 'Salvar alterações'
    : itemLabel
    ? `Adicionar ${itemLabel}`
    : 'Adicionar tarefa';

  const SubmitIcon = isEditing ? Check : PlusCircle;

  const setNow = (field: 'start' | 'end') => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    onFieldChange(field, `${hh}:${mm}`);
  };

  return (
    <Panel className="form-panel">
      <SectionHeading kicker="Nova entrada" title={formTitle}>
        {isEditing && (
          <Button variant="text" icon={<X size={14} />} onClick={onCancelEdit}>
            Cancelar edição
          </Button>
        )}
      </SectionHeading>

      <form onSubmit={onSubmit}>
        {hasCategories && templateCategories && (
          <div className="task-category-selector-wrapper">
            <span className="task-category-selector-label">Etapa / Categoria:</span>
            <div className="task-category-pills">
              {templateCategories.map((cat) => {
                const isSelected = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`category-pill-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => onFieldChange('category', cat)}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={`time-fields ${isTentativa ? 'single-time-field' : ''}`}>
          <FormField
            label={isTentativa ? 'Horário do Contato' : 'Hora inicial'}
            htmlFor="start-time"
          >
            <div className="time-input-row">
              <Input
                id="start-time"
                name="start-time"
                type="time"
                required
                value={formData.start}
                onChange={(e) => onFieldChange('start', e.target.value)}
              />
              <button
                type="button"
                className="btn-time-now"
                onClick={() => setNow('start')}
                title="Preencher com horário atual"
              >
                <Clock size={12} />
                Agora
              </button>
            </div>
          </FormField>

          {!isTentativa && (
            <FormField label="Hora final" htmlFor="end-time">
              <div className="time-input-row">
                <Input
                  id="end-time"
                  name="end-time"
                  type="time"
                  required
                  value={formData.end}
                  onChange={(e) => onFieldChange('end', e.target.value)}
                />
                <button
                  type="button"
                  className="btn-time-now"
                  onClick={() => setNow('end')}
                  title="Preencher com horário atual"
                >
                  <Clock size={12} />
                  Agora
                </button>
              </div>
            </FormField>
          )}
        </div>

        <FormField label={defaultTitleLabel} htmlFor="title">
          <Input
            id="title"
            name="title"
            type="text"
            placeholder={titlePlaceholder}
            required
            value={formData.title}
            style={{ textTransform: 'uppercase' }}
            onChange={(e) => onFieldChange('title', e.target.value)}
          />
        </FormField>

        <FormField
          label={hasCategories ? 'Observação' : 'Descrição'}
          htmlFor="description"
          isOptional
        >
          <Textarea
            id="description"
            name="description"
            placeholder={hasCategories ? 'Observações internas (opcional)' : 'O que foi realizado?'}
            value={formData.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
          />
        </FormField>

        <Button type="submit" variant="primary" icon={<SubmitIcon size={16} />}>
          {submitLabel}
        </Button>
      </form>

      <NotificationToast message={notification.message} type={notification.type} />
    </Panel>
  );
};
