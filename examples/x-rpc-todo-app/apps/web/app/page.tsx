'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '../xrpc/client';

// Form data interface for creating tasks
interface TaskFormData {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  estimatedHours?: number;
  tags?: { name: string; color: string }[];
}

// Create the API client once with configuration
const api = createClient({
  baseUrl: 'http://localhost:8080/api',
  validateInputs: true,
  validateOutputs: false,
});

// Types for the task list response
interface TaskSummary {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  createdAt: string;
  completedAt?: string | null;
  tagCount: number;
  subtaskCount: number;
  subtaskCompletedCount: number;
  estimatedHours?: number;
  position: number;
}

interface Tag {
  name: string;
  color: string;
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

interface FullTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  createdAt: string;
  completedAt?: string | null;
  tags: Tag[];
  subtasks: Subtask[];
  estimatedHours?: number;
  position: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const TAG_PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

export default function TaskManager() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  // Selected task for detail view
  const [selectedTask, setSelectedTask] = useState<FullTask | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    estimatedHours: undefined,
    tags: [],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  // New subtask input
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // New tag input
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.task.list({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setTasks(result.tasks as unknown as TaskSummary[]);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  const loadTaskDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const result = await api.task.get({ id });
      setSelectedTask(result as unknown as FullTask);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleCreateTask = async () => {
    setFormErrors({});
    setCreating(true);

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      errors.title = 'Title must be at most 200 characters';
    }
    if (formData.description && formData.description.length > 2000) {
      errors.description = 'Description must be at most 2000 characters';
    }
    if (formData.estimatedHours !== undefined) {
      if (formData.estimatedHours <= 0) {
        errors.estimatedHours = 'Estimated hours must be positive';
      } else if (formData.estimatedHours > 100) {
        errors.estimatedHours = 'Estimated hours must be at most 100';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setCreating(false);
      return;
    }

    try {
      await api.task.create({
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        priority: formData.priority,
        dueDate: formData.dueDate || undefined,
        estimatedHours: formData.estimatedHours || undefined,
        tags: formData.tags,
      });

      // Reset form and reload
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        estimatedHours: undefined,
        tags: [],
      });
      setShowCreateForm(false);
      loadTasks();
    } catch (err) {
      // Parse server validation errors if available
      const message = err instanceof Error ? err.message : 'Failed to create task';
      if (message.includes('validation')) {
        setFormErrors({ submit: message });
      } else {
        setError(message);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: FullTask['status']) => {
    try {
      await api.task.update({ id, status });
      loadTasks();
      if (selectedTask?.id === id) {
        loadTaskDetail(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.task.delete({ id });
      if (selectedTask?.id === id) {
        setSelectedTask(null);
      }
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const handleAddSubtask = async () => {
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    try {
      await api.subtask.add({
        taskId: selectedTask.id,
        title: newSubtaskTitle.trim(),
      });
      setNewSubtaskTitle('');
      loadTaskDetail(selectedTask.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subtask');
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!selectedTask) return;
    try {
      await api.subtask.toggle({
        taskId: selectedTask.id,
        subtaskId,
      });
      loadTaskDetail(selectedTask.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!selectedTask) return;
    try {
      await api.subtask.delete({
        taskId: selectedTask.id,
        subtaskId,
      });
      loadTaskDetail(selectedTask.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subtask');
    }
  };

  const handleAddTag = async () => {
    if (!selectedTask || !newTagName.trim()) return;
    // Validate tag name pattern
    if (!/^[a-z0-9-]+$/.test(newTagName)) {
      setError('Tag name must only contain lowercase letters, numbers, and hyphens');
      return;
    }
    if (selectedTask.tags && selectedTask.tags.length >= 5) {
      setError('Maximum 5 tags allowed per task');
      return;
    }
    try {
      await api.tag.add({
        taskId: selectedTask.id,
        name: newTagName.trim(),
        color: newTagColor,
      });
      setNewTagName('');
      loadTaskDetail(selectedTask.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!selectedTask) return;
    try {
      await api.tag.remove({
        taskId: selectedTask.id,
        tagName,
      });
      loadTaskDetail(selectedTask.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove tag');
    }
  };

  const addTagToForm = () => {
    if (!newTagName.trim()) return;
    if (!/^[a-z0-9-]+$/.test(newTagName)) {
      setFormErrors({ ...formErrors, tag: 'Tag name must only contain lowercase letters, numbers, and hyphens' });
      return;
    }
    if ((formData.tags?.length || 0) >= 5) {
      setFormErrors({ ...formErrors, tag: 'Maximum 5 tags allowed' });
      return;
    }
    setFormData({
      ...formData,
      tags: [...(formData.tags || []), { name: newTagName.trim(), color: newTagColor }],
    });
    setNewTagName('');
    setFormErrors({ ...formErrors, tag: '' });
  };

  const removeTagFromForm = (tagName: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((t: unknown) => (t as Tag).name !== tagName) || [],
    });
  };

  // Initial load
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Task Manager</h1>
            <p className="text-sm text-gray-500">
              Powered by xRPC with comprehensive validation
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Task
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              &times;
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task List Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Priority</label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="">All</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <button
                  onClick={loadTasks}
                  disabled={loading}
                  className="ml-auto px-4 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Task List */}
            <div className="bg-white rounded-lg shadow-sm border divide-y">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {loading ? 'Loading tasks...' : 'No tasks found. Create one to get started!'}
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => loadTaskDetail(task.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedTask?.id === task.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium truncate ${
                            task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'
                          }`}>
                            {task.title}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                            {task.priority}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                          {task.dueDate && (
                            <span className={`text-gray-500 ${
                              new Date(task.dueDate) < new Date() && task.status !== 'completed'
                                ? 'text-red-500 font-medium'
                                : ''
                            }`}>
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {task.subtaskCount > 0 && (
                            <span className="text-gray-500">
                              Subtasks: {task.subtaskCompletedCount}/{task.subtaskCount}
                            </span>
                          )}
                          {task.tagCount > 0 && (
                            <span className="text-gray-500">
                              {task.tagCount} tag{task.tagCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="text-sm text-gray-500 text-right">
              Showing {tasks.length} of {total} tasks
            </div>
          </div>

          {/* Task Detail Panel */}
          <div className="space-y-4">
            {selectedTask ? (
              <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
                {detailLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">{selectedTask.title}</h2>
                      <button
                        onClick={() => setSelectedTask(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        &times;
                      </button>
                    </div>

                    {selectedTask.description && (
                      <p className="text-gray-600 text-sm">{selectedTask.description}</p>
                    )}

                    {/* Status & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <select
                          value={selectedTask.status}
                          onChange={(e) => handleUpdateStatus(selectedTask.id, e.target.value as FullTask['status'])}
                          className="w-full border rounded-lg px-3 py-1.5 text-sm"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Priority</label>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${PRIORITY_COLORS[selectedTask.priority]}`}>
                          {selectedTask.priority}
                        </span>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Created: {new Date(selectedTask.createdAt).toLocaleString()}</div>
                      {selectedTask.dueDate && (
                        <div>Due: {new Date(selectedTask.dueDate).toLocaleDateString()}</div>
                      )}
                      {selectedTask.estimatedHours && (
                        <div>Estimated: {selectedTask.estimatedHours}h</div>
                      )}
                      {selectedTask.completedAt && (
                        <div>Completed: {new Date(selectedTask.completedAt).toLocaleString()}</div>
                      )}
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Tags ({selectedTask.tags?.length || 0}/5)</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedTask.tags?.map((tag) => (
                          <span
                            key={tag.name}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
                            <button
                              onClick={() => handleRemoveTag(tag.name)}
                              className="hover:opacity-70"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                      {(selectedTask.tags?.length || 0) < 5 && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value.toLowerCase())}
                            placeholder="tag-name"
                            className="flex-1 border rounded px-2 py-1 text-xs"
                          />
                          <input
                            type="color"
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            className="w-8 h-6 rounded cursor-pointer"
                          />
                          <button
                            onClick={handleAddTag}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Subtasks */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">
                        Subtasks ({selectedTask.subtasks?.filter(s => s.completed).length || 0}/{selectedTask.subtasks?.length || 0})
                      </label>
                      <div className="space-y-1 mb-2">
                        {selectedTask.subtasks?.map((subtask) => (
                          <div key={subtask.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={subtask.completed}
                              onChange={() => handleToggleSubtask(subtask.id)}
                              className="rounded"
                            />
                            <span className={subtask.completed ? 'line-through text-gray-400' : ''}>
                              {subtask.title}
                            </span>
                            <button
                              onClick={() => handleDeleteSubtask(subtask.id)}
                              className="ml-auto text-gray-400 hover:text-red-500 text-xs"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                      {(selectedTask.subtasks?.length || 0) < 20 && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            placeholder="Add subtask..."
                            className="flex-1 border rounded px-2 py-1 text-xs"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                          />
                          <button
                            onClick={handleAddSubtask}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteTask(selectedTask.id)}
                      className="w-full px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm transition-colors"
                    >
                      Delete Task
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
                Select a task to view details
              </div>
            )}

            {/* Validation Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <h3 className="font-medium text-blue-900 mb-2">Validation Demo</h3>
              <ul className="text-blue-800 space-y-1 text-xs">
                <li>Title: 1-200 characters</li>
                <li>Description: max 2000 characters</li>
                <li>Priority: enum (low, medium, high, urgent)</li>
                <li>Status: enum (pending, in_progress, completed, cancelled)</li>
                <li>Tags: max 5, name pattern [a-z0-9-], color #rrggbb</li>
                <li>Subtasks: max 20, title 1-200 chars</li>
                <li>Estimated hours: positive, max 100</li>
                <li>IDs: UUID format</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Create Task Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create New Task</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                &times;
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter task title..."
                  className={`w-full border rounded-lg px-3 py-2 ${formErrors.title ? 'border-red-500' : ''}`}
                  maxLength={200}
                />
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-red-500">{formErrors.title}</span>
                  <span className="text-gray-400">{formData.title.length}/200</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                  className={`w-full border rounded-lg px-3 py-2 h-24 resize-none ${formErrors.description ? 'border-red-500' : ''}`}
                  maxLength={2000}
                />
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-red-500">{formErrors.description}</span>
                  <span className="text-gray-400">{(formData.description || '').length}/2000</span>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskFormData['priority'] })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.dueDate || ''}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              {/* Estimated Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Hours
                </label>
                <input
                  type="number"
                  value={formData.estimatedHours || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    estimatedHours: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  placeholder="1-100"
                  min="0.1"
                  max="100"
                  step="0.5"
                  className={`w-full border rounded-lg px-3 py-2 ${formErrors.estimatedHours ? 'border-red-500' : ''}`}
                />
                {formErrors.estimatedHours && (
                  <span className="text-red-500 text-xs">{formErrors.estimatedHours}</span>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags ({formData.tags?.length || 0}/5)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags?.map((tag: unknown) => {
                    const t = tag as Tag;
                    return (
                      <span
                        key={t.name}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.name}
                        <button
                          type="button"
                          onClick={() => removeTagFromForm(t.name)}
                          className="hover:opacity-70"
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
                {(formData.tags?.length || 0) < 5 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value.toLowerCase())}
                      placeholder="tag-name (a-z, 0-9, -)"
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    />
                    <div className="flex gap-1">
                      {TAG_PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewTagColor(color)}
                          className={`w-6 h-6 rounded ${newTagColor === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addTagToForm}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                    >
                      Add
                    </button>
                  </div>
                )}
                {formErrors.tag && (
                  <span className="text-red-500 text-xs">{formErrors.tag}</span>
                )}
              </div>

              {/* Submit error */}
              {formErrors.submit && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {formErrors.submit}
                </div>
              )}
            </div>

            <div className="p-4 border-t flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={creating || !formData.title.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
