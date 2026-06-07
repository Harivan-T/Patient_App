'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Navigation } from './Navigation';

interface UserInfo {
  firstName: string;
  lastName: string;
  nationalId: string;
}

export function AppShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
  title?: string;
}) {
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data))
      .catch(() => {});
  }, []);

  const fullName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Top header — fixed height h-14 (3.5rem) for sidebar offset math */}
      <header className="sticky top-0 z-40 h-14 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 md:px-8 flex items-center gap-3">
        <Link
          href={`/${locale}/profile`}
          className="flex items-center gap-3 shrink-0 hover:opacity-80 transition-opacity"
        >
          <div className="flex flex-col items-center gap-0">
            <Image src="/tibbna-logo.png" alt="Tibbna" width={32} height={32} className="object-contain" />
            <span className="text-[9px] font-bold text-[#6BC9E4] leading-tight tracking-wide">Tibbna</span>
          </div>
          {fullName && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {fullName}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono tracking-wide">
                {user?.nationalId}
              </span>
            </div>
          )}
        </Link>
      </header>

      {/* Body: sidebar on md+, stacked on mobile */}
      <div className="flex flex-1 min-h-0">

        {/* Sidebar — tablet and desktop only */}
        <aside className="hidden md:flex flex-col w-56 lg:w-64 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-800 border-e border-gray-200 dark:border-slate-700 overflow-y-auto">
          <Navigation locale={locale} variant="sidebar" />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-24 md:pb-8">
          <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <div className="md:hidden">
        <Navigation locale={locale} variant="bottom" />
      </div>
    </div>
  );
}
