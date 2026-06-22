'use client';

import { useTranslations } from 'next-intl';

const VISIT_TYPES = [
  {
    key: 'clinicVisit' as const,
    // Stethoscope / medical cross — matches appointments page "default" bucket
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H9v-2h3v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
      </svg>
    ),
  },
  {
    key: 'homeVisit' as const,
    // House — matches appointments page "home_visit" bucket
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    key: 'videoMeet' as const,
    // Video camera — matches appointments page "video" bucket
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
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
          className="flex flex-col items-center gap-2.5 py-4 px-2 rounded-xl border border-[var(--color-border)] dark:border-slate-600 bg-white dark:bg-slate-700/40 text-xs font-medium transition-all hover:border-[var(--color-primary)] hover:bg-[var(--tibbna-light)] dark:hover:bg-[#0f2a33]"
        >
          <span className="text-[var(--color-primary)]">{icon}</span>
          <span className="text-slate-700 dark:text-slate-200 leading-tight text-center">
            {t(key)}
          </span>
        </button>
      ))}
    </div>
  );
}
