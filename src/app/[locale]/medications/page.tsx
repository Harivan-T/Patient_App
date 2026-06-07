'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Medication } from '@/types';

type Tab = 'current' | 'past';

export default function MedicationsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('medications');
  const { locale } = params;

  const [tab, setTab] = useState<Tab>('current');
  const [current, setCurrent] = useState<Medication[]>([]);
  const [past, setPast] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renewalStates, setRenewalStates] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'error'>>({});

  useEffect(() => {
    fetch('/api/medications')
      .then((r) => r.json())
      .then((data) => {
        setCurrent(data.current ?? []);
        setPast(data.past ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Reset search when switching tabs
  useEffect(() => { setSearch(''); }, [tab]);

  const list = tab === 'current' ? current : past;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((med) => {
      const nameMatch = med.name?.toLowerCase().includes(q);
      const genericMatch = med.genericName?.toLowerCase().includes(q);
      const dateMatch = med.startDate?.toLowerCase().includes(q) ||
                        med.endDate?.toLowerCase().includes(q) ||
                        formatDate(med.startDate).toLowerCase().includes(q) ||
                        (med.endDate ? formatDate(med.endDate).toLowerCase().includes(q) : false);
      return nameMatch || genericMatch || dateMatch;
    });
  }, [list, search]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function handleRenewal(medicationId: string) {
    setRenewalStates((s) => ({ ...s, [medicationId]: 'sending' }));
    try {
      const res = await fetch('/api/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicationId }),
      });
      setRenewalStates((s) => ({ ...s, [medicationId]: res.ok ? 'sent' : 'error' }));
    } catch {
      setRenewalStates((s) => ({ ...s, [medicationId]: 'error' }));
    }
  }

  return (
    <AppShell locale={locale} title={t('title')}>
      <div className="max-w-2xl mx-auto">
        {/* Current / Past tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-4">
          {(['current', 'past'] as Tab[]).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-white dark:bg-slate-800 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
              style={tab === id ? { color: '#6BC9E4' } : {}}
            >
              {t(id)}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 mb-4 focus-within:ring-2 focus-within:ring-[#6BC9E4] focus-within:border-transparent">
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
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 py-2.5 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-gray-400 hover:text-gray-600 shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-30">
              <path d="M6.5 10h-2v4h2v-4zm3 0h-2v4h2v-4zm3 0h-2v4h2v-4zm3 0h-2v4h2v-4zM3 18h18v2H3v-2zm0-10h18v2H3V8zM3 4h18v2H3V4z" />
            </svg>
            <p className="text-sm">
              {search ? t('noResults') : t(tab === 'current' ? 'noCurrent' : 'noPast')}
            </p>
            {search && (
              <p className="text-xs text-gray-400 mt-1">
                &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {search && (
              <p className="text-xs text-gray-400 px-1">
                {filtered.length} {filtered.length === 1 ? t('resultSingular') : t('resultPlural')}
              </p>
            )}
            {filtered.map((med) => {
              const state = renewalStates[med.id] ?? 'idle';
              const isOpen = expanded.has(med.id);
              return (
                <div key={med.id} className="card overflow-hidden">
                  {/* Always-visible header row */}
                  <button
                    className="w-full px-5 py-4 flex items-center justify-between gap-4 text-start hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={() => toggleExpanded(med.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {highlightMatch(med.name, search)}
                      </p>
                      {med.genericName && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {highlightMatch(med.genericName, search)}
                        </p>
                      )}
                      {med.dosage && (
                        <span className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-[#EDF8FC] text-[#6BC9E4]">
                          {med.dosage}
                        </span>
                      )}
                    </div>
                    <svg
                      viewBox="0 0 24 24" fill="currentColor"
                      className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    >
                      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                    </svg>
                  </button>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="border-t border-gray-100 dark:border-slate-700">
                      <div className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {med.prescribingDoctor && (
                          <>
                            <span className="text-xs text-gray-400 self-center">{t('prescribedBy')}</span>
                            <span className="text-gray-700 dark:text-gray-300">{med.prescribingDoctor}</span>
                          </>
                        )}
                        {med.startDate && (
                          <>
                            <span className="text-xs text-gray-400 self-center">{t('startDate')}</span>
                            <span className="text-gray-700 dark:text-gray-300">{formatDate(med.startDate)}</span>
                          </>
                        )}
                        {med.endDate && (
                          <>
                            <span className="text-xs text-gray-400 self-center">{t('endDate')}</span>
                            <span className="text-gray-700 dark:text-gray-300">{formatDate(med.endDate)}</span>
                          </>
                        )}
                        {med.frequency && (
                          <>
                            <span className="text-xs text-gray-400 self-center">{t('frequency')}</span>
                            <span className="text-gray-700 dark:text-gray-300">{med.frequency}</span>
                          </>
                        )}
                      </div>

                      {med.instructions && (
                        <div className="px-5 pb-4 border-t border-gray-100 dark:border-slate-700 pt-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('instructions')}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{med.instructions}</p>
                        </div>
                      )}

                      {med.status === 'current' && med.refillable && (
                        <div className="px-5 pb-4 pt-1">
                          {state === 'sent' ? (
                            <p className="text-sm text-green-600 dark:text-green-400">✓ {t('renewalSent')}</p>
                          ) : state === 'error' ? (
                            <p className="text-sm text-red-500">{t('renewalError')}</p>
                          ) : (
                            <button
                              onClick={() => handleRenewal(med.id)}
                              disabled={state === 'sending'}
                              className="btn-secondary text-sm py-2"
                            >
                              {state === 'sending' ? '...' : t('requestRenewal')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return dateStr; }
}

function highlightMatch(text: string | undefined, query: string) {
  if (!text || !query.trim()) return text ?? '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 dark:bg-yellow-900/40 text-inherit rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
