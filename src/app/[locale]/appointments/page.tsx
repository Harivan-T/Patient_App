'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Appointment } from '@/types';

type Tab = 'upcoming' | 'past';


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
        {/* Pinned tab header — sticks to top of main scroll container */}
        <div className="sticky top-0 z-10 bg-background dark:bg-slate-900 pb-4">
          <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-3">
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
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:border-transparent">
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
        </div>{/* end sticky header */}

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

function statusPillClass(status: string): string {
  switch (status) {
    case 'scheduled':  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'completed':
    case 'upcoming':   return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'cancelled':  return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    case 'no-show':    return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    default:           return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

// ── Type icon map ─────────────────────────────────────────────────────────────
// Maps appointment type → { Tailwind circle classes, SVG path }.
// Unknown types always get a neutral fallback — no raw keys ever show.
type IconCfg = { circleCls: string; path: string };

function getTypeIconCfg(rawType: string): IconCfg {
  const t = (rawType ?? '').toLowerCase();

  if (t === 'home_visit' || t === 'home') return {
    circleCls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',                        // house
  };

  if (['video', 'online', 'telehealth', 'virtual', 'telemedicine'].includes(t)) return {
    circleCls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    path: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',  // video camera
  };

  if (t === 'emergency') return {
    circleCls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',        // alert circle
  };

  if (['operation', 'procedure', 'surgery'].includes(t)) return {
    circleCls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    path: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H9v-2h3v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z',  // clipboard
  };

  if (['follow_up', 'follow-up', 'followup'].includes(t)) return {
    circleCls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    path: 'M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',  // calendar
  };

  if (['check_up', 'checkup', 'screening'].includes(t)) return {
    circleCls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    path: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',          // checkmark
  };

  // Default bucket — visiting, consultation, appointment, in-person, and all unknowns
  return {
    circleCls: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    path: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',  // medical cross
  };
}

function TypeIconBadge({ type }: { type: string }) {
  const { circleCls, path } = getTypeIconCfg(type);
  return (
    <span className={`inline-flex shrink-0 w-8 h-8 rounded-full items-center justify-center ${circleCls}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden>
        <path d={path} />
      </svg>
    </span>
  );
}

function formatType(rawType: string, tFn: (key: string) => string): string {
  if (!rawType) return '';
  const result = tFn(rawType);
  // next-intl returns "namespace.key" when a key is missing — detect and fall back
  if (result === `appointments.${rawType}` || result.startsWith('appointments.')) {
    return rawType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return result;
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
  // Cast to bypass next-intl's strict key types — all keys are present in the JSON
  const tStr = t as unknown as (key: string) => string;

  // hospitalName from SQL is COALESCE(s.specialty, a.unit, '') — specialty, not a hospital.
  // Capitalize first letter; lower-case the rest so "CARDIOLOGY" → "Cardiology".
  const specialty = appt.hospitalName
    ? appt.hospitalName.charAt(0).toUpperCase() + appt.hospitalName.slice(1).toLowerCase()
    : '';

  return (
    <div
      className="rounded-xl shadow-sm border p-5 space-y-2 dark:bg-slate-800 dark:border-slate-700"
      style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
    >
      {/* Row 1: Tinted icon circle + type label + status pill */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-heading)' }}>
          <TypeIconBadge type={appt.type} />
          {formatType(appt.type, tStr)}
        </span>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${statusPillClass(appt.status)}`}>
          {tStr(`status.${appt.status}`)}
        </span>
      </div>

      {/* Row 2: Date + Time */}
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
        {formatDate(appt.date)}
        {appt.time ? <span> · {formatTime(appt.time)}</span> : null}
      </p>

      {/* Row 3: Doctor name — hidden when DB has no matching staff row */}
      {appt.doctorName && (
        <p className="font-semibold" style={{ color: 'var(--color-heading)' }}>{tx(appt.doctorName)}</p>
      )}

      {/* Row 4: Specialty — hidden when empty */}
      {specialty && (
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{specialty}</p>
      )}

      {/* Row 5: Reason — from clinicalindication / reasonforrequest / description */}
      {appt.notes && (
        <div className="flex gap-3 border-t pt-2 mt-1" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-xs font-medium shrink-0 pt-px" style={{ color: 'var(--color-muted)' }}>
            {tStr('reason')}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-heading)' }}>
            {tx(appt.notes)}
          </span>
        </div>
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

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  try {
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(Number(h), Number(m), 0, 0);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch { return timeStr; }
}
