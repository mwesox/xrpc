'use client';

import { useState, useRef } from 'react';
import {
  useTodoList,
  useTodoCreate,
  useTodoToggle,
  useTodoDelete,
  type XRpcClientConfig,
} from '@repo/api/generated/react-client/client/client';
import type { TodoListOutput } from '@repo/api/generated/react-client/client/types';

type Todo = TodoListOutput[number];

const config: XRpcClientConfig = {
  baseUrl: '/api',
  validateInputs: true,
  validateOutputs: false,
};

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use generated x-rpc hooks
  const { data: fetchedTodos, loading, error: listError } = useTodoList(config, {});
  const { mutate: createTodo } = useTodoCreate(config);
  const { mutate: toggleTodo } = useTodoToggle(config);
  const { mutate: deleteTodo } = useTodoDelete(config);

  // Sync fetched todos to local state (for optimistic updates)
  if (fetchedTodos && todos.length === 0 && fetchedTodos.length > 0) {
    setTodos(fetchedTodos);
  }

  // Show list error
  if (listError && !error) {
    setError(listError.message);
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const todo = await createTodo({ title: newTitle.trim() });
      setTodos([todo, ...todos]);
      setNewTitle('');
      setError(null);
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create todo');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const updated = await toggleTodo({ id });
      setTodos(todos.map(t => t.id === id ? updated : t));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle todo');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTodo({ id });
      setTodos(todos.filter(t => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete todo');
    }
  };

  const completedCount = todos.filter(t => t.completed).length;

  return (
    <div className="todo-app">
      <header>
        <h1>x-rpc TODO</h1>
        <p className="subtitle">Go + SQLite backend | React + Next.js frontend</p>
      </header>

      <form onSubmit={handleCreate} className="add-form">
        <input
          ref={inputRef}
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="What needs to be done?"
          autoFocus
        />
        <button type="submit" disabled={!newTitle.trim()}>
          Add
        </button>
      </form>

      {error && (
        <div className="error">
          {error}
          <button onClick={() => setError(null)}>x</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : todos.length === 0 ? (
        <div className="empty">No todos yet. Add one above!</div>
      ) : (
        <>
          <ul className="todo-list">
            {todos.map((todo) => (
              <li key={todo.id} className={todo.completed ? 'completed' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => handleToggle(todo.id)}
                  />
                  <span className="title">{todo.title}</span>
                </label>
                <button
                  className="delete"
                  onClick={() => handleDelete(todo.id)}
                  aria-label="Delete"
                >
                  x
                </button>
              </li>
            ))}
          </ul>
          <footer className="stats">
            {completedCount} of {todos.length} completed
          </footer>
        </>
      )}

      <style jsx>{`
        .todo-app {
          max-width: 500px;
          margin: 2rem auto;
          padding: 0 1rem;
          font-family: var(--font-geist-sans), system-ui, sans-serif;
        }

        header {
          text-align: center;
          margin-bottom: 2rem;
        }

        h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .subtitle {
          color: #666;
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .add-form {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .add-form input {
          flex: 1;
          padding: 0.75rem 1rem;
          font-size: 1rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.2s;
        }

        .add-form input:focus {
          border-color: #667eea;
        }

        .add-form button {
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .add-form button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          background: #fee2e2;
          color: #dc2626;
          border-radius: 8px;
          font-size: 0.875rem;
        }

        .error button {
          background: none;
          border: none;
          color: #dc2626;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0 0.25rem;
        }

        .loading,
        .empty {
          text-align: center;
          padding: 2rem;
          color: #666;
        }

        .todo-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .todo-list li {
          display: flex;
          align-items: center;
          padding: 1rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          transition: all 0.2s;
        }

        .todo-list li:hover {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .todo-list li.completed {
          opacity: 0.6;
        }

        .todo-list li.completed .title {
          text-decoration: line-through;
        }

        .todo-list label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
          cursor: pointer;
        }

        .todo-list input[type="checkbox"] {
          width: 1.25rem;
          height: 1.25rem;
          cursor: pointer;
          accent-color: #667eea;
        }

        .title {
          font-size: 1rem;
        }

        .delete {
          background: none;
          border: none;
          color: #999;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0 0.5rem;
          line-height: 1;
          transition: color 0.2s;
        }

        .delete:hover {
          color: #dc2626;
        }

        .stats {
          text-align: center;
          padding: 1rem;
          color: #666;
          font-size: 0.875rem;
        }

        @media (prefers-color-scheme: dark) {
          .subtitle {
            color: #a1a1aa;
          }

          .add-form input {
            background: #18181b;
            border-color: #3f3f46;
            color: white;
          }

          .todo-list li {
            background: #18181b;
            border-color: #3f3f46;
          }

          .loading,
          .empty,
          .stats {
            color: #a1a1aa;
          }

          .delete {
            color: #71717a;
          }
        }
      `}</style>
    </div>
  );
}
