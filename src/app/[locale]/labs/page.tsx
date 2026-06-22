'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { LabOrder, LabTest, LabResultPanel, LabAnalyte } from '@/types';

const BRAND = 'var(--color-primary)';

type Tab = 'orders' | 'results';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  partial:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LabsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('labs');
  const { locale } = params;

  const [tab, setTab]         = useState<Tab>('orders');
  const [orders, setOrders]   = useState<LabOrder[]>([]);
  const [results, setResults] = useState<LabResultPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch]   = useState('');

  const fetchData = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    fetch('/api/labs')
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.orders ?? []);
        setResults(data.results ?? []);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset search when switching tabs
  useEffect(() => { setSearch(''); }, [tab]);

  const filteredOrders = useMemo(() => {
    const active = orders.filter((o: LabOrder) => o.status !== 'completed');
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter((o: LabOrder) =>
      o.doctorName?.toLowerCase().includes(q) ||
      o.hospitalName?.toLowerCase().includes(q) ||
      formatDate(o.orderDate).toLowerCase().includes(q) ||
      o.orderDate?.toLowerCase().includes(q) ||
      o.tests.some((test: LabTest) => test.name?.toLowerCase().includes(q))
    );
  }, [orders, search]);

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return results;
    return results.filter((r: LabResultPanel) =>
      r.panelName?.toLowerCase().includes(q) ||
      r.reportedBy?.toLowerCase().includes(q) ||
      formatDate(r.date).toLowerCase().includes(q) ||
      r.analytes.some((a: LabAnalyte) => a.name?.toLowerCase().includes(q))
    );
  }, [results, search]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function statusLabel(status: string): string {
    if (status === 'completed') return t('status.completed');
    if (status === 'partial')   return t('status.partial');
    return t('status.pending');
  }

  return (
    <AppShell locale={locale} title={t('title')}>
      <div className="max-w-2xl mx-auto">
        {/* Pinned tab header — sticks to top of main scroll container */}
        <div className="sticky top-[var(--inner-nav-top)] z-30 bg-background dark:bg-slate-900 pb-4">

          {/* Orders / Results tab switcher */}
          <div className="seg-toggle mb-3">
            {(['orders', 'results'] as Tab[]).map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  tab === id ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {t(id)}
                {id === 'results' && (() => {
                  const count = results.length + orders.filter((o: LabOrder) => o.completedTests?.length > 0).length;
                  return count > 0 ? (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white"
                      style={{ background: BRAND }}>
                      {count}
                    </span>
                  ) : null;
                })()}
              </button>
            ))}
          </div>

          {/* Search + refresh bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-800 border border-border rounded-lg px-3 focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:border-transparent">
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

            {/* Refresh button */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="shrink-0 p-2.5 rounded-lg border border-border bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}>
                <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>{/* end sticky header */}

        {loading ? (
          <PageLoader />
        ) : tab === 'orders' ? (
          /* ── LAB ORDERS TAB ── */
          filteredOrders.length === 0 ? (
            <Empty icon={<LabIcon />} text={search ? t('noResults') : t('noOrders')} />
          ) : (
            <div className="space-y-3">
              {search && <p className="text-xs text-gray-400 px-1">{filteredOrders.length} {t('resultsFound')}</p>}
              {filteredOrders.map((order: LabOrder) => {
                const isExpanded = expanded.has(order.id);
                return (
                  <div key={order.id} className="card overflow-hidden">
                    <button
                      className="w-full px-5 py-4 flex items-center justify-between gap-4 text-start hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                      onClick={() => toggleExpanded(order.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {formatDate(order.orderDate)}
                          </span>
                          <StatusBadge status={order.status} label={statusLabel(order.status)} />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          {order.doctorName
                            ? <>{order.doctorName}{order.hospitalName && ` · ${order.hospitalName}`}</>
                            : order.hospitalName || null}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {order.tests.length} {t('tests')}
                        </p>
                      </div>
                      <svg viewBox="0 0 24 24" fill="currentColor"
                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-slate-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-slate-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              <th className="px-4 py-2 text-start font-medium">{t('testName')}</th>
                              <th className="px-4 py-2 text-end font-medium">{t('result')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.tests.map((test: LabTest) => (
                              <OrderTestRow key={test.id} test={test} pendingLabel={t('status.pending')} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ── RESULTS TAB ── */
          (() => {
            const limsResultOrders = orders.filter((o: LabOrder) => o.completedTests.length > 0);
            const hasAny = filteredResults.length > 0 || limsResultOrders.length > 0;
            if (!hasAny) {
              return <Empty icon={<ResultIcon />} text={search ? t('noResults') : t('noResultsYet')} />;
            }
            return (
              <div className="space-y-3">
                {/* LIMS orders with completed tests */}
                {limsResultOrders.map((order: LabOrder) => {
                  const isExpanded = expanded.has(`res-${order.id}`);
                  const hasAbnormal = order.completedTests.some((t: LabTest) => t.isAbnormal);
                  return (
                    <div key={`res-${order.id}`} className="card overflow-hidden">
                      <button
                        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-start hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                        onClick={() => toggleExpanded(`res-${order.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {formatDate(order.orderDate)}
                            </span>
                            {hasAbnormal && <span className="badge-abnormal">⚠ {t('abnormal')}</span>}
                            <StatusBadge status={order.status} label={statusLabel(order.status)} />
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                            {order.doctorName
                              ? <>{order.doctorName}{order.hospitalName && ` · ${order.hospitalName}`}</>
                              : order.hospitalName || null}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {order.completedTests.length} {t('tests')}
                          </p>
                        </div>
                        <svg viewBox="0 0 24 24" fill="currentColor"
                          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-gray-100 dark:border-slate-700">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-slate-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                <th className="px-4 py-2 text-start font-medium">{t('testName')}</th>
                                <th className="px-4 py-2 text-end font-medium">{t('result')}</th>
                                <th className="px-4 py-2 text-end font-medium hidden sm:table-cell">{t('normalRange')}</th>
                                <th className="px-4 py-2 text-end font-medium">{t('unit')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.completedTests.map((test: LabTest) => (
                                <OrderTestRow key={test.id} test={test} pendingLabel={t('status.pending')} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* EHRbase result panels */}
                {filteredResults.map((panel: LabResultPanel) => {
                  const isExpanded = expanded.has(panel.id);
                  const hasAbnormal = panel.analytes.some((a: LabAnalyte) => a.isAbnormal);
                  return (
                    <div key={panel.id} className="card overflow-hidden">
                      <button
                        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-start hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                        onClick={() => toggleExpanded(panel.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{panel.panelName}</span>
                            {hasAbnormal && <span className="badge-abnormal">⚠ {t('abnormal')}</span>}
                            <StatusBadge status="completed" label={t('status.completed')} />
                          </div>
                          {panel.reportedBy && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{t('reportedBy')}: {panel.reportedBy}</p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {formatDate(panel.date)} · {panel.analytes.length} {t('tests')}
                          </p>
                        </div>
                        <svg viewBox="0 0 24 24" fill="currentColor"
                          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                        </svg>
                      </button>
                      {isExpanded && panel.analytes.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-slate-700">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-slate-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                <th className="px-4 py-2 text-start font-medium">{t('testName')}</th>
                                <th className="px-4 py-2 text-end font-medium">{t('result')}</th>
                                <th className="px-4 py-2 text-end font-medium hidden sm:table-cell">{t('normalRange')}</th>
                                <th className="px-4 py-2 text-end font-medium">{t('unit')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {panel.analytes.map((analyte: LabAnalyte, i: number) => (
                                <ResultAnalyteRow key={i} analyte={analyte} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    </AppShell>
  );
}

function OrderTestRow({ test, pendingLabel }: { test: LabTest; pendingLabel: string }) {
  return (
    <tr className={`border-t border-gray-100 dark:border-slate-700 ${test.isAbnormal ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {test.isAbnormal && <span className="badge-abnormal text-[10px]">!</span>}
          <div>
            <span className={test.isAbnormal ? 'text-red-700 dark:text-red-400 font-medium' : ''}>{test.name}</span>
            {test.sampleType && (
              <p className="text-[10px] text-gray-400 mt-0.5">{test.sampleType}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-end font-mono">
        {test.result
          ? <span className={test.isAbnormal ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>{test.result}</span>
          : <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{pendingLabel}</span>}
      </td>
      <td className="px-4 py-3 text-end text-gray-500 dark:text-gray-400 hidden sm:table-cell">{test.normalRange || '—'}</td>
      <td className="px-4 py-3 text-end text-gray-500 dark:text-gray-400">{test.unit || '—'}</td>
    </tr>
  );
}

function ResultAnalyteRow({ analyte }: { analyte: LabAnalyte }) {
  const isAbnormal = analyte.isAbnormal;
  const flagLabel = analyte.flag ? ` (${analyte.flag.toUpperCase()})` : '';
  return (
    <tr className={`border-t border-gray-100 dark:border-slate-700 ${isAbnormal ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isAbnormal && <span className="badge-abnormal text-[10px]">!</span>}
          <span className={isAbnormal ? 'text-red-700 dark:text-red-400 font-medium' : ''}>{analyte.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-end font-mono">
        {analyte.value !== undefined
          ? <span className={isAbnormal ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
              {analyte.value}{flagLabel}
            </span>
          : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3 text-end text-gray-500 dark:text-gray-400 hidden sm:table-cell">
        {analyte.referenceRange || '—'}
      </td>
      <td className="px-4 py-3 text-end text-gray-500 dark:text-gray-400">
        {analyte.units || '—'}
      </td>
    </tr>
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

function LabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M19.8 18.4 14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4C3.71 19.06 4.18 20 5 20h14c.82 0 1.29-.94.8-1.6z" />
    </svg>
  );
}

function ResultIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}
