'use client';

import { useState } from 'react';
import type { FullTask } from '../hooks/useTasks';

interface TaskDetailProps {
  task: FullTask | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: FullTask['status']) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (subtaskId: string) => void;
}

export function TaskDetail({
  task,
  onClose,
  onUpdateStatus,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
}: TaskDetailProps) {
  const [newSubtask, setNewSubtask] = useState('');

  const handleAddSubtask = () => {
    if (newSubtask.trim()) {
      onAddSubtask(newSubtask);
      setNewSubtask('');
    }
  };

  if (!task) {
    return (
      <div>
        <div className="bg-bg-secondary border border-border rounded-xl p-8 text-center text-text-secondary">
          Select a task to view details
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-bg-secondary border border-border rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-start">
          <h2 className="font-semibold text-text-primary">{task.title}</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            &times;
          </button>
        </div>

        {task.description && (
          <p className="text-sm text-text-secondary">{task.description}</p>
        )}

        <div>
          <label className="text-xs text-text-secondary block mb-1">Status</label>
          <select
            value={task.status}
            onChange={(e) =>
              onUpdateStatus(task.id, e.target.value as FullTask['status'])
            }
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Subtasks */}
        <div>
          <label className="text-xs text-text-secondary block mb-2">Subtasks</label>
          <div className="space-y-2 mb-3">
            {task.subtasks?.map((st) => (
              <div key={st.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={st.completed}
                  onChange={() => onToggleSubtask(st.id)}
                  className="h-4 w-4 rounded border-border bg-bg-elevated accent-accent"
                />
                <span
                  className={`text-sm ${
                    st.completed
                      ? 'line-through text-text-secondary'
                      : 'text-text-primary'
                  }`}
                >
                  {st.title}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              placeholder="Add subtask..."
              className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
            />
            <button
              onClick={handleAddSubtask}
              className="px-3 py-1.5 bg-bg-elevated border border-border hover:border-accent rounded-lg text-sm text-text-secondary hover:text-accent transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div>
            <label className="text-xs text-text-secondary block mb-2">Tags</label>
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span
                  key={tag.name}
                  className="text-xs px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => onDelete(task.id)}
          className="w-full py-2 text-sm text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg transition-colors"
        >
          Delete Task
        </button>
      </div>
    </div>
  );
}
