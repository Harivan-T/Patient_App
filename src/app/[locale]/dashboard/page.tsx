'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { BodyMapContent } from '@/components/bodymap/BodyMapContent';
import type { DailyInsight } from '@/app/api/daily-insights/route';

type Tab      = 'updates' | 'mydoctor';
type Category = 'health' | 'food' | 'sports';

// ── DailyInsightsWidget ───────────────────────────────────────────────────────

function InsightCard({
  item,
  label,
  emoji,
  readLabel,
  noUpdateLabel,
}: {
  item: DailyInsight | null;
  label: string;
  emoji: string;
  readLabel: string;
  noUpdateLabel: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-slate-700">
        <span className="text-base">{emoji}</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span>
      </div>

      {item ? (
        <div className="px-5 py-4 flex flex-col gap-2">
          {item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt="" className="w-full h-36 object-cover rounded-lg" />
          )}
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">{item.title}</p>
          {item.snippet && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">{item.snippet}</p>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-400">{item.source}</span>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              {readLabel}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      ) : (
        <div className="px-5 py-6 text-center text-sm text-gray-400">{noUpdateLabel}</div>
      )}
    </div>
  );
}

function DailyInsightsWidget({ locale }: { locale: string }) {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<Record<Category, DailyInsight | null>>({ health: null, food: null, sports: null });
  const [loading, setLoading] = useState(true);

  const sections: { key: Category; label: string; emoji: string }[] = [
    { key: 'health', label: t('health'),    emoji: '🩺' },
    { key: 'food',   label: t('nutrition'), emoji: '🥗' },
    { key: 'sports', label: t('fitness'),   emoji: '🏅' },
  ];

  useEffect(() => {
    fetch(`/api/daily-insights?locale=${locale}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locale]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {sections.map(({ key }) => (
          <div key={key} className="card h-32 animate-pulse bg-gray-100 dark:bg-slate-700" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map(({ key, label, emoji }) => (
        <InsightCard
          key={key}
          item={data[key]}
          label={label}
          emoji={emoji}
          readLabel={t('read')}
          noUpdateLabel={t('noUpdate')}
        />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('dashboard');
  const [tab, setTab] = useState<Tab>('updates');

  return (
    <AppShell locale={params.locale}>
      <div className="max-w-2xl mx-auto">
        {/* Tab nav */}
        <div className="sticky z-30 pb-4" style={{ top: 'var(--inner-nav-top)' }}>
          <div className="seg-toggle">
            {(['updates', 'mydoctor'] as Tab[]).map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  tab === id
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {id === 'updates' ? t('updates') : t('myDoctor')}
              </button>
            ))}
          </div>
        </div>

        {tab === 'updates' && (
          <DailyInsightsWidget locale={params.locale} />
        )}
        {tab === 'mydoctor' && <BodyMapContent />}
      </div>
    </AppShell>
  );
}
