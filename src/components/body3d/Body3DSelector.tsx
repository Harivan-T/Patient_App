'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { REGION_KEYS } from './regions';
import type { RegionKey } from './regions';

// ── Lazy import — three.js NEVER ships in the initial page bundle ─────────────
const BodyModelViewer = dynamic(
  () => import('./BodyModelViewer').then((m) => ({ default: m.BodyModelViewer })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-2xl flex flex-col items-center justify-center gap-3"
        style={{ height: 440, background: '#EEF6FA' }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#548194', borderTopColor: 'transparent' }}
        />
        <span className="text-sm text-slate-500">Loading 3D viewer…</span>
      </div>
    ),
  },
);

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  /** Zone keys currently selected — controlled by parent (BodyMapContent) */
  selected: string[];
  /** Called with the toggled key; parent adds/removes from its zones array */
  onToggle: (key: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Body3DSelector({ selected, onToggle }: Props) {
  const t = useTranslations('body3d');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [segError, setSegError] = useState<string | null>(null);

  // Convert array → Set once per render (stable identity not needed, just convenience)
  const selectedSet = new Set(selected);

  const handleToggle = useCallback(
    (k: RegionKey) => onToggle(k),
    [onToggle],
  );

  const handleSegmentCheck = useCallback((ok: boolean, found: string[]) => {
    if (!ok) {
      const missing = REGION_KEYS.filter((k) => !found.includes(k));
      setSegError(
        `Required mesh names not found in GLB: [${missing.join(', ')}]. ` +
        `Found: [${found.join(', ')}]. ` +
        `Each region needs a named mesh matching the key exactly.`,
      );
    }
  }, []);

  // ── Segmentation error guard ───────────────────────────────────────────────
  if (segError) {
    return (
      <div className="p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 text-red-700 dark:text-red-400 text-sm space-y-1.5">
        <p className="font-semibold">⚠ 3D Model — Segmentation Error</p>
        <p className="text-xs leading-relaxed">{segError}</p>
        <p className="text-xs text-red-500 font-medium">
          Stop: per-region tap-selection requires individually named meshes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Male / Female toggle */}
      <div className="seg-toggle">
        {(['male', 'female'] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGender(g)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              gender === g
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {t(g)}
          </button>
        ))}
      </div>

      {/* 3D viewer — dynamically loaded */}
      <BodyModelViewer
        gender={gender}
        selected={selectedSet}
        onToggle={handleToggle}
        onSegmentCheck={handleSegmentCheck}
      />

      {/* Selected region chips (RTL-safe flex-wrap) */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onToggle(k)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white transition-opacity hover:opacity-80"
              style={{ background: 'var(--color-primary)' }}
            >
              {t(k as RegionKey)}
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">{t('hint')}</p>
    </div>
  );
}
