'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const NAV_ITEMS = [
  {
    key: 'dashboard',
    href: '/dashboard',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    key: 'appointments',
    href: '/appointments',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5C3.9 4 3 4.9 3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM7 12h5v5H7z" />
      </svg>
    ),
  },
  {
    key: 'health',
    href: '/health',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    ),
  },
  {
    key: 'medications',
    href: '/medications',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
        <path d="M6.5 10h-2v4h2v-4zm3 0h-2v4h2v-4zm3 0h-2v4h2v-4zm3 0h-2v4h2v-4zM3 18h18v2H3v-2zm0-10h18v2H3V8zM3 4h18v2H3V4z" />
      </svg>
    ),
  },
  {
    key: 'labs',
    href: '/labs',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
        <path d="M19.8 18.4 14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4C3.71 19.06 4.18 20 5 20h14c.82 0 1.29-.94.8-1.6z" />
      </svg>
    ),
  },
  {
    key: 'bodymap',
    href: '/bodymap',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
        <path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-2 5h4a2 2 0 0 1 2 2v5h-2v5h-4v-5H8V9a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
] as const;

export function Navigation({ locale, variant = 'bottom' }: { locale: string; variant?: 'bottom' | 'sidebar' }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname.includes(href);
  }

  if (variant === 'sidebar') {
    return (
      <nav className="flex flex-col p-3 gap-0.5 pt-4">
        {NAV_ITEMS.map(({ key, href, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={key}
              href={`/${locale}${href}`}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-tibbna-light dark:bg-slate-700 text-primary'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/60'
              }`}
            >
              {icon()}
              <span>{t(key)}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      className="mx-3 mb-3 rounded-2xl"
      style={{
        background: 'transparent',
        border: '1.5px solid var(--chrome-border-color)',
        boxShadow: 'var(--chrome-shadow)',
      }}
    >
      <ul className="flex justify-around py-1.5 px-1">
        {NAV_ITEMS.filter(({ key }) => key !== 'bodymap').map(({ key, href, icon }) => {
          const active = isActive(href);
          return (
            <li key={key}>
              <Link
                href={`/${locale}${href}`}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#548194] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
              >
                {icon()}
                <span className="truncate max-w-[4rem]">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
