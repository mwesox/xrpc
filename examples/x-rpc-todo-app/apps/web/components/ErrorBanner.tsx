interface ErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-4">
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex justify-between">
        <span>{error}</span>
        <button onClick={onDismiss} className="text-red-400 hover:text-red-300">
          &times;
        </button>
      </div>
    </div>
  );
}
