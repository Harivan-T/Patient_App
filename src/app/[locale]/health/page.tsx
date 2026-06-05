'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Diagnosis, Vital, MedicalHistory, CarePlan } from '@/types';

type Tab = 'diagnoses' | 'vitals' | 'history' | 'carePlan';

interface HealthData {
  diagnoses: Diagnosis[];
  vitals: Vital[];
  history: MedicalHistory[];
  carePlan: CarePlan | null;
}

const BRAND = '#6BC9E4';

export default function HealthPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('health');
  const { locale } = params;

  const [tab, setTab] = useState<Tab>('diagnoses');
  const [data, setData] = useState<HealthData>({ diagnoses: [], vitals: [], history: [], carePlan: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const TABS: Tab[] = ['diagnoses', 'vitals', 'history', 'carePlan'];

  return (
    <AppShell locale={locale} title={t('title')}>
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 px-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
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
        ) : (
          <>
            {tab === 'diagnoses' && (
              data.diagnoses.length === 0
                ? <Empty icon={<DiagnosisIcon />} text={t('noDiagnoses')} />
                : (
                  <div className="space-y-3">
                    {data.diagnoses.map((d) => (
                      <div key={d.id} className="card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{d.name}</p>
                            {d.code && <p className="text-xs text-gray-500 mt-0.5">ICD: {d.code}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`badge-${d.status}`}>{t(`status.${d.status}`)}</span>
                            {d.date && <span className="text-xs text-gray-400">{formatDate(d.date)}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
            )}

            {tab === 'vitals' && (
              data.vitals.length === 0
                ? <Empty icon={<VitalsIcon />} text={t('noVitals')} />
                : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.vitals.map((v, i) => (
                      <div key={i} className="card p-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{v.type}</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: BRAND }}>
                          {v.value}{' '}
                          <span className="text-sm font-normal text-gray-500">{v.unit}</span>
                        </p>
                        {v.normalRange && (
                          <p className="text-xs text-gray-400 mt-1">{t('normalRange')}: {v.normalRange}</p>
                        )}
                        {v.date && <p className="text-xs text-gray-400 mt-1">{formatDate(v.date)}</p>}
                      </div>
                    ))}
                  </div>
                )
            )}

            {tab === 'history' && (
              data.history.length === 0
                ? <Empty icon={<HistoryIcon />} text={t('noHistory')} />
                : (
                  <div className="space-y-3">
                    {data.history.map((h) => (
                      <div key={h.id} className="card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{h.event}</p>
                            {h.details && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{h.details}</p>
                            )}
                          </div>
                          {h.date && (
                            <span className="text-xs text-gray-400 shrink-0">{formatDate(h.date)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
            )}

            {tab === 'carePlan' && (
              !data.carePlan
                ? <Empty icon={<CarePlanIcon />} text={t('noCarePlan')} />
                : (
                  <div className="card p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {data.carePlan.title}
                    </h3>
                    {data.carePlan.description && (
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        {data.carePlan.description}
                      </p>
                    )}
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>From: {formatDate(data.carePlan.startDate)}</span>
                      {data.carePlan.endDate && (
                        <span>To: {formatDate(data.carePlan.endDate)}</span>
                      )}
                    </div>
                    {data.carePlan.goals.length > 0 && (
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">{t('goals')}</p>
                        <ul className="space-y-1.5">
                          {data.carePlan.goals.map((g: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5" style={{ color: BRAND }}>
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                              </svg>
                              {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
      <div className="w-14 h-14 mx-auto mb-3 opacity-30">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function DiagnosisIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  );
}

function VitalsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95L6.6 18.4A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
    </svg>
  );
}

function CarePlanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H9v-2h3v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return dateStr; }
}
