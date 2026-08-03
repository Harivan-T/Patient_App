// Shared status pill — consolidates the statusPillClass / STATUS_STYLES /
// HC_STATUS_STYLES color maps re-implemented per page.

export type BadgeTone = 'green' | 'red' | 'orange' | 'amber' | 'blue' | 'purple' | 'gray';

const TONES: Record<BadgeTone, string> = {
  green:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  red:    'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  gray:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export function StatusBadge({
  tone = 'gray',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}
