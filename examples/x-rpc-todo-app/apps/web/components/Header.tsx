interface HeaderProps {
  onNewTask: () => void;
}

export function Header({ onNewTask }: HeaderProps) {
  return (
    <header className="bg-bg-secondary border-b border-border px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="xRPC" className="h-10 w-auto" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Task Manager</h1>
            <p className="text-xs text-text-secondary">React + Go Example</p>
          </div>
        </div>
        <button
          onClick={onNewTask}
          className="px-4 py-2 bg-gradient-to-r from-accent to-accent-secondary text-bg-primary text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          New Task
        </button>
      </div>
    </header>
  );
}
