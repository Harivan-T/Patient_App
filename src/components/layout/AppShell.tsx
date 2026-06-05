import Link from 'next/link';
import Image from 'next/image';
import { Navigation } from './Navigation';

export function AppShell({
  children,
  locale,
  title,
}: {
  children: React.ReactNode;
  locale: string;
  title: string;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-2 flex items-center gap-4">
        {/* Logo + name stacked, links to profile */}
        <Link
          href={`/${locale}/profile`}
          className="flex flex-col items-center gap-0 shrink-0 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/tibbna-logo.png"
            alt="Tibbna"
            width={36}
            height={36}
            className="object-contain"
          />
          <span className="text-xs font-bold text-[#6BC9E4] leading-tight tracking-wide">
            Tibbna
          </span>
        </Link>

        {/* Divider + page title */}
        <div className="flex-1 border-s border-gray-200 dark:border-slate-600 ps-4">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {title}
          </h1>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-auto pb-24">
        <div className="p-4 max-w-2xl mx-auto">
          {children}
        </div>
      </main>

      <Navigation locale={locale} />
    </div>
  );
}
