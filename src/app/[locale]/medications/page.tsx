'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Medication, DispensedMed } from '@/types';

type Tab      = 'current' | 'past';
type AddState = 'idle' | 'adding' | 'added';

function formatIQD(amount: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-IQ' : 'en-US', {
      style: 'currency', currency: 'IQD',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `IQD ${Math.round(amount).toLocaleString()}`;
  }
}

interface AddItem {
  medicationId: string;
  name:         string;
  groupId?:     string | null;
  groupName?:   string | null;
}

export default function MedicationsPage({ params }: { params: { locale: string } }) {
  const t  = useTranslations('medications');
  const tc = useTranslations('cart');
  const { locale } = params;

  const [tab, setTab]             = useState<Tab>('current');
  const [current, setCurrent]     = useState<Medication[]>([]);
  const [dispensed, setDispensed] = useState<DispensedMed[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [renewalStates, setRenewalStates] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'error'>>({});
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});
  const [catalogPrices, setCatalogPrices] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => r.json())
      .then((items: Array<{ name: string; price: number | null }>) => {
        const map = new Map<string, number>();
        for (const item of items) {
          if (item.price != null) map.set(item.name.toLowerCase(), Number(item.price));
        }
        setCatalogPrices(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/medications')
      .then((r) => r.json())
      .then((data) => {
        setCurrent(data.current ?? []);
        setDispensed(data.dispensed ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setSearch(''); }, [tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return current;
    return current.filter((med) =>
      med.name?.toLowerCase().includes(q) ||
      med.genericName?.toLowerCase().includes(q) ||
      formatDate(med.startDate).toLowerCase().includes(q),
    );
  }, [current, search]);

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

  /* ── Cart helpers ── */
  async function addToCart(items: AddItem[], stateKey: string) {
    setAddStates((s) => ({ ...s, [stateKey]: 'adding' }));
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
        setAddStates((s) => ({ ...s, [stateKey]: 'added' }));
        window.dispatchEvent(new CustomEvent('cart-updated'));
        setTimeout(() => setAddStates((s) => ({ ...s, [stateKey]: 'idle' })), 2000);
      } else {
        setAddStates((s) => ({ ...s, [stateKey]: 'idle' }));
      }
    } catch {
      setAddStates((s) => ({ ...s, [stateKey]: 'idle' }));
    }
  }

  // Add a single drug from a current med (no group association)
  function addDrug(med: Medication, drugName: string) {
    const key = `drug-${med.id}:${drugName}`;
    addToCart([{ medicationId: `curr:${med.id}:${drugName}`, name: drugName }], key);
  }

  // Add whole prescription group (all drugs, tagged with group_id + group_name)
  function addGroup(med: Medication) {
    const drugs = med.drugs ?? [];
    const key   = `grp-${med.id}`;
    if (drugs.length === 0) {
      addToCart([{ medicationId: `curr:${med.id}`, name: med.name }], key);
    } else {
      addToCart(
        drugs.map((d) => ({
          medicationId: `curr:${med.id}:${d.name}`,
          name:         d.name,
          groupId:      med.id,
          groupName:    med.name,
        })),
        key,
      );
    }
  }

  // Add every current med shown (preserving group structure)
  function addAllCurrent() {
    const items = filtered.flatMap((med) => {
      const drugs = med.drugs ?? [];
      if (drugs.length === 0) {
        return [{ medicationId: `curr:${med.id}`, name: med.name }];
      }
      return drugs.map((d) => ({
        medicationId: `curr:${med.id}:${d.name}`,
        name:         d.name,
        groupId:      med.id,
        groupName:    med.name,
      }));
    });
    if (items.length) addToCart(items, '_all_current');
  }

  function getCatalogPrice(drugName: string): number | null {
    const lower = drugName.toLowerCase();
    const exact = catalogPrices.get(lower);
    if (exact !== undefined) return exact;
    const entries = Array.from(catalogPrices.entries());
    for (const [catName, price] of entries) {
      if (lower.includes(catName)) return price;
    }
    return null;
  }

  // Add every dispensed med shown
  function addAllDispensed() {
    const items = dispensed.map((med) => ({
      medicationId: `disp:${med.id}`,
      name:         med.drugName ?? 'Medication',
    }));
    if (items.length) addToCart(items, '_all_dispensed');
  }

  return (
    <AppShell locale={locale} title={t('title')}>
      <div className="max-w-2xl mx-auto">

        {/* ── Tab nav ── */}
        <div className="sticky z-30" style={{ top: 'var(--inner-nav-top)' }}>
          <div className="seg-toggle mb-3">
            {(['current', 'past'] as Tab[]).map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  tab === id
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {t(id)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Search bar (Current tab only) ── */}
        {tab === 'current' && (
          <div className="pb-2">
            <div className="flex items-center gap-2 border border-border rounded-lg px-2.5 focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:border-transparent" style={{ background: 'var(--card-bg)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" className="w-3.5 h-3.5 text-gray-400 shrink-0">
                <circle cx="10.5" cy="10.5" r="6.5" /><line x1="15.5" y1="15.5" x2="20" y2="20" />
              </svg>
              <input
                type="text" value={search}
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
          </div>
        )}

        {/* ══ DISPENSED tab ══ */}
        {tab === 'past' && (
          <>
            {/* DISPENSED ADD-ALL HIDDEN — re-enable by restoring the block below */}
            {false && !loading && dispensed.length > 0 && (
              <div className="flex justify-end mb-3">
                <AddBtn
                  state={addStates['_all_dispensed'] ?? 'idle'}
                  label={tc('addAll')} addingLabel={tc('adding')} addedLabel={tc('added')}
                  onClick={addAllDispensed}
                />
              </div>
            )}
            <DispensedSection
              items={dispensed} loading={loading}
              onAdd={(medId, name) =>
                addToCart([{ medicationId: `disp:${medId}`, name }], `disp-${medId}`)
              }
              addStates={addStates}
              addLabel={tc('add')} addingLabel={tc('adding')} addedLabel={tc('added')}
            />
          </>
        )}

        {/* ══ CURRENT tab ══ */}
        {tab === 'current' && (
          <>
            {/* Add All current */}
            {!loading && filtered.length > 0 && (
              <div className="flex justify-end mb-3">
                <AddBtn
                  state={addStates['_all_current'] ?? 'idle'}
                  label={tc('addAll')} addingLabel={tc('adding')} addedLabel={tc('added')}
                  onClick={addAllCurrent}
                />
              </div>
            )}

            {loading ? (
              <PageLoader />
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-30">
                  <path d="M6.5 10h-2v4h2v-4zm3 0h-2v4h2v-4zm3 0h-2v4h2v-4zm3 0h-2v4h2v-4zM3 18h18v2H3v-2zm0-10h18v2H3V8zM3 4h18v2H3V4z" />
                </svg>
                <p className="text-sm">{search ? t('noResults') : t('noCurrent')}</p>
                {search && <p className="text-xs text-gray-400 mt-1">&ldquo;{search}&rdquo;</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {search && (
                  <p className="text-xs text-gray-400 px-1">
                    {filtered.length} {filtered.length === 1 ? t('resultSingular') : t('resultPlural')}
                  </p>
                )}
                {filtered.map((med) => {
                  const renewState  = renewalStates[med.id] ?? 'idle';
                  const isOpen      = expanded.has(med.id);
                  const grpKey      = `grp-${med.id}`;
                  const drugs       = med.drugs ?? [];
                  const grpPrices   = drugs.map((d) => getCatalogPrice(d.name));
                  const grpTotal    = grpPrices.every((p) => p != null)
                    ? grpPrices.reduce((s, p) => s + (p ?? 0), 0)
                    : drugs.length === 0 ? getCatalogPrice(med.name) : null;
                  return (
                    <div key={med.id} className="card overflow-hidden">

                      {/* Header toggle */}
                      <button
                        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-start hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                        onClick={() => toggleExpanded(med.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {highlightMatch(med.name, search)}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                            {med.startDate && <span className="text-xs text-gray-400">{formatDate(med.startDate)}</span>}
                            {med.prescribingDoctor && <span className="text-xs text-gray-400">{med.prescribingDoctor}</span>}
                          </div>
                        </div>
                        <svg viewBox="0 0 24 24" fill="currentColor"
                          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
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

                      {/* Expanded: per-drug details + per-drug Add button */}
                      {isOpen && (
                        <div className="border-t border-gray-100 dark:border-slate-700">
                          {med.drugs && med.drugs.length > 0 && (
                            <div className="px-5 py-4 divide-y divide-gray-100 dark:divide-slate-700">
                              {med.drugs.map((drug, i) => {
                                const drugKey   = `drug-${med.id}:${drug.name}`;
                                const drugPrice = getCatalogPrice(drug.name);
                                return (
                                  <div key={i} className={`text-sm ${i > 0 ? 'pt-3' : ''} ${i < med.drugs!.length - 1 ? 'pb-3' : ''}`}>
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                      <div>
                                        <p className="font-semibold text-gray-800 dark:text-gray-200">{drug.name}</p>
                                        <p className="text-xs mt-0.5 text-gray-400">
                                          {drugPrice != null ? formatIQD(drugPrice, locale) : tc('priceOnRequest')}
                                        </p>
                                      </div>
                                      <AddBtn
                                        state={addStates[drugKey] ?? 'idle'} size="xs"
                                        label={tc('add')} addingLabel={tc('adding')} addedLabel={tc('added')}
                                        onClick={() => addDrug(med, drug.name)}
                                      />
                                    </div>
                                    <div className="space-y-0.5">
                                      {drug.dosage    && <p className="text-xs text-gray-600 dark:text-gray-400"><span className="text-gray-400 dark:text-gray-500">Dose: </span>{drug.dosage}</p>}
                                      {drug.route     && <p className="text-xs text-gray-600 dark:text-gray-400"><span className="text-gray-400 dark:text-gray-500">How to Take It: </span>{drug.route}</p>}
                                      {drug.frequency && <p className="text-xs text-gray-600 dark:text-gray-400"><span className="text-gray-400 dark:text-gray-500">How Often: </span>{drug.frequency}</p>}
                                      {drug.usage     && <p className="text-xs text-gray-600 dark:text-gray-400"><span className="text-gray-400 dark:text-gray-500">What It&apos;s For: </span>{drug.usage}</p>}
                                      {drug.endDate   && <p className="text-xs text-gray-600 dark:text-gray-400"><span className="text-gray-400 dark:text-gray-500">Use By: </span>{formatDate(drug.endDate)}</p>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {med.status === 'current' && med.refillable && (
                            <div className="px-5 pb-4 pt-1">
                              {renewState === 'sent'  ? <p className="text-sm text-green-600 dark:text-green-400">✓ {t('renewalSent')}</p> :
                               renewState === 'error' ? <p className="text-sm text-red-500">{t('renewalError')}</p> : (
                                <button onClick={() => handleRenewal(med.id)} disabled={renewState === 'sending'} className="btn-secondary text-sm py-2">
                                  {renewState === 'sending' ? '...' : t('requestRenewal')}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Per-group Add bar — always visible ── */}
                      <div className="px-5 py-2.5 border-t border-gray-100 dark:border-slate-700/50 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                            {(med.drugs?.length ?? 0) > 1
                              ? `${med.drugs!.length} medications`
                              : med.drugs?.[0]?.name ?? med.name}
                          </span>
                          {grpTotal != null && (
                            <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--color-primary)' }}>
                              {formatIQD(grpTotal, locale)}
                            </span>
                          )}
                        </div>
                        <AddBtn
                          state={addStates[grpKey] ?? 'idle'}
                          label={(med.drugs?.length ?? 0) > 1 ? tc('addGroup') : tc('add')}
                          addingLabel={tc('adding')} addedLabel={tc('added')}
                          onClick={() => addGroup(med)}
                        />
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </AppShell>
  );
}

/* ── AddBtn ── */
function AddBtn({
  state, label, addingLabel, addedLabel, onClick, size = 'sm',
}: {
  state: AddState; label: string; addingLabel: string; addedLabel: string;
  onClick: () => void; size?: 'sm' | 'xs';
}) {
  return (
    <button
      onClick={onClick}
      disabled={state !== 'idle'}
      className={`shrink-0 font-semibold rounded-lg transition-all duration-150 ${
        size === 'xs' ? 'text-xs px-2 py-1' : 'text-xs px-3 py-1.5'
      } ${
        state === 'added'  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
        state === 'adding' ? 'opacity-50 cursor-wait' : ''
      }`}
      style={state === 'idle' ? { background: 'var(--tibbna-light)', color: 'var(--color-primary)' } : {}}
    >
      {state === 'adding' ? addingLabel
       : state === 'added' ? `✓ ${addedLabel}`
       : (
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0" aria-hidden="true">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.17 14.25l.03-.12.9-1.63H17c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0021.46 3H5.21l-.94-2H1v2h2l3.6 7.59L5.25 13c-.16.28-.25.61-.25.96C5 15.1 5.9 16 7 16h14v-2H7.42a.13.13 0 01-.25-.05z"/>
          </svg>
          {label}
        </span>
       )}
    </button>
  );
}

/* ── Unchanged helpers ── */

function LabelRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return (
    <div className="flex gap-4 py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-xs font-medium w-28 shrink-0" style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span className="text-xs" style={{ color: 'var(--color-heading)' }}>{String(value)}</span>
    </div>
  );
}

const DOSAGE_LABEL_MAP: Record<string, string> = {
  'dose': 'Dose', 'route': 'How to take', 'timing': 'How often',
  'duration': 'How long', 'instructions': 'Instructions',
  'usage': "What it's for", 'valid until': 'Use before',
};
const ROUTE_DISPLAY: Record<string, string> = {
  'oral': 'By mouth', 'intravenous': 'Into a vein (IV)', 'topical': 'On the skin', 'inhaled': 'Inhaled',
};
const TRAILING_LABELS = new Set(['Use before']);
const PRIMARY_ORDER = ["What it's for", 'How to take', 'Dose', 'How often', 'How long', 'Instructions'];

function parseDosageString(raw: string | null | undefined) {
  const EMPTY = { primary: [] as { label: string; value: string }[], trailing: [] as { label: string; value: string }[] };
  if (!raw?.trim()) return EMPTY;
  if (!raw.includes('|') && !raw.includes(':')) return { primary: [{ label: 'Details', value: raw.trim() }], trailing: [] };
  const primaryMap: Record<string, string> = {};
  const trailingMap: Record<string, string> = {};
  const unknownRows: { label: string; value: string }[] = [];
  for (const seg of raw.split('|')) {
    const trimmed = seg.trim(); if (!trimmed) continue;
    const ci = trimmed.indexOf(':'); if (ci === -1) { unknownRows.push({ label: 'Details', value: trimmed }); continue; }
    const rawKey = trimmed.slice(0, ci).trim(); const rawVal = trimmed.slice(ci + 1).trim(); if (!rawVal) continue;
    const key = rawKey.toLowerCase(); const fl = DOSAGE_LABEL_MAP[key];
    if (fl) {
      const fv = key === 'route' ? (ROUTE_DISPLAY[rawVal.toLowerCase()] ?? rawVal) : rawVal;
      if (TRAILING_LABELS.has(fl)) trailingMap[fl] = fv; else primaryMap[fl] = fv;
    } else unknownRows.push({ label: rawKey.replace(/\b\w/g, (c) => c.toUpperCase()), value: rawVal });
  }
  return {
    primary: [...PRIMARY_ORDER.filter((l) => primaryMap[l]).map((l) => ({ label: l, value: primaryMap[l] })), ...unknownRows],
    trailing: Object.entries(trailingMap).map(([label, value]) => ({ label, value })),
  };
}

function DispensedSection({
  items, loading, onAdd, addStates, addLabel, addingLabel, addedLabel,
}: {
  items: DispensedMed[]; loading: boolean;
  onAdd: (medId: string, name: string) => void;
  addStates: Record<string, AddState>;
  addLabel: string; addingLabel: string; addedLabel: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  if (loading) return <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="card h-24 animate-pulse bg-gray-100 dark:bg-slate-700" />)}</div>;
  if (items.length === 0) return (
    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-30">
        <path d="M20 6h-2.18c.07-.44.18-.88.18-1.34C18 2.99 16.98 2 15.66 2c-.88 0-1.62.48-2.05 1.19L12 5.5l-1.61-2.31C9.96 2.48 9.22 2 8.34 2 7.02 2 6 2.99 6 4.66c0 .46.11.9.18 1.34H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
      </svg>
      <p className="text-sm">No medications picked up yet</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {items.map((med) => {
        const isOpen = expanded.has(med.id);
        const { primary, trailing } = parseDosageString(med.dosage);
        const dispKey = `disp-${med.id}`;
        return (
          <div key={med.id} className="card overflow-hidden">
            <button
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-start hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              onClick={() => toggle(med.id)}
            >
              <p className="font-semibold leading-snug flex-1 min-w-0" style={{ color: 'var(--color-heading)' }}>
                {med.drugName || 'Medication name not available'}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{med.source}</span>
                <svg viewBox="0 0 24 24" fill="currentColor"
                  className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--color-primary)' }}>
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                </svg>
              </div>
            </button>
            {isOpen && (
              <div className="border-t px-5 pt-1 pb-3" style={{ borderColor: 'var(--color-border)' }}>
                {primary.map(({ label, value }) => <LabelRow key={label} label={label} value={value} />)}
                <LabelRow label="Quantity"     value={med.quantity} />
                <LabelRow label="Dispensed on" value={med.dispensedAt ? formatDate(med.dispensedAt) : null} />
                <LabelRow label="Dispensed by" value={med.dispensedBy} />
                {trailing.map(({ label, value }) => <LabelRow key={label} label={label} value={value} />)}
              </div>
            )}
            {/* DISPENSED PER-ITEM ADD HIDDEN — re-enable by restoring the block below */}
            {false && (
              <div className="px-5 py-2.5 border-t border-gray-100 dark:border-slate-700/50 flex justify-end">
                <AddBtn
                  state={addStates[dispKey] ?? 'idle'} size="xs"
                  label={addLabel} addingLabel={addingLabel} addedLabel={addedLabel}
                  onClick={() => onAdd(med.id, med.drugName ?? 'Medication')}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return dateStr; }
}

function highlightMatch(text: string | undefined, query: string) {
  if (!text || !query.trim()) return text ?? '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 dark:bg-yellow-900/40 text-inherit rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
