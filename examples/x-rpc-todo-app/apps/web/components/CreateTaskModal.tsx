'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskCreateInputSchema, type TaskCreateInput } from '../xrpc/types';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskCreateInput) => Promise<void>;
  isSubmitting: boolean;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateTaskModalProps) {
  // React Hook Form with xRPC-generated Zod schema for client-side validation
  // Same schema validates on both client (here) and server (Go code)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TaskCreateInput>({
    resolver: zodResolver(taskCreateInputSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
    },
    mode: 'onChange',
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFormSubmit = async (data: TaskCreateInput) => {
    await onSubmit(data);
    reset();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-border flex justify-between items-center">
          <h2 className="font-semibold text-text-primary">New Task</h2>
          <button
            onClick={handleClose}
            className="text-text-secondary hover:text-text-primary"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Title
            </label>
            <input
              type="text"
              {...register('title')}
              className={`w-full bg-bg-elevated border rounded-lg px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none ${
                errors.title
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-border focus:border-accent'
              }`}
              placeholder="What needs to be done?"
              autoFocus
            />
            {errors.title && (
              <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Description
            </label>
            <textarea
              {...register('description')}
              className={`w-full bg-bg-elevated border rounded-lg px-3 py-2 h-20 resize-none text-text-primary placeholder:text-text-secondary focus:outline-none ${
                errors.description
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-border focus:border-accent'
              }`}
              placeholder="Optional details..."
            />
            {errors.description && (
              <p className="text-red-400 text-xs mt-1">
                {errors.description.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Priority
            </label>
            <select
              {...register('priority')}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="pt-4 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-gradient-to-r from-accent to-accent-secondary text-bg-primary rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
