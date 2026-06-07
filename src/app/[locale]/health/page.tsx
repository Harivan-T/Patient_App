'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Diagnosis, Vital, CarePlan } from '@/types';

type Tab = 'diagnoses' | 'vitals' | 'carePlan';

interface HealthData {
  diagnoses: Diagnosis[];
  vitals: Vital[];
  carePlan: CarePlan | null;
}

const BRAND = '#6BC9E4';

export default function HealthPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('health');
  const { locale } = params;

  const [tab, setTab] = useState<Tab>('diagnoses');
  const [data, setData] = useState<HealthData>({ diagnoses: [], vitals: [], carePlan: null });
  const [loading, setLoading] = useState(true);
  const [diagSearch, setDiagSearch] = useState('');
  const [carePlanExpanded, setCarePlanExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const TABS: Tab[] = ['diagnoses', 'vitals', 'carePlan'];

  const filteredDiagnoses = useMemo(() => {
    const q = diagSearch.trim().toLowerCase();
    if (!q) return data.diagnoses;
    return data.diagnoses.filter((d) =>
      d.name?.toLowerCase().includes(q) ||
      d.doctor?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q) ||
      d.bodySite?.toLowerCase().includes(q) ||
      formatDate(d.recordedAt ?? '').toLowerCase().includes(q) ||
      formatDate(d.date).toLowerCase().includes(q)
    );
  }, [data.diagnoses, diagSearch]);

  return (
    <AppShell locale={locale} title={t('title')}>
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-4 overflow-x-auto">
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

        {/* Search bar — diagnoses tab only */}
        {tab === 'diagnoses' && (
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 mb-4 focus-within:ring-2 focus-within:border-transparent" style={{ '--tw-ring-color': BRAND } as React.CSSProperties}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4 text-gray-400 shrink-0">
              <circle cx="10.5" cy="10.5" r="6.5" /><line x1="15.5" y1="15.5" x2="20" y2="20" />
            </svg>
            <input
              type="text"
              value={diagSearch}
              onChange={(e) => setDiagSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 py-2.5 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
            />
            {diagSearch && (
              <button onClick={() => setDiagSearch('')} className="text-gray-400 hover:text-gray-600 shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            )}
          </div>
        )}

        {loading ? (
          <PageLoader />
        ) : (
          <>
            {tab === 'diagnoses' && (
              filteredDiagnoses.length === 0
                ? (
                  <div className="text-center py-16 text-gray-400">
                    {diagSearch
                      ? <p className="text-sm">{t('noResults')}</p>
                      : <Empty icon={<DiagnosisIcon />} text={t('noDiagnoses')} />
                    }
                  </div>
                )
                : (
                  <div className="space-y-3">
                    {diagSearch && (
                      <p className="text-xs text-gray-400 px-1">{filteredDiagnoses.length} {t('results')}</p>
                    )}
                    {filteredDiagnoses.map((d) => (
                      <div key={d.id} className="card p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{d.name}</p>
                            {d.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                                {d.description}
                              </p>
                            )}
                          </div>
                          <span className={`badge-${d.status} shrink-0`}>{t(`status.${d.status}`)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-2 border-t border-gray-100 dark:border-slate-700">
                          {d.recordedAt && (
                            <>
                              <span className="text-gray-400">{t('dateRecorded')}</span>
                              <span className="text-gray-700 dark:text-gray-300">{formatDate(d.recordedAt)}</span>
                            </>
                          )}
                          {d.date && (
                            <>
                              <span className="text-gray-400">{t('onset')}</span>
                              <span className="text-gray-700 dark:text-gray-300">{formatDate(d.date)}</span>
                            </>
                          )}
                          {d.bodySite && (
                            <>
                              <span className="text-gray-400">{t('bodySite')}</span>
                              <span className="text-gray-700 dark:text-gray-300">{d.bodySite}</span>
                            </>
                          )}
                          {d.code && (
                            <>
                              <span className="text-gray-400">{t('icdCode')}</span>
                              <span className="text-gray-700 dark:text-gray-300">{d.code}</span>
                            </>
                          )}
                          {d.doctor && (
                            <>
                              <span className="text-gray-400">{t('doctor')}</span>
                              <span className="text-gray-700 dark:text-gray-300">{d.doctor}</span>
                            </>
                          )}
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

            {tab === 'carePlan' && (
              !data.carePlan
                ? <Empty icon={<CarePlanIcon />} text={t('noCarePlan')} />
                : (
                  <div className="card overflow-hidden">
                    {/* Always-visible summary row */}
                    <button
                      className="w-full px-5 py-4 flex items-center justify-between gap-4 text-start hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                      onClick={() => setCarePlanExpanded((v) => !v)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{data.carePlan.title}</p>
                        {data.carePlan.doctor && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('createdBy')} {data.carePlan.doctor}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{t('start')}: <span className="text-gray-700 dark:text-gray-300 font-medium">{formatDate(data.carePlan.startDate)}</span></span>
                          {data.carePlan.endDate && (
                            <span>{t('expires')}: <span className="text-gray-700 dark:text-gray-300 font-medium">{formatDate(data.carePlan.endDate)}</span></span>
                          )}
                        </div>
                      </div>
                      <svg
                        viewBox="0 0 24 24" fill="currentColor"
                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${carePlanExpanded ? 'rotate-180' : ''}`}
                      >
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                      </svg>
                    </button>

                    {/* Expanded details */}
                    {carePlanExpanded && (
                      <div className="border-t border-gray-100 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
                        {data.carePlan.description && (
                          <div className="px-5 py-4">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('carePlanDescription')}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.carePlan.description}</p>
                          </div>
                        )}
                        {data.carePlan.reason && (
                          <div className="px-5 py-4">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('carePlanReason')}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.carePlan.reason}</p>
                          </div>
                        )}
                        {data.carePlan.schedule && (
                          <div className="px-5 py-4">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('carePlanSchedule')}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.carePlan.schedule}</p>
                          </div>
                        )}
                        {data.carePlan.comment && (
                          <div className="px-5 py-4 border-s-4" style={{ borderColor: BRAND }}>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('doctorNotes')}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.carePlan.comment}</p>
                          </div>
                        )}
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
