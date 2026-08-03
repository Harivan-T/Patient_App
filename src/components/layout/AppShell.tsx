'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Navigation } from './Navigation';
import { isRTL } from '@/i18n/config';

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
  const [user, setUser]           = useState<UserInfo | null>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    // Name/ID basically never change — cache per browser session so every page
    // navigation doesn't re-hit /api/me.
    try {
      const cached = sessionStorage.getItem('hp-me');
      if (cached) {
        setUser(JSON.parse(cached));
        return;
      }
    } catch { /* sessionStorage unavailable */ }
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setUser(data);
        if (data) {
          try { sessionStorage.setItem('hp-me', JSON.stringify(data)); } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function refresh() {
      fetch('/api/cart')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setCartCount(d.totalItems ?? 0); })
        .catch(() => {});
    }
    refresh();
    window.addEventListener('cart-updated', refresh);
    return () => window.removeEventListener('cart-updated', refresh);
  }, []);

  // Guard against bfcache restoring an authenticated page after logout.
  // The `pageshow` event fires on bfcache restores (e.persisted === true) without
  // hitting the server, so middleware never runs. We re-check the session here and
  // redirect if the cookie is gone.
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (!e.persisted) return;
      fetch('/api/auth/session')
        .then((r) => { if (!r.ok) window.location.replace(`/${locale}/login`); })
        .catch(() => { window.location.replace(`/${locale}/login`); });
    }
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [locale]);

  const fullName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top header — fixed height, stays at top as a shrink-0 flex child */}
      <header dir="ltr" className="shrink-0 z-40 mx-3 mt-3 rounded-2xl h-12 px-4 flex items-center gap-3" style={{ background: 'var(--color-primary)', border: '1.5px solid var(--chrome-border-color)', boxShadow: 'var(--chrome-shadow)' }}>
        <Link href={`/${locale}/dashboard`} className="flex items-center gap-3 shrink-0 cursor-pointer">
          <Image src="/tibbna-logo.png" alt="Tibbna" width={36} height={36} className="object-contain" />
          {fullName && (
            <span className="text-sm font-semibold text-white whitespace-nowrap">{fullName}</span>
          )}
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {/* Cart icon with item count badge */}
          <Link
            href={`/${locale}/basket`}
            className="relative shrink-0 p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors"
            aria-label="Cart"
          >
            {/* Shopping cart outline */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-amber-400 text-slate-900 text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {/* Settings */}
          <Link
            href={`/${locale}/settings`}
            className="shrink-0 p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors"
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.01 7.01 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Body: sidebar on md+, stacked on mobile. dir="ltr" keeps sidebar on left in all locales. */}
      <div dir="ltr" className="flex flex-1 min-h-0">

        {/* Sidebar — tablet and desktop only */}
        <aside className="hidden md:flex flex-col w-56 lg:w-64 shrink-0 bg-surface border-e border-border overflow-y-auto">
          <Link href={`/${locale}/dashboard`} className="flex flex-col items-center gap-2 px-4 py-5 border-b border-border cursor-pointer w-full">
            <Image src="/tibbna-logo.png" alt="Tibbna" width={48} height={48} className="object-contain" />
            {fullName && (
              <span className="text-sm font-semibold text-[var(--color-heading)] text-center leading-tight">
                {fullName}
              </span>
            )}
          </Link>
          <Navigation locale={locale} variant="sidebar" />
        </aside>

        {/* Main content — RTL text direction for Arabic/Kurdish */}
        <main dir={isRTL(locale) ? 'rtl' : 'ltr'} className="flex-1 overflow-y-auto">
          {/* pb-24 leaves room for the fixed bottom nav on mobile */}
          <div className="px-4 pt-4 pb-24 md:p-6 lg:p-8 max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav — fixed over scroll content so transparency + blur actually show */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30">
        <Navigation locale={locale} variant="bottom" />
      </div>
    </div>
  );
}
