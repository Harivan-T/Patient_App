'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { ExternalLinkIcon } from '@/components/ui/icons';
import type { DailyInsight } from '@/app/api/daily-insights/route';

// Lazy — the body map (largest component in the app) only loads if the
// "My Doctor" tab is actually opened.
const BodyMapContent = dynamic(
  () => import('@/components/bodymap/BodyMapContent').then((m) => m.BodyMapContent),
  { ssr: false, loading: () => <PageLoader /> },
);

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
            <img src={item.image_url} alt="" loading="lazy" decoding="async" className="w-full h-36 object-cover rounded-lg" />
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
              <ExternalLinkIcon />
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
    return <SkeletonCards count={3} cardClassName="h-24" />;
  }

  return (
    <div className="flex flex-col gap-4 stagger-children">
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
          <SegmentedTabs
            tabs={[
              { id: 'updates' as Tab, label: t('updates') },
              { id: 'mydoctor' as Tab, label: t('myDoctor') },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>

        {tab === 'updates' && (
          <DailyInsightsWidget locale={params.locale} />
        )}
        {tab === 'mydoctor' && <BodyMapContent />}
      </div>
    </AppShell>
  );
}
