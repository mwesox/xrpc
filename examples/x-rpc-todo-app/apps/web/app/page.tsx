'use client';

import { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { Header } from '../components/Header';
import { ErrorBanner } from '../components/ErrorBanner';
import { TaskList } from '../components/TaskList';
import { TaskDetail } from '../components/TaskDetail';
import { CreateTaskModal } from '../components/CreateTaskModal';
import type { TaskCreateInput } from '../xrpc/types';

export default function TaskManager() {
  const {
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
  } = useTasks();

  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreateTask = async (data: TaskCreateInput) => {
    setCreating(true);
    try {
      await createTask(data);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <Header onNewTask={() => setShowForm(true)} />
      <ErrorBanner error={error} onDismiss={clearError} />

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TaskList
            tasks={tasks}
            loading={loading}
            selectedTaskId={selectedTask?.id ?? null}
            onSelectTask={loadTask}
            onToggleComplete={(id, status) =>
              updateStatus(id, status as 'pending' | 'completed')
            }
          />
          <TaskDetail
            task={selectedTask}
            onClose={closeDetail}
            onUpdateStatus={updateStatus}
            onDelete={deleteTask}
            onAddSubtask={addSubtask}
            onToggleSubtask={toggleSubtask}
          />
        </div>
      </main>

      <CreateTaskModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreateTask}
        isSubmitting={creating}
      />
    </div>
  );
}
