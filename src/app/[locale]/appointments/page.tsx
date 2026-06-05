'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Appointment } from '@/types';

type Tab = 'upcoming' | 'past';

const BRAND = '#6BC9E4';

export default function AppointmentsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('appointments');
  const { locale } = params;

  const [tab, setTab] = useState<Tab>('upcoming');
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [past, setPast] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/appointments')
      .then((r) => r.json())
      .then((data) => {
        setUpcoming(data.upcoming ?? []);
        setPast(data.past ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <AppShell locale={locale} title={t('title')}>
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-6">
          {(['upcoming', 'past'] as Tab[]).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-white dark:bg-slate-800 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
              style={tab === id ? { color: BRAND } : {}}
            >
              {t(id)}
            </button>
          ))}
        </div>

        {loading ? (
          <PageLoader />
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-14 h-14 mx-auto mb-3 opacity-30">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5C3.9 4 3 4.9 3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM7 12h5v5H7z" />
            </svg>
            <p className="text-sm">{t(tab === 'upcoming' ? 'noUpcoming' : 'noPast')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((appt) => (
              <AppointmentCard key={appt.id} appt={appt} t={t} />
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
}: {
  appt: Appointment;
  t: ReturnType<typeof useTranslations<'appointments'>>;
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
            {t('doctor')}: {appt.doctorName}
          </p>
          {appt.hospitalName && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{appt.hospitalName}</p>
          )}
          {appt.department && (
            <p className="text-xs text-gray-500 mt-0.5">{appt.department}</p>
          )}
        </div>
        <div className="text-end shrink-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(appt.date)}</p>
          <p className="text-sm font-medium mt-0.5" style={{ color: BRAND }}>{appt.time}</p>
        </div>
      </div>
      {appt.notes && (
        <p className="mt-3 text-xs text-gray-500 border-t border-gray-100 dark:border-slate-700 pt-3">
          {appt.notes}
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
