'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { isRTL } from '@/i18n/config';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { LabOrder, LabTest, LabResultPanel, LabAnalyte } from '@/types';

const BRAND = 'var(--color-primary)';

type Tab = 'orders' | 'results' | 'collections';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface HCRequest {
  id:                number;
  labOrderId:        string;
  address:           string;
  preferredDatetime: string;
  phone:             string;
  notes:             string | null;
  status:            'requested' | 'scheduled' | 'completed' | 'cancelled';
  createdAt:         string;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  partial:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const HC_STATUS_STYLES: Record<string, string> = {
  requested: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400',
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  );
}

function HCStatusBadge({ status, label }: { status: string; label: string }) {
  const cls = HC_STATUS_STYLES[status] ?? HC_STATUS_STYLES.requested;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── Home collection form (bottom sheet) ──────────────────────────────────────

interface HomeCollectionFormProps {
  orderId:        string;
  locale:         string;
  prefillAddress: string;
  prefillPhone:   string;
  onClose:        () => void;
  onSuccess:      (orderId: string) => void;
}

function HomeCollectionForm({
  orderId, locale, prefillAddress, prefillPhone, onClose, onSuccess,
}: HomeCollectionFormProps) {
  const t = useTranslations('labs');
  const isRtl = isRTL(locale);

  const [address,    setAddress]    = useState(prefillAddress);
  const [datetime,   setDatetime]   = useState('');
  const [phone,      setPhone]      = useState(prefillPhone);
  const [notes,      setNotes]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim() || !datetime) {
      setError(t('homeCollection.validationError'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/home-collection', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          labOrderId:        orderId,
          address:           address.trim(),
          preferredDatetime: datetime,
          phone:             phone.trim(),
          notes:             notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? 'Error');
        return;
      }
      onSuccess(orderId);
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full border border-border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 ' +
    'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-2xl shadow-xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-600" />
        </div>
        <div className="px-5 pb-8 pt-2">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: BRAND }}>
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </span>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('homeCollection.formTitle')}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('homeCollection.address')}
              </label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                required className={inputCls} style={{ color: 'var(--color-heading)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('homeCollection.preferredDatetime')}
              </label>
              <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)}
                required min={new Date().toISOString().slice(0, 16)}
                className={inputCls} style={{ color: 'var(--color-heading)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('homeCollection.phone')}
              </label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className={inputCls} style={{ color: 'var(--color-heading)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('homeCollection.notes')}
              </label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className={`${inputCls} resize-none`} style={{ color: 'var(--color-heading)' }} />
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                {t('homeCollection.cancel')}
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-colors"
                style={{ background: BRAND }}>
                {submitting ? t('homeCollection.submitting') : t('homeCollection.submit')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Home Collections view ─────────────────────────────────────────────────────

interface HCListProps {
  requests:    HCRequest[];
  orders:      LabOrder[];
  locale:      string;
  expanded:    Set<string>;
  onToggle:    (key: string) => void;
  hcStatusLabel: (s: string) => string;
}

function HCList({ requests, orders, locale, expanded, onToggle, hcStatusLabel }: HCListProps) {
  const t    = useTranslations('labs');
  const isRtl = isRTL(locale);

  if (requests.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 dark:text-gray-500">
        <div className="w-14 h-14 mx-auto mb-3 opacity-30">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </div>
        <p className="text-sm">{t('homeCollection.noRequests')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
      {requests.map((req) => {
        const key        = `hc-${req.id}`;
        const isExpanded = expanded.has(key);
        const linkedOrder = orders.find((o) => o.id === req.labOrderId);
        const testSummary = linkedOrder
          ? linkedOrder.tests.slice(0, 2).map((t: LabTest) => t.name).filter(Boolean).join(', ') +
            (linkedOrder.tests.length > 2 ? ` +${linkedOrder.tests.length - 2}` : '')
          : null;

        return (
          <div key={key} className="card overflow-hidden">
            {/* ── Collapsed header ── */}
            <button
              className="w-full px-5 py-4 flex items-center justify-between gap-3 text-start hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              onClick={() => onToggle(key)}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* House icon */}
                <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                  style={{ background: `${BRAND}18` }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"
                    style={{ color: BRAND }}>
                    <path d="M3 12L12 3l9 9" />
                    <path d="M9 21V12h6v9" />
                    <rect x="3" y="12" width="18" height="9" rx="0" fill="none" />
                  </svg>
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {t('homeCollection.requestedOn')} {formatDate(req.createdAt)}
                    </span>
                    <HCStatusBadge status={req.status} label={hcStatusLabel(req.status)} />
                  </div>
                  {testSummary && (
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mt-0.5 truncate">
                      {testSummary}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('homeCollection.preferredTime')}: {formatDatetime(req.preferredDatetime, locale)}
                  </p>
                </div>
              </div>

              <svg viewBox="0 0 24 24" fill="currentColor"
                className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
              </svg>
            </button>

            {/* ── Expanded details ── */}
            {isExpanded && (
              <div className="border-t border-gray-100 dark:border-slate-700 px-5 py-4 space-y-3">
                {/* Status row */}
                <div className="flex items-center gap-2">
                  <HCStatusBadge status={req.status} label={hcStatusLabel(req.status)} />
                </div>

                {/* Detail rows */}
                <DetailRow
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  }
                  label={t('homeCollection.address')}
                  value={req.address}
                />
                <DetailRow
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  }
                  label={t('homeCollection.preferredTime')}
                  value={formatDatetime(req.preferredDatetime, locale)}
                />
                {req.phone && (
                  <DetailRow
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.72a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.94a16 16 0 006.15 6.15l1.3-1.3a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                      </svg>
                    }
                    label={t('homeCollection.phone')}
                    value={req.phone}
                  />
                )}
                {req.notes && (
                  <DetailRow
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    }
                    label={t('homeCollection.notes').replace(' (optional)', '')}
                    value={req.notes}
                  />
                )}

                {/* Linked lab order */}
                {linkedOrder && (
                  <div className="pt-1 border-t border-gray-100 dark:border-slate-700">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                      {t('homeCollection.labOrder')}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {formatDate(linkedOrder.orderDate)}
                      {linkedOrder.doctorName && (
                        <span className="text-gray-400"> · {linkedOrder.doctorName}</span>
                      )}
                    </p>
                    {linkedOrder.tests.length > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {linkedOrder.tests.map((t: LabTest) => t.name).filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5 text-gray-400 dark:text-gray-500">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
        <p className="text-sm text-gray-800 dark:text-gray-200 break-words">{value}</p>
      </div>
    </div>
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

  // Home collection state
  const [hcRequests,      setHcRequests]      = useState<HCRequest[]>([]);
  const [homeCollectionMap, setHomeCollectionMap] = useState<Record<string, string>>({});
  const [prefillPhone,    setPrefillPhone]    = useState('');
  const [prefillAddress,  setPrefillAddress]  = useState('');
  const [formOrderId,     setFormOrderId]     = useState<string | null>(null);

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

  const fetchHC = useCallback(() => {
    fetch('/api/home-collection')
      .then((r) => r.json())
      .then((data: {
        requests?: HCRequest[];
        patientPhone?: string;
        patientAddress?: string;
      }) => {
        if (data.requests) {
          setHcRequests(data.requests);
          const map: Record<string, string> = {};
          for (const req of data.requests) map[req.labOrderId] = req.status;
          setHomeCollectionMap(map);
        }
        if (data.patientPhone)   setPrefillPhone(data.patientPhone);
        if (data.patientAddress) setPrefillAddress(data.patientAddress);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchHC(); }, [fetchHC]);

  useEffect(() => { if (tab !== 'collections') setSearch(''); }, [tab]);

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

  function hcStatusLabel(status: string): string {
    if (status === 'scheduled') return t('homeCollection.statusScheduled');
    if (status === 'completed') return t('homeCollection.statusCompleted');
    if (status === 'cancelled') return t('homeCollection.statusCancelled');
    return t('homeCollection.statusRequested');
  }

  return (
    <AppShell locale={locale} title={t('title')}>
      <div className="max-w-2xl mx-auto">

        {/* ── Sticky top controls ── */}
        <div className="sticky z-30" style={{ top: 'var(--inner-nav-top)' }}>

          {/* Home Collections entry button — shown when NOT in collections view */}
          {tab !== 'collections' && hcRequests.length > 0 && (
            <button
              onClick={() => setTab('collections')}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl mb-2 text-white text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: BRAND }}
            >
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                  <path d="M3 12L12 3l9 9" />
                  <path d="M9 21V12h6v9" />
                </svg>
                {t('homeCollection.viewAll')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-white/25 rounded-full px-2 py-0.5 text-xs font-bold leading-none">
                  {hcRequests.length}
                </span>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 opacity-70">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </span>
            </button>
          )}

          {/* Back button — shown when IN collections view */}
          {tab === 'collections' && (
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setTab('orders')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-slate-700"
                style={{ color: BRAND }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
                {t('homeCollection.backToLabs')}
              </button>
              <h2 className="text-sm font-semibold text-[var(--color-heading)]">
                {t('homeCollection.viewAll')}
                {hcRequests.length > 0 && (
                  <span className="ms-1.5 text-xs text-gray-400">({hcRequests.length})</span>
                )}
              </h2>
            </div>
          )}

          {/* Seg-toggle — hidden in collections view */}
          {tab !== 'collections' && (
            <div className="seg-toggle mb-3">
              {(['orders', 'results'] as const).map((id) => (
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
          )}
        </div>

        {/* Search + refresh bar — hidden in collections view */}
        {tab !== 'collections' && (
          <div className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 border border-border rounded-lg px-2.5 focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:border-transparent" style={{ background: 'var(--card-bg)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" className="w-3.5 h-3.5 text-gray-400 shrink-0">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <line x1="15.5" y1="15.5" x2="20" y2="20" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  autoComplete="off" autoCorrect="off" spellCheck={false}
                  className="flex-1 py-1.5 bg-transparent text-sm focus:outline-none" style={{ color: 'var(--color-heading)' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 shrink-0">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                )}
              </div>
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
          </div>
        )}

        {/* ── Content ── */}
        {tab === 'collections' ? (
          <HCList
            requests={hcRequests}
            orders={orders}
            locale={locale}
            expanded={expanded}
            onToggle={toggleExpanded}
            hcStatusLabel={hcStatusLabel}
          />
        ) : loading ? (
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
                const hcStatus   = homeCollectionMap[order.id];
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
                          {hcStatus && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                              </svg>
                              {t('homeCollection.requested')}
                            </span>
                          )}
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

                        {order.status === 'pending' && (
                          <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
                            {hcStatus ? (
                              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                </svg>
                                {t('homeCollection.requested')}
                              </span>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setFormOrderId(order.id); }}
                                className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                                style={{ color: BRAND }}
                              >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                                </svg>
                                {t('homeCollection.request')}
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

      {/* Home collection form modal */}
      {formOrderId && (
        <HomeCollectionForm
          orderId={formOrderId}
          locale={locale}
          prefillAddress={prefillAddress}
          prefillPhone={prefillPhone}
          onClose={() => setFormOrderId(null)}
          onSuccess={(id) => {
            setHomeCollectionMap((prev) => ({ ...prev, [id]: 'requested' }));
            setFormOrderId(null);
            fetchHC();
          }}
        />
      )}
    </AppShell>
  );
}

// ── Shared row components ─────────────────────────────────────────────────────

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
  const flagLabel  = analyte.flag ? ` (${analyte.flag.toUpperCase()})` : '';
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

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

function formatDatetime(dateStr: string, locale: string) {
  try {
    return new Date(dateStr).toLocaleString(
      locale === 'ar' ? 'ar-IQ' : locale === 'ku' ? 'ckb-IQ' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    );
  } catch { return dateStr; }
}
