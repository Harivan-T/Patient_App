'use client';

import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { BodyMapContent } from '@/components/bodymap/BodyMapContent';

export default function BodyMapPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('bodymap');
  return (
    <AppShell locale={params.locale} title={t('title')}>
      <BodyMapContent />
    </AppShell>
  );
}
