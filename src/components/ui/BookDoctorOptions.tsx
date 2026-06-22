'use client';

import { useTranslations } from 'next-intl';

const VISIT_TYPES = [
  {
    key: 'clinicVisit' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <circle cx="6.5" cy="3.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="3.5" r="1" fill="currentColor" stroke="none" />
        <path d="M6.5 4.5v4.5a5.5 5.5 0 0 0 11 0V4.5" />
        <path d="M12 14v4" />
        <circle cx="12" cy="20" r="2" />
      </svg>
    ),
  },
  {
    key: 'homeVisit' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M3 12l9-9 9 9" />
        <path d="M4.5 10.5V20a1 1 0 001 1h4v-5h5v5h4a1 1 0 001-1v-9.5" />
      </svg>
    ),
  },
  {
    key: 'videoMeet' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14" />
        <rect x="3" y="8" width="12" height="8" rx="2" />
      </svg>
    ),
  },
] as const;

export function BookDoctorOptions() {
  const t = useTranslations('booking');

  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {VISIT_TYPES.map(({ key, icon }) => (
        <button
          key={key}
          type="button"
          className="flex flex-col items-center gap-2.5 py-4 px-2 rounded-xl border border-border dark:border-slate-600 bg-white dark:bg-slate-700/40 text-xs font-medium transition-colors hover:border-primary hover:bg-[#E6EFF3] dark:hover:bg-[#0f2a33]"
        >
          <span className="text-primary">{icon}</span>
          <span className="text-slate-700 dark:text-slate-200 leading-tight text-center">{t(key)}</span>
        </button>
      ))}
    </div>
  );
}
