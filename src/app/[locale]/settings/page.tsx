'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Patient } from '@/types';

type Tab = 'settings' | 'help';
type Theme = 'light' | 'dark' | 'system';

const MASK = '••••••••••';

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'ku', label: 'کوردی' },
];

function formatDOB(dob?: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return dob.split('T')[0] ?? dob;
  return d.toISOString().split('T')[0];
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-3 border-b border-gray-100 dark:border-slate-700 last:border-0">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 sm:w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100">{value || '—'}</span>
    </div>
  );
}

function ContactForm({ fullName }: { fullName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [problem, setProblem] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errors, setErrors] = useState<{ name?: string; contact?: string; problem?: string }>({});

  function openForm() {
    setName(fullName !== '—' ? fullName : '');
    setContact('');
    setProblem('');
    setErrors({});
    setStatus('idle');
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim())    next.name    = 'Required';
    if (!contact.trim()) next.contact = 'Required';
    if (!problem.trim()) next.problem = 'Required';
    if (Object.keys(next).length) { setErrors(next); return; }

    setStatus('sending');
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), problem: problem.trim() }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (!open) {
    return <button onClick={openForm} className="btn-primary w-full">Contact Us</button>;
  }

  if (status === 'sent') {
    return (
      <div className="card p-6 text-center space-y-3">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-green-500 mx-auto">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
        <p className="font-semibold text-gray-900 dark:text-gray-100">Message sent</p>
        <p className="text-sm text-gray-500">We&apos;ll get back to you soon.</p>
        <button onClick={() => setOpen(false)} className="btn-secondary text-sm py-2">Close</button>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Contact Us</h3>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <input type="text" value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
            className="input" placeholder="Your full name" />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone or Email</label>
          <input type="text" value={contact}
            onChange={(e) => { setContact(e.target.value); setErrors((p) => ({ ...p, contact: undefined })); }}
            className="input" placeholder="How we can reach you" />
          {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Problem description</label>
          <textarea value={problem}
            onChange={(e) => { setProblem(e.target.value); setErrors((p) => ({ ...p, problem: undefined })); }}
            rows={4} className="input resize-none" placeholder="Describe your issue…" />
          {errors.problem && <p className="text-xs text-red-500 mt-1">{errors.problem}</p>}
        </div>
        {status === 'error' && <p className="text-sm text-red-500">Something went wrong. Please try again.</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={status === 'sending'} className="btn-primary flex-1">
            {status === 'sending' ? 'Sending…' : 'Send'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function SettingsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('profile');
  const { locale } = params;
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('settings');
  const [patient, setPatient] = useState<Partial<Patient & { phoneNumber: string }> | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [theme, setTheme] = useState<Theme>('system');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => setPatient(data))
      .catch(() => setPatient(null))
      .finally(() => setLoadingPatient(false));
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
    const segments = window.location.pathname.split('/'); // ['', 'en', 'settings', ...]
    segments[1] = newLocale;
    window.location.href = segments.join('/');
  }

  async function handleLogout() {
    setLoggingOut(true);
    try { sessionStorage.removeItem('hp-me'); } catch { /* ignore */ }
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace(`/${locale}/login`);
  }

  const fullName = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || '—';

  return (
    <AppShell locale={locale} title={t('settings')}>
      <div className="max-w-2xl mx-auto">
        {/* Tab bar */}
        <div className="seg-toggle mb-6">
          {(['settings', 'help'] as Tab[]).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {id === 'settings' ? t('settings') : t('help')}
            </button>
          ))}
        </div>

        {tab === 'settings' && (
          <div className="card divide-y divide-gray-100 dark:divide-slate-700">
            {/* Personal Information — collapsible */}
            <div>
              <button
                onClick={() => setInfoOpen((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{t('info')}</span>
                <svg
                  viewBox="0 0 24 24" fill="currentColor"
                  className={`w-4 h-4 text-gray-400 transition-transform ${infoOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                </svg>
              </button>

              {infoOpen && (
                <div className="px-6 pb-5">
                  {loadingPatient ? <PageLoader /> : (
                    <>
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => setRevealed((v) => !v)}
                          className="text-xs font-medium text-primary hover:opacity-75 transition-opacity"
                        >
                          {revealed ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <Row label={t('name')} value={fullName} />
                      <Row label={t('patientId')} value={revealed ? (patient?.patientId ?? '—') : MASK} />
                      <Row label={t('dob')} value={revealed ? formatDOB(patient?.dateOfBirth) : MASK} />
                      <Row label={t('gender')} value={revealed ? (patient?.gender ?? '—') : MASK} />
                      <Row label={t('phone')} value={revealed ? (patient?.phoneNumber ?? '—') : MASK} />
                      <Row label={t('address')} value={revealed ? (patient?.address ?? '—') : MASK} />
                      <Row label={t('bloodType')} value={revealed ? (patient?.bloodType ?? '—') : MASK} />
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Theme */}
            <div className="px-6 py-5">
              <h3 className="font-semibold text-sm mb-3">{t('theme')}</h3>
              <div className="flex gap-2">
                {(['light', 'dark', 'system'] as Theme[]).map((th) => (
                  <button
                    key={th}
                    onClick={() => applyTheme(th)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      theme === th
                        ? 'border-[var(--color-primary)] bg-[var(--tibbna-light)] text-[var(--color-primary)]'
                        : 'border-border text-[var(--color-muted)]'
                    }`}
                  >
                    {t(`theme${th.charAt(0).toUpperCase() + th.slice(1)}` as 'themeLight')}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="px-6 py-5">
              <h3 className="font-semibold text-sm mb-3">{t('language')}</h3>
              <div className="space-y-2">
                {LOCALES.map(({ code, label }) => (
                  <button
                    key={code}
                    onClick={() => switchLocale(code)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                      locale === code
                        ? 'border-[var(--color-primary)] bg-[var(--tibbna-light)] text-[var(--color-primary)]'
                        : 'border-border text-[var(--color-muted)]'
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
            <div className="px-6 py-5">
              <button onClick={handleLogout} disabled={loggingOut} className="w-full btn-danger">
                {loggingOut ? t('loggingOut') : t('logout')}
              </button>
            </div>
          </div>
        )}

        {tab === 'help' && (
          <div className="space-y-4">
            <div className="card p-6 space-y-3">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Contact</h3>
              <div className="flex items-center gap-3 text-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-gray-400 shrink-0">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="22,6 12,13 2,6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <a href="mailto:support@tibbna.com" className="hover:underline" style={{ color: 'var(--color-primary)' }}>
                  support@tibbna.com
                </a>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-gray-400 shrink-0">
                  <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="2" y1="12" x2="22" y2="12" strokeLinecap="round" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <a href="http://tibbna.com/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-primary)' }}>
                  tibbna.com
                </a>
              </div>
            </div>

            <ContactForm fullName={fullName} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
