import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import type { TaskListOutput, TaskGetOutput } from '../xrpc/types';

export type TaskSummary = TaskListOutput['tasks'][number];
export type FullTask = TaskGetOutput;

export function useTasks() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<FullTask | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const loadTasks = useCallback(async () => {
    try {
      const result = await api.task.list({ limit: 50 });
      setTasks(result.tasks);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTask = async (id: string) => {
    try {
      const result = await api.task.get({ id });
      setSelectedTask(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    }
  };

  const createTask = async (data: {
    title: string;
    description?: string;
    priority?: string;
  }) => {
    await api.task.create({
      title: data.title.trim(),
      description: data.description?.trim() || undefined,
      priority: (data.priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
      estimatedHours: 1,
    });
    loadTasks();
  };

  const updateStatus = async (id: string, status: FullTask['status']) => {
    try {
      await api.task.update({ id, status });
      loadTasks();
      if (selectedTask?.id === id) loadTask(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.task.delete({ id });
      if (selectedTask?.id === id) setSelectedTask(null);
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const addSubtask = async (title: string) => {
    if (!selectedTask || !title.trim()) return;
    try {
      await api.subtask.add({ taskId: selectedTask.id, title: title.trim() });
      loadTask(selectedTask.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subtask');
    }
  };

  const toggleSubtask = async (subtaskId: string) => {
    if (!selectedTask) return;
    try {
      await api.subtask.toggle({ taskId: selectedTask.id, subtaskId });
      loadTask(selectedTask.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle subtask');
    }
  };

  const closeDetail = useCallback(() => setSelectedTask(null), []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return {
    tasks,
    loading,
    error,
    selectedTask,
    loadTask,
    createTask,
    updateStatus,
    deleteTask,
    addSubtask,
    toggleSubtask,
    clearError,
    setError,
    closeDetail,
  };
}
