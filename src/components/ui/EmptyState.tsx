// Shared empty state — replaces the per-page Empty/EmptyState blocks.
export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="text-center py-16 text-gray-400 dark:text-gray-500 animate-fade-up">
      {icon && <div className="w-14 h-14 mx-auto mb-3 opacity-30 [&>svg]:w-full [&>svg]:h-full">{icon}</div>}
      <p className="text-sm">{title}</p>
      {subtitle && <p className="text-xs mt-1 opacity-75">{subtitle}</p>}
    </div>
  );
}
