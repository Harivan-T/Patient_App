'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { LabOrder, LabTest } from '@/types';

export default function LabsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('labs');
  const { locale } = params;

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/labs')
      .then((r) => r.json())
      .then((data) => setOrders(data.orders ?? []))
      .finally(() => setLoading(false));
  }, []);

  function toggleOrder(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  return (
    <AppShell locale={locale} title={t('title')}>
      <div className="max-w-2xl mx-auto">
        {loading ? (
          <PageLoader />
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-14 h-14 mx-auto mb-3 opacity-30">
              <path d="M19.8 18.4 14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4C3.71 19.06 4.18 20 5 20h14c.82 0 1.29-.94.8-1.6z" />
            </svg>
            <p className="text-sm">{t('noOrders')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order: LabOrder) => {
              const isExpanded = expanded.has(order.id);
              const hasAbnormal = order.tests.some((t: LabTest) => t.isAbnormal);
              return (
                <div key={order.id} className="card overflow-hidden">
                  <button
                    className="w-full px-5 py-4 flex items-center justify-between gap-4 text-start hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={() => toggleOrder(order.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatDate(order.orderDate)}
                        </span>
                        {hasAbnormal && (
                          <span className="badge-abnormal">⚠ {t('abnormal')}</span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            order.status === 'completed'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : order.status === 'partial'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {t(`status.${order.status}`)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                        {t('orderedBy')}: {order.doctorName}
                        {order.hospitalName && ` · ${order.hospitalName}`}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {order.tests.length} {order.tests.length === 1 ? 'test' : 'tests'}
                      </p>
                    </div>
                    <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>

                  {isExpanded && order.tests.length > 0 && (
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
                          {order.tests.map((test) => (
                            <TestRow key={test.id} test={test} tLabs={t} />
                          ))}
                        </tbody>
                      </table>
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

function TestRow({
  test,
  tLabs,
}: {
  test: LabTest;
  tLabs: ReturnType<typeof useTranslations<'labs'>>;
}) {
  return (
    <tr
      className={`border-t border-gray-100 dark:border-slate-700 ${
        test.isAbnormal ? 'bg-red-50/50 dark:bg-red-900/10' : ''
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {test.isAbnormal && <span className="badge-abnormal">!</span>}
          <span className={test.isAbnormal ? 'text-red-700 dark:text-red-400 font-medium' : ''}>{test.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-end font-mono">
        {test.result !== undefined && test.result !== null ? (
          <span className={test.isAbnormal ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
            {test.result}
          </span>
        ) : (
          <span className="text-gray-400">{tLabs('status.pending')}</span>
        )}
      </td>
      <td className="px-4 py-3 text-end text-gray-500 dark:text-gray-400 hidden sm:table-cell">
        {test.normalRange ?? '—'}
      </td>
      <td className="px-4 py-3 text-end text-gray-500 dark:text-gray-400">
        {test.unit ?? '—'}
      </td>
    </tr>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}
