import { TaskItem } from './TaskItem';
import type { TaskSummary } from '../hooks/useTasks';

interface TaskListProps {
  tasks: TaskSummary[];
  loading: boolean;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onToggleComplete: (id: string, currentStatus: string) => void;
}

export function TaskList({
  tasks,
  loading,
  selectedTaskId,
  onSelectTask,
  onToggleComplete,
}: TaskListProps) {
  return (
    <div className="lg:col-span-2">
      <div className="bg-bg-secondary border border-border rounded-xl">
        {loading ? (
          <div className="p-8 text-center text-text-secondary">Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">
            No tasks yet. Create one to get started.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                isSelected={selectedTaskId === task.id}
                onClick={() => onSelectTask(task.id)}
                onToggleComplete={() =>
                  onToggleComplete(
                    task.id,
                    task.status === 'completed' ? 'pending' : 'completed'
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
