'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Patient } from '@/types';

type Tab = 'info' | 'settings' | 'help';
type Theme = 'light' | 'dark' | 'system';

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'ku', label: 'کوردی' },
];

function formatDOB(dob?: string | null): string {
  if (!dob) return '—';
  // Return only YYYY-MM-DD
  const d = new Date(dob);
  if (isNaN(d.getTime())) return dob.split('T')[0] ?? dob;
  return d.toISOString().split('T')[0];
}

export default function ProfilePage({ params }: { params: { locale: string } }) {
  const t = useTranslations('profile');
  const { locale } = params;
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('info');
  const [patient, setPatient] = useState<Partial<Patient> | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>('system');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => setPatient(data))
      .catch(() => setPatient(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('hp-theme') as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  function applyTheme(th: Theme) {
    setTheme(th);
    localStorage.setItem('hp-theme', th);
    const root = document.documentElement;
    if (th === 'dark') root.classList.add('dark');
    else if (th === 'light') root.classList.remove('dark');
    else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  }

  function switchLocale(newLocale: string) {
    window.location.href = window.location.href.replace(`/${locale}/`, `/${newLocale}/`);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try { sessionStorage.removeItem('hp-me'); } catch { /* ignore */ }
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace(`/${locale}/login`);
  }

  return (
    <AppShell locale={locale} title={t('title')}>
      <div className="max-w-2xl mx-auto">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-6">
          {(['info', 'settings', 'help'] as Tab[]).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
              
            >
              {t(id)}
            </button>
          ))}
        </div>

        {/* Info tab */}
        {tab === 'info' && (
          <>
            {loading ? (
              <PageLoader />
            ) : (
              <div className="card p-6 space-y-4">
                <Row label={t('patientId')} value={patient?.patientId} />
                <Row label={t('name')} value={`${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim()} />
                <Row label={t('dob')} value={formatDOB(patient?.dateOfBirth)} />
                <Row label={t('gender')} value={patient?.gender} />
                <Row label={t('phone')} value="••••••••••" />
                <Row label={t('address')} value={patient?.address} />
                <Row label={t('bloodType')} value={patient?.bloodType} />
                <Row
                  label={t('allergies')}
                  value={
                    patient?.allergies && patient.allergies.length > 0
                      ? patient.allergies.join(', ')
                      : t('none')
                  }
                />
              </div>
            )}
          </>
        )}

        {/* Settings tab */}
        {tab === 'settings' && (
          <div className="card p-6 space-y-8">
            <div>
              <h3 className="font-semibold mb-3">{t('theme')}</h3>
              <div className="flex gap-2">
                {(['light', 'dark', 'system'] as Theme[]).map((th) => (
                  <button
                    key={th}
                    onClick={() => applyTheme(th)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      theme === th
                        ? 'border-[var(--color-primary)] bg-[var(--tibbna-light)] dark:bg-[#0f2a33] text-[var(--color-primary)]'
                        : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {t(`theme${th.charAt(0).toUpperCase() + th.slice(1)}` as 'themeLight')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">{t('language')}</h3>
              <div className="space-y-2">
                {LOCALES.map(({ code, label }) => (
                  <button
                    key={code}
                    onClick={() => switchLocale(code)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                      locale === code
                        ? 'border-[var(--color-primary)] bg-[var(--tibbna-light)] dark:bg-[#0f2a33] text-[var(--color-primary)]'
                        : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span>{label}</span>
                    {locale === code && (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Logout */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full btn-danger"
              >
                {loggingOut ? t('loggingOut') : t('logout')}
              </button>
            </div>
          </div>
        )}

        {/* Help tab */}
        {tab === 'help' && (
          <div className="card p-6">
            <h3 className="font-semibold text-lg mb-3">{t('helpTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{t('helpContent')}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 sm:w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100">{value || '—'}</span>
    </div>
  );
}
