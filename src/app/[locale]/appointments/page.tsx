'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Appointment } from '@/types';

type Tab = 'upcoming' | 'past';

const BRAND = 'var(--color-primary)';

export default function AppointmentsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('appointments');
  const { locale } = params;

  const [tab, setTab]         = useState<Tab>('upcoming');
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [past, setPast]       = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [txMap, setTxMap]     = useState<Record<string, string>>({});
  const [search, setSearch]   = useState('');

  useEffect(() => {
    fetch('/api/appointments')
      .then((r) => r.json())
      .then((data) => {
        setUpcoming(data.upcoming ?? []);
        setPast(data.past ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!['ar', 'ku'].includes(locale)) return;
    const all = [...upcoming, ...past];
    if (!all.length) return;
    const texts = Array.from(new Set(
      all.flatMap((a) => [a.doctorName, a.hospitalName, a.department, a.notes].filter(Boolean) as string[])
    ));
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, locale }),
    }).then((r) => r.json()).then((d) => {
      const map: Record<string, string> = {};
      texts.forEach((text, i) => { map[text] = d.translations?.[i] || text; });
      setTxMap(map);
    }).catch(() => {});
  }, [upcoming, past, locale]);

  // Reset search when switching tabs
  useEffect(() => { setSearch(''); }, [tab]);

  function tx(text: string | undefined): string {
    if (!text) return '';
    return txMap[text] || text;
  }

  const list = tab === 'upcoming' ? upcoming : past;

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a: Appointment) => {
      const doctorOrig       = (a.doctorName ?? '').toLowerCase();
      const doctorTranslated = tx(a.doctorName).toLowerCase();
      const dateFormatted    = formatDate(a.date).toLowerCase();
      const dateRaw          = (a.date ?? '').toLowerCase();
      return (
        doctorOrig.includes(q) ||
        doctorTranslated.includes(q) ||
        dateFormatted.includes(q) ||
        dateRaw.includes(q)
      );
    });
  // txMap intentionally included so translated names are searchable once loaded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, search, txMap]);

  return (
    <AppShell locale={locale} title={t('title')}>
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-4">
          {(['upcoming', 'past'] as Tab[]).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-[#3B66DD] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t(id)}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 mb-4 focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:border-transparent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" className="w-4 h-4 text-gray-400 shrink-0">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <line x1="15.5" y1="15.5" x2="20" y2="20" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            autoComplete="off" autoCorrect="off" spellCheck={false}
            className="flex-1 py-2.5 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 shrink-0">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          )}
        </div>

        {loading ? (
          <PageLoader />
        ) : filteredList.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-14 h-14 mx-auto mb-3 opacity-30">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5C3.9 4 3 4.9 3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM7 12h5v5H7z" />
            </svg>
            <p className="text-sm">
              {search
                ? t('noResults')
                : t(tab === 'upcoming' ? 'noUpcoming' : 'noPast')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredList.map((appt) => (
              <AppointmentCard key={appt.id} appt={appt} t={t} tx={tx} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function AppointmentCard({
  appt,
  t,
  tx,
}: {
  appt: Appointment;
  t: ReturnType<typeof useTranslations<'appointments'>>;
  tx: (text: string | undefined) => string;
}) {
  const isOperation = appt.type === 'operation';

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {isOperation ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 inline me-1 text-gray-600">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H9v-2h3v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 inline me-1 text-gray-600">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
              {t(appt.type as 'appointment' | 'operation')}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              appt.status === 'upcoming'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : appt.status === 'cancelled'
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {t(`status.${appt.status as 'upcoming' | 'past' | 'cancelled'}`)}
            </span>
          </div>
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {t('doctor')}: {tx(appt.doctorName)}
          </p>
          {appt.hospitalName && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{tx(appt.hospitalName)}</p>
          )}
          {appt.department && (
            <p className="text-xs text-gray-500 mt-0.5">{tx(appt.department)}</p>
          )}
        </div>
        <div className="text-end shrink-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(appt.date)}</p>
          <p className="text-sm font-medium mt-0.5" style={{ color: BRAND }}>{appt.time}</p>
        </div>
      </div>
      {appt.notes && (
        <p className="mt-3 text-xs text-gray-500 border-t border-gray-100 dark:border-slate-700 pt-3">
          {tx(appt.notes)}
        </p>
      )}
    </div>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return dateStr; }
}
