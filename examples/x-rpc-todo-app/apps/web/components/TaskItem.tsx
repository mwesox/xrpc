import { Badge } from './Badge';
import type { TaskSummary } from '../hooks/useTasks';

interface TaskItemProps {
  task: TaskSummary;
  isSelected: boolean;
  onClick: () => void;
  onToggleComplete: () => void;
}

export function TaskItem({ task, isSelected, onClick, onToggleComplete }: TaskItemProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-colors ${
        isSelected ? 'bg-accent/10' : 'hover:bg-bg-elevated'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.status === 'completed'}
          onChange={(e) => {
            e.stopPropagation();
            onToggleComplete();
          }}
          className="mt-1 h-4 w-4 rounded border-border bg-bg-elevated accent-accent"
        />
        <div className="flex-1 min-w-0">
          <p
            className={`font-medium ${
              task.status === 'completed'
                ? 'line-through text-text-secondary'
                : 'text-text-primary'
            }`}
          >
            {task.title}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge type="priority" value={task.priority} />
            <Badge type="status" value={task.status} />
            {task.subtaskCount > 0 && (
              <span className="text-xs text-text-secondary">
                {task.subtaskCompletedCount}/{task.subtaskCount} subtasks
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
