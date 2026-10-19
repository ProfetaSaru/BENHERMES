import React from 'react';
import { Clock, Pencil, Trash2, Tag } from 'lucide-react';
import { Task } from '../../types/task';
import { Button } from '../common/Button';

interface TaskItemProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string, title: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onEdit, onDelete }) => {
  return (
    <article className="task-item">
      <div className="task-content">
        <div className="task-meta-row">
          <span className="task-time">
            <Clock size={13} />
            {task.end ? `${task.start} – ${task.end}` : `${task.start} (Contato)`}
          </span>
          {task.category && (
            <span className="task-category-badge">
              <Tag size={11} />
              {task.category}
            </span>
          )}
        </div>
        <h3>{task.title.toUpperCase()}</h3>
        {task.description && <p>{task.description}</p>}
      </div>

      <div className="task-actions">
        <Button
          variant="edit"
          icon={<Pencil size={13} />}
          onClick={() => onEdit(task)}
          aria-label={`Editar ${task.title}`}
        >
          Editar
        </Button>
        <Button
          variant="delete"
          icon={<Trash2 size={13} />}
          onClick={() => onDelete(task.id, task.title)}
          aria-label={`Excluir ${task.title}`}
        >
          Excluir
        </Button>
      </div>
    </article>
  );
};
