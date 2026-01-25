import { PRIORITY_STYLES, STATUS_STYLES } from '../lib/styles';

interface BadgeProps {
  type: 'priority' | 'status';
  value: string;
}

export function Badge({ type, value }: BadgeProps) {
  const styles = type === 'priority' ? PRIORITY_STYLES : STATUS_STYLES;
  const displayValue = value.replace('_', ' ');

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[value] || ''}`}>
      {displayValue}
    </span>
  );
}
