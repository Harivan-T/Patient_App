'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { ChevronDownIcon, TrashIcon } from '@/components/ui/icons';

interface CartItem {
  itemId:       number;
  medicationId: string;
  name:         string;
  quantity:     number;
  groupId:      string | null;
  groupName:    string | null;
  price:        number | null;
}

interface OrderItem {
  id:           number;
  medicationId: string;
  name:         string;
  quantity:     number;
  groupName:    string | null;
  price:        number | null;
}

interface Order {
  id:        number;
  createdAt: string;
  status:    string;
  total:     number | null;
  items:     OrderItem[];
}

type PageTab = 'cart' | 'history';

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

export default function BasketPage({ params }: { params: { locale: string } }) {
  const t      = useTranslations('cart');
  const { locale } = params;

  const [tab, setTab]           = useState<PageTab>('cart');
  const [cartItems, setCartItems]   = useState<CartItem[]>([]);
  const [orders, setOrders]         = useState<Order[]>([]);
  const [loading, setLoading]       = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [updating, setUpdating]     = useState<Set<number>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  function toggleOrder(id: number) {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch('/api/cart');
      if (res.ok) {
        const data = await res.json();
        setCartItems(data.items ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await fetch('/api/cart/history');
      if (res.ok) setOrders(await res.json());
    } catch { /* silent */ }
    finally { setHistLoading(false); }
  }, []);

  useEffect(() => { fetchCart(); }, [fetchCart]);
  useEffect(() => {
    if (tab === 'history') fetchHistory();
  }, [tab, fetchHistory]);

  async function changeQty(itemId: number, delta: number, current: number) {
    const next = current + delta;
    if (next < 1) return removeItem(itemId);
    setUpdating((u) => new Set(u).add(itemId));
    await fetch(`/api/cart/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: next }),
    });
    await fetchCart();
    setUpdating((u) => { const n = new Set(u); n.delete(itemId); return n; });
    window.dispatchEvent(new CustomEvent('cart-updated'));
  }

  async function removeItem(itemId: number) {
    setUpdating((u) => new Set(u).add(itemId));
    await fetch(`/api/cart/${itemId}`, { method: 'DELETE' });
    await fetchCart();
    setUpdating((u) => { const n = new Set(u); n.delete(itemId); return n; });
    window.dispatchEvent(new CustomEvent('cart-updated'));
  }

  async function submitOrder() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/cart/submit', { method: 'POST' });
      if (res.ok) {
        setSubmitted(true);
        setCartItems([]);
        window.dispatchEvent(new CustomEvent('cart-updated'));
      }
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  }

  // Derived cart total — sum only items that have a resolved price so that a single
  // unpriced item ("—") doesn't zero-out the whole total.
  const pricedItems = cartItems.filter((i) => i.price != null);
  const cartTotal   = pricedItems.length > 0
    ? pricedItems.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0)
    : null;

  if (submitted) {
    return (
      <AppShell locale={locale}>
        <div className="max-w-md mx-auto text-center py-16 px-4 animate-fade-up">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-5 animate-scale-in">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-green-600 dark:text-green-400">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-heading)' }}>{t('orderSubmitted')}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>{t('orderSubmittedSub')}</p>
          <div className="flex gap-3 justify-center">
            <Link
              href={`/${locale}/medications`}
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-primary)' }}
            >
              {t('newOrder')}
            </Link>
            <button
              onClick={() => { setSubmitted(false); setTab('history'); fetchHistory(); }}
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              {t('orderHistory')}
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell locale={locale}>
      <div className="max-w-2xl mx-auto">

        {/* Tab header */}
        <div className="sticky z-30 mb-4" style={{ top: 'var(--inner-nav-top)' }}>
          <SegmentedTabs
            tabs={(['cart', 'history'] as PageTab[]).map((id) => ({
              id,
              label: (
                <>
                  {t(id)}
                  {id === 'cart' && cartItems.length > 0 && (
                    <span className={`ms-1.5 text-xs px-1.5 py-0.5 rounded-full transition-colors ${
                      tab === 'cart' ? 'bg-white/30 text-white' : 'bg-[var(--tibbna-light)] text-[var(--color-primary)]'
                    }`}>
                      {cartItems.length}
                    </span>
                  )}
                </>
              ),
            }))}
            active={tab}
            onChange={setTab}
          />
        </div>

        {/* ══ CART TAB ══ */}
        {tab === 'cart' && (
          loading ? <SkeletonCards count={3} cardClassName="h-16" /> :
          cartItems.length === 0 ? (
            <EmptyState
              icon="cart"
              title={t('emptyCart')}
              sub={t('emptyCartSub')}
              action={
                <Link
                  href={`/${locale}/medications`}
                  className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {t('newOrder')}
                </Link>
              }
            />
          ) : (
            <>
              <GroupedItemList
                items={cartItems}
                updating={updating}
                locale={locale}
                onChangeQty={changeQty}
                onRemove={removeItem}
                removeLabel={t('remove')}
              />

              {/* Cart total */}
              <div
                className="mt-4 px-4 py-3 rounded-xl flex items-center justify-between"
                style={{ background: 'var(--tibbna-light)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--color-heading)' }}>
                  {t('total')}
                </span>
                <span className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>
                  {cartTotal != null ? formatIQD(cartTotal, locale) : '—'}
                </span>
              </div>

              {/* Place order button */}
              <div className="mt-3">
                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {submitting
                    ? t('submitting')
                    : cartTotal != null
                      ? `${t('submitOrder')} · ${formatIQD(cartTotal, locale)}`
                      : `${t('submitOrder')} · ${cartItems.length} ${cartItems.length === 1 ? t('item') : t('items')}`
                  }
                </button>
              </div>
            </>
          )
        )}

        {/* ══ HISTORY TAB ══ */}
        {tab === 'history' && (
          histLoading ? <SkeletonCards count={3} cardClassName="h-14" /> :
          orders.length === 0 ? (
            <EmptyState
              icon="history"
              title={t('emptyHistory')}
              sub={t('emptyHistorySub')}
            />
          ) : (
            <div className="space-y-3 stagger-children">
              {orders.map((order) => {
                const isOpen     = expandedOrders.has(order.id);
                const firstName  = order.items[0]?.name ?? '';
                const extraCount = order.items.length - 1;
                return (
                  <div key={order.id} className="card overflow-hidden">
                    {/* Summary row */}
                    <button
                      className="w-full text-start px-5 py-3.5 flex items-center gap-3"
                      onClick={() => toggleOrder(order.id)}
                      aria-expanded={isOpen}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                            {t('orderedOn')} {formatDate(order.createdAt)}
                          </span>
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--tibbna-light)', color: 'var(--color-primary)' }}
                          >
                            {t('statusRecorded')}
                          </span>
                          {order.total != null && (
                            <span className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>
                              {formatIQD(order.total, locale)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium mt-0.5 truncate" style={{ color: 'var(--color-heading)' }}>
                          {firstName}
                          {extraCount > 0 && (
                            <span className="font-normal" style={{ color: 'var(--color-muted)' }}>
                              {' '}+{extraCount} {extraCount === 1 ? t('item') : t('items')}
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronDownIcon className={`w-4 h-4 shrink-0 text-[var(--color-muted)] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Expanded item list + total footer */}
                    {isOpen && (
                      <div className="border-t border-gray-100 dark:border-slate-700">
                        <ReadOnlyGroupedList items={order.items} locale={locale} />
                        {order.total != null && (
                          <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                            <span className="text-sm font-semibold" style={{ color: 'var(--color-heading)' }}>
                              {t('total')}
                            </span>
                            <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                              {formatIQD(order.total, locale)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

      </div>
    </AppShell>
  );
}

/* ── GroupedItemList — live cart with steppers + delete ── */
function GroupedItemList({
  items, updating, locale, onChangeQty, onRemove, removeLabel,
}: {
  items: CartItem[];
  updating: Set<number>;
  locale: string;
  onChangeQty: (id: number, delta: number, current: number) => void;
  onRemove: (id: number) => void;
  removeLabel: string;
}) {
  const groups   = new Map<string, { name: string; rows: CartItem[] }>();
  const singles: CartItem[] = [];

  for (const item of items) {
    if (item.groupId && item.groupName) {
      if (!groups.has(item.groupId)) groups.set(item.groupId, { name: item.groupName, rows: [] });
      groups.get(item.groupId)!.rows.push(item);
    } else {
      singles.push(item);
    }
  }

  return (
    <div className="space-y-3 stagger-children">
      {Array.from(groups.entries()).map(([gid, { name, rows }]) => (
        <div key={gid} className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-700/60">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>{name}</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700/60">
            {rows.map((item) => (
              <CartRow key={item.itemId} item={item} busy={updating.has(item.itemId)} locale={locale}
                onChangeQty={onChangeQty} onRemove={onRemove} removeLabel={removeLabel} />
            ))}
          </div>
        </div>
      ))}
      {singles.length > 0 && (
        <div className="card overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-slate-700/60">
            {singles.map((item) => (
              <CartRow key={item.itemId} item={item} busy={updating.has(item.itemId)} locale={locale}
                onChangeQty={onChangeQty} onRemove={onRemove} removeLabel={removeLabel} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CartRow({
  item, busy, locale, onChangeQty, onRemove, removeLabel,
}: {
  item: CartItem; busy: boolean; locale: string;
  onChangeQty: (id: number, delta: number, current: number) => void;
  onRemove: (id: number) => void;
  removeLabel: string;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-3" style={{ opacity: busy ? 0.5 : 1, transition: 'opacity 0.15s' }}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-snug" style={{ color: 'var(--color-heading)' }}>{item.name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {item.price != null
            ? `${formatIQD(item.price, locale)} × ${item.quantity} = ${formatIQD(item.price * item.quantity, locale)}`
            : '—'}
        </p>
      </div>
      {/* Qty stepper */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onChangeQty(item.itemId, -1, item.quantity)} disabled={busy}
          className="pressable w-7 h-7 rounded-full flex items-center justify-center text-base font-bold hover:bg-gray-100 dark:hover:bg-slate-700"
          style={{ color: 'var(--color-primary)' }}>−</button>
        <span className="w-5 text-center text-sm font-semibold" style={{ color: 'var(--color-heading)' }}>
          {item.quantity}
        </span>
        <button onClick={() => onChangeQty(item.itemId, +1, item.quantity)} disabled={busy}
          className="pressable w-7 h-7 rounded-full flex items-center justify-center text-base font-bold hover:bg-gray-100 dark:hover:bg-slate-700"
          style={{ color: 'var(--color-primary)' }}>+</button>
      </div>
      {/* Delete */}
      <button onClick={() => onRemove(item.itemId)} disabled={busy}
        className="pressable shrink-0 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400"
        aria-label={removeLabel}>
        <TrashIcon />
      </button>
    </div>
  );
}

/* ── ReadOnlyGroupedList — order history ── */
function ReadOnlyGroupedList({ items, locale }: { items: OrderItem[]; locale: string }) {
  const groups   = new Map<string, { name: string; rows: OrderItem[] }>();
  const singles: OrderItem[] = [];

  for (const item of items) {
    if (item.groupName) {
      if (!groups.has(item.groupName)) groups.set(item.groupName, { name: item.groupName, rows: [] });
      groups.get(item.groupName)!.rows.push(item);
    } else {
      singles.push(item);
    }
  }

  return (
    <div>
      {Array.from(groups.entries()).map(([gname, { name, rows }]) => (
        <div key={gname}>
          <div className="px-4 py-2 border-b border-gray-50 dark:border-slate-700/40">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>{name}</p>
          </div>
          {rows.map((row) => (
            <HistoryRow key={row.id} item={row} locale={locale} />
          ))}
        </div>
      ))}
      {singles.map((item) => (
        <HistoryRow key={item.id} item={item} locale={locale} />
      ))}
    </div>
  );
}

function HistoryRow({ item, locale }: { item: OrderItem; locale: string }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-50 dark:border-slate-700/40 last:border-0">
      <p className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--color-heading)' }}>{item.name}</p>
      <div className="flex flex-col items-end ms-4 shrink-0">
        <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>×{item.quantity}</span>
        {item.price != null && (
          <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
            {formatIQD(item.price * item.quantity, locale)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── EmptyState ── */
function EmptyState({ icon, title, sub, action }: { icon: 'cart' | 'history'; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{ background: 'var(--tibbna-light)' }}>
        {icon === 'cart' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9" style={{ color: 'var(--color-primary)' }}>
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9" style={{ color: 'var(--color-primary)' }}>
            <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
          </svg>
        )}
      </div>
      <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-heading)' }}>{title}</h2>
      <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>{sub}</p>
      {action}
    </div>
  );
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return iso; }
}
