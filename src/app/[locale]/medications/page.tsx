'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Medication, DispensedMed } from '@/types';

type Tab = 'current' | 'past';

export default function MedicationsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('medications');
  const { locale } = params;

  const [tab, setTab] = useState<Tab>('current');
  const [current, setCurrent] = useState<Medication[]>([]);
  const [dispensed, setDispensed] = useState<DispensedMed[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renewalStates, setRenewalStates] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'error'>>({});

  useEffect(() => {
    fetch('/api/medications')
      .then((r) => r.json())
      .then((data) => {
        setCurrent(data.current ?? []);
        setDispensed(data.dispensed ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Reset search when switching tabs
  useEffect(() => { setSearch(''); }, [tab]);

  const list = current;

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
        {/* Current / Dispensed tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-4">
          {(['current', 'past'] as Tab[]).map((id) => (
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

        {tab === 'past' ? (
          <DispensedSection items={dispensed} loading={loading} />
        ) : (
        <div>
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
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        {med.startDate && (
                          <span className="text-xs text-gray-400">{formatDate(med.startDate)}</span>
                        )}
                        {med.prescribingDoctor && (
                          <span className="text-xs text-gray-400">{med.prescribingDoctor}</span>
                        )}
                      </div>
                    </div>
                    <svg
                      viewBox="0 0 24 24" fill="currentColor"
                      className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    >
                      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                    </svg>
                  </button>

                  {/* Instructions — always visible */}
                  {med.instructions && (
                    <div className="px-5 pb-4 border-t border-gray-100 dark:border-slate-700/60">
                      <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-4 py-3">
                        <p className="text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wide mb-1">{t('instructions')}</p>
                        <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed">{med.instructions}</p>
                      </div>
                    </div>
                  )}

                  {/* Expanded details — per-drug dosage, route, frequency */}
                  {isOpen && (
                    <div className="border-t border-gray-100 dark:border-slate-700">
                      {med.drugs && med.drugs.length > 0 && (
                        <div className="px-5 py-4 divide-y divide-gray-100 dark:divide-slate-700">
                          {med.drugs.map((drug, i) => (
                            <div key={i} className={`text-sm ${i > 0 ? 'pt-3' : ''} ${i < med.drugs!.length - 1 ? 'pb-3' : ''}`}>
                              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1.5">{drug.name}</p>
                              <div className="space-y-0.5">
                                {drug.dosage && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    <span className="text-gray-400 dark:text-gray-500">Dosage: </span>{drug.dosage}
                                  </p>
                                )}
                                {drug.route && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    <span className="text-gray-400 dark:text-gray-500">Route: </span>{drug.route}
                                  </p>
                                )}
                                {drug.frequency && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    <span className="text-gray-400 dark:text-gray-500">Frequency: </span>{drug.frequency}
                                  </p>
                                )}
                                {drug.usage && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    <span className="text-gray-400 dark:text-gray-500">Usage: </span>{drug.usage}
                                  </p>
                                )}
                                {drug.endDate && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    <span className="text-gray-400 dark:text-gray-500">Valid until: </span>{formatDate(drug.endDate)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
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
        )}
      </div>
    </AppShell>
  );
}

function DispensedSection({ items, loading }: { items: DispensedMed[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-24 animate-pulse bg-gray-100 dark:bg-slate-700" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 dark:text-gray-500">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-30">
          <path d="M20 6h-2.18c.07-.44.18-.88.18-1.34C18 2.99 16.98 2 15.66 2c-.88 0-1.62.48-2.05 1.19L12 5.5l-1.61-2.31C9.96 2.48 9.22 2 8.34 2 7.02 2 6 2.99 6 4.66c0 .46.11.9.18 1.34H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
        </svg>
        <p className="text-sm">No dispensed medications on record</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((med) => (
        <div key={med.id} className="card px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                {med.drugName || 'Unknown drug'}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                {med.dosage && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{med.dosage}</span>
                )}
                {med.quantity != null && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Qty: {med.quantity}</span>
                )}
                {med.dispensedAt && (
                  <span className="text-xs text-gray-400">{formatDate(med.dispensedAt)}</span>
                )}
              </div>
              {med.dispensedBy && (
                <p className="text-xs text-gray-400 mt-0.5">By: {med.dispensedBy}</p>
              )}
            </div>
            <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
              med.source === 'Pharmacy'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            }`}>
              {med.source}
            </span>
          </div>
          {med.notes && (
            <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 px-4 py-3">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed">{med.notes}</p>
            </div>
          )}
        </div>
      ))}
    </div>
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
