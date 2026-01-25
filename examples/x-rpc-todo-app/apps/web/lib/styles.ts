export const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-700/50 text-slate-300',
  medium: 'bg-accent/20 text-accent',
  high: 'bg-amber-500/20 text-amber-400',
  urgent: 'bg-red-500/20 text-red-400',
};

export const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  in_progress: 'bg-accent-secondary/20 text-purple-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};
