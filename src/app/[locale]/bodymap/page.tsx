'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/LoadingSpinner';

const BodyMapContent = dynamic(
  () => import('@/components/bodymap/BodyMapContent').then((m) => m.BodyMapContent),
  { ssr: false, loading: () => <PageLoader /> },
);

export default function BodyMapPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('bodymap');
  return (
    <AppShell locale={params.locale} title={t('title')}>
      <BodyMapContent />
    </AppShell>
  );
}
