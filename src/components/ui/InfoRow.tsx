// Shared label/value row — previously duplicated as Row() in profile + settings.
export function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 sm:w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100">{value || '—'}</span>
    </div>
  );
}
