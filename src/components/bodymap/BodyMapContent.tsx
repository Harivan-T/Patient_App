'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { BookDoctorOptions } from '@/components/ui/BookDoctorOptions';
import { AREA_SYMPTOM_KEYS, ZONE_TO_GROUP } from '@/data/areaSymptoms';

interface PainRecord {
  id: string;
  zones: string[];
  symptoms: string[];
  areaSymptoms?: Record<string, string[]>;
  painLevel: number;
  duration: string;
  movementPain: boolean;
  nightPain: boolean;
  takingMedication: boolean;
  hasFever: boolean;
  notes: string;
  recordedAt: string;
}

const BRAND = 'var(--color-primary)';

const DURATION_KEYS = ['today', 'fewDays', 'oneToTwoWeeks', 'oneMonth', 'threeMonths', 'overYear'] as const;
const QUESTION_KEYS = ['movementPain', 'nightPain', 'takingMedication', 'hasFever'] as const;

interface ZoneDef {
  id: string;
  side: 'front' | 'back';
  shape: { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
       | { type: 'rect';    x: number;  y: number;  w: number;  h: number; rx?: number };
}

const ZONES: ZoneDef[] = [
  { id: 'head',          side: 'front', shape: { type: 'ellipse', cx: 100, cy: 28, rx: 22, ry: 26 } },
  { id: 'neck',          side: 'front', shape: { type: 'rect',    x: 91,  y: 52,  w: 18,  h: 14, rx: 4 } },
  { id: 'l-shoulder',    side: 'front', shape: { type: 'ellipse', cx: 65, cy: 73, rx: 14, ry: 11 } },
  { id: 'r-shoulder',    side: 'front', shape: { type: 'ellipse', cx: 135,cy: 73, rx: 14, ry: 11 } },
  { id: 'chest',         side: 'front', shape: { type: 'rect',    x: 73,  y: 82,  w: 54,  h: 36, rx: 4 } },
  { id: 'abdomen',       side: 'front', shape: { type: 'rect',    x: 73,  y: 118, w: 54,  h: 38, rx: 4 } },
  { id: 'l-upper-arm',   side: 'front', shape: { type: 'rect',    x: 40,  y: 74,  w: 22,  h: 42, rx: 6 } },
  { id: 'r-upper-arm',   side: 'front', shape: { type: 'rect',    x: 138, y: 74,  w: 22,  h: 42, rx: 6 } },
  { id: 'l-forearm',     side: 'front', shape: { type: 'rect',    x: 36,  y: 118, w: 18,  h: 34, rx: 6 } },
  { id: 'r-forearm',     side: 'front', shape: { type: 'rect',    x: 146, y: 118, w: 18,  h: 34, rx: 6 } },
  { id: 'pelvis',        side: 'front', shape: { type: 'rect',    x: 68,  y: 156, w: 64,  h: 22, rx: 4 } },
  { id: 'l-thigh',       side: 'front', shape: { type: 'rect',    x: 68,  y: 178, w: 24,  h: 48, rx: 6 } },
  { id: 'r-thigh',       side: 'front', shape: { type: 'rect',    x: 108, y: 178, w: 24,  h: 48, rx: 6 } },
  { id: 'l-knee',        side: 'front', shape: { type: 'ellipse', cx: 79, cy: 233, rx: 12, ry: 10 } },
  { id: 'r-knee',        side: 'front', shape: { type: 'ellipse', cx: 121,cy: 233, rx: 12, ry: 10 } },
  { id: 'l-shin',        side: 'front', shape: { type: 'rect',    x: 66,  y: 244, w: 20,  h: 36, rx: 5 } },
  { id: 'r-shin',        side: 'front', shape: { type: 'rect',    x: 114, y: 244, w: 20,  h: 36, rx: 5 } },
  { id: 'l-foot',        side: 'front', shape: { type: 'ellipse', cx: 72, cy: 285, rx: 12, ry: 7 } },
  { id: 'r-foot',        side: 'front', shape: { type: 'ellipse', cx: 128,cy: 285, rx: 12, ry: 7 } },
  { id: 'head-b',        side: 'back',  shape: { type: 'ellipse', cx: 100, cy: 28, rx: 22, ry: 26 } },
  { id: 'neck-b',        side: 'back',  shape: { type: 'rect',    x: 91,  y: 52,  w: 18,  h: 14, rx: 4 } },
  { id: 'l-trap',        side: 'back',  shape: { type: 'ellipse', cx: 73, cy: 74, rx: 16, ry: 11 } },
  { id: 'r-trap',        side: 'back',  shape: { type: 'ellipse', cx: 127,cy: 74, rx: 16, ry: 11 } },
  { id: 'upper-back',    side: 'back',  shape: { type: 'rect',    x: 73,  y: 82,  w: 54,  h: 30, rx: 4 } },
  { id: 'mid-back',      side: 'back',  shape: { type: 'rect',    x: 73,  y: 112, w: 54,  h: 26, rx: 4 } },
  { id: 'lower-back',    side: 'back',  shape: { type: 'rect',    x: 73,  y: 138, w: 54,  h: 22, rx: 4 } },
  { id: 'l-upper-arm-b', side: 'back',  shape: { type: 'rect',    x: 40,  y: 74,  w: 22,  h: 42, rx: 6 } },
  { id: 'r-upper-arm-b', side: 'back',  shape: { type: 'rect',    x: 138, y: 74,  w: 22,  h: 42, rx: 6 } },
  { id: 'l-buttock',     side: 'back',  shape: { type: 'rect',    x: 68,  y: 158, w: 28,  h: 28, rx: 6 } },
  { id: 'r-buttock',     side: 'back',  shape: { type: 'rect',    x: 104, y: 158, w: 28,  h: 28, rx: 6 } },
  { id: 'l-back-thigh',  side: 'back',  shape: { type: 'rect',    x: 68,  y: 186, w: 24,  h: 50, rx: 6 } },
  { id: 'r-back-thigh',  side: 'back',  shape: { type: 'rect',    x: 108, y: 186, w: 24,  h: 50, rx: 6 } },
  { id: 'l-calf',        side: 'back',  shape: { type: 'rect',    x: 66,  y: 242, w: 20,  h: 36, rx: 5 } },
  { id: 'r-calf',        side: 'back',  shape: { type: 'rect',    x: 114, y: 242, w: 20,  h: 36, rx: 5 } },
];

function zoneKey(id: string): string {
  return id.replace(/-b$/, '').replace(/-/g, '_');
}

function painColor(level: number): string {
  if (level <= 3) return '#22c55e';
  if (level <= 6) return '#f59e0b';
  return '#ef4444';
}

function BodySVG({ side, selectedZones, onToggle, gender }: {
  side: 'front' | 'back';
  selectedZones: string[];
  onToggle: (id: string) => void;
  gender: 'male' | 'female';
}) {
  const zones = ZONES.filter((z) => z.side === side);

  function renderShape(z: ZoneDef, selected: boolean) {
    const sharedProps = {
      fill: selected ? BRAND : 'transparent',
      fillOpacity: selected ? 0.45 : 0,
      stroke: selected ? BRAND : '#94a3b8',
      strokeWidth: selected ? 2 : 1,
      className: 'cursor-pointer transition-all hover:fill-[var(--color-primary)] hover:fill-opacity-20',
      onClick: () => onToggle(z.id),
    };
    if (z.shape.type === 'ellipse') {
      return <ellipse key={z.id} cx={z.shape.cx} cy={z.shape.cy} rx={z.shape.rx} ry={z.shape.ry} {...sharedProps} />;
    }
    return <rect key={z.id} x={z.shape.x} y={z.shape.y} width={z.shape.w} height={z.shape.h} rx={z.shape.rx ?? 0} {...sharedProps} />;
  }

  const isFemale = gender === 'female';

  return (
    <svg viewBox="0 0 200 300" className="w-full max-w-[220px] mx-auto select-none">
      <g fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1">
        <ellipse cx="100" cy="28" rx="22" ry="26" />
        <rect x="91" y="52" width="18" height="14" rx="4" />
        {isFemale ? (
          <>
            <path d="M70 64 L130 64 Q136 112 132 155 Q116 162 100 162 Q84 162 68 155 Q64 112 70 64 Z" />
            <path d="M70 70 L50 76 L44 148 L60 148 L65 80 Z" />
            <path d="M130 70 L150 76 L156 148 L140 148 L135 80 Z" />
            <path d="M66 155 Q58 164 60 280 L82 280 L90 165 Q100 170 110 165 L118 280 L140 280 Q142 164 134 155 Q116 164 100 164 Q84 164 66 155 Z" />
          </>
        ) : (
          <>
            <path d="M60 64 L140 64 L138 158 L62 158 Z" />
            <path d="M60 70 L38 76 L32 150 L50 150 L58 80 Z" />
            <path d="M140 70 L162 76 L168 150 L150 150 L142 80 Z" />
            <path d="M68 158 L60 280 L82 280 L90 162 Z" />
            <path d="M132 158 L140 280 L118 280 L110 162 Z" />
          </>
        )}
        <ellipse cx="71" cy="285" rx="11" ry="7" />
        <ellipse cx="129" cy="285" rx="11" ry="7" />
      </g>

      {side === 'front' ? (
        <g fill="#94a3b8" stroke="none">
          <circle cx="91" cy="24" r="2.5" />
          <circle cx="109" cy="24" r="2.5" />
          <path d="M93 36 Q100 41 107 36" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="100" y1="68" x2="100" y2="156" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,3" />
          {isFemale && (
            <>
              <ellipse cx="89" cy="102" rx="9" ry="7" fill="#d1dae5" stroke="#cbd5e1" strokeWidth="0.8" />
              <ellipse cx="111" cy="102" rx="9" ry="7" fill="#d1dae5" stroke="#cbd5e1" strokeWidth="0.8" />
            </>
          )}
        </g>
      ) : (
        <g>
          <line x1="100" y1="68" x2="100" y2="156" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,4" />
          <ellipse cx="82" cy="92" rx="12" ry="18" fill="#d1dae5" />
          <ellipse cx="118" cy="92" rx="12" ry="18" fill="#d1dae5" />
          <ellipse cx="100" cy="22" rx="20" ry="12" fill="#d1dae5" />
          {isFemale && (
            <path d="M78 145 Q100 152 122 145" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
          )}
        </g>
      )}

      {zones.map((z) => renderShape(z, selectedZones.includes(z.id)))}
    </svg>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 shrink-0">{label}</span>
      <div className="text-end">{children}</div>
    </div>
  );
}

function formatDateTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

export function BodyMapContent() {
  const t             = useTranslations('bodymap');
  const tCommon       = useTranslations('common');
  const tAreaSymptoms = useTranslations('areaSymptoms');
  const tBooking      = useTranslations('booking');

  const [step, setStep] = useState(1);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [zones, setZones]               = useState<string[]>([]);
  const [areaSymptoms, setAreaSymptoms] = useState<Record<string, string[]>>({});
  const [painLevel, setPainLevel] = useState(5);
  const [duration, setDuration] = useState('');
  const [answers, setAnswers] = useState({ movementPain: false, nightPain: false, takingMedication: false, hasFever: false });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [bookAboveOpen, setBookAboveOpen]       = useState(false);
  const [bookStep5Open, setBookStep5Open]       = useState(false);
  const [historyOpen, setHistoryOpen]           = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [history, setHistory]                   = useState<PainRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  function getZoneLabel(id: string): string {
    return t(`zones.${zoneKey(id)}` as Parameters<typeof t>[0]);
  }

  function painLabel(level: number): string {
    if (level <= 3) return t('pain.mild');
    if (level <= 6) return t('pain.moderate');
    return t('pain.severe');
  }

  function getSymptomLabel(key: string): string {
    if (key.includes('.')) {
      const [area, sym] = key.split('.');
      try { return (tAreaSymptoms as (k: string) => string)(`${area}.${sym}`); } catch { return sym; }
    }
    return t(`symptoms.${key.toLowerCase()}` as Parameters<typeof t>[0]);
  }

  function getDurationLabel(key: string): string {
    return t(`durations.${key}` as Parameters<typeof t>[0]);
  }

  function toggleZone(id: string) {
    setZones((prev) => prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]);
  }

  function toggleAreaSymptom(group: string, symptom: string) {
    setAreaSymptoms(prev => {
      const cur  = prev[group] ?? [];
      const next = cur.includes(symptom) ? cur.filter(s => s !== symptom) : [...cur, symptom];
      return { ...prev, [group]: next };
    });
  }

  // Unique area groups for the selected zones, filtered to those with known symptom lists
  const selectedGroups = Array.from(new Set(zones.map(z => ZONE_TO_GROUP[z] ?? z))).filter(g => g in AREA_SYMPTOM_KEYS);
  const hasAnySymptom  = Object.values(areaSymptoms).some(s => s.length > 0);
  // Compound "area.symptomKey" strings for backward-compat API submission
  const allSymptoms    = Object.entries(areaSymptoms).flatMap(([area, syms]) => syms.map(sym => `${area}.${sym}`));

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/pain-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones, symptoms: allSymptoms, areaSymptoms, painLevel, duration, ...answers, notes }),
      });
      if (res.ok) { setSubmitted(true); loadHistory(); }
    } finally { setSubmitting(false); }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/pain-record');
      const data = await res.json();
      setHistory(data.records ?? []);
    } finally { setLoadingHistory(false); }
  }

  useEffect(() => {
    loadHistory();
    fetch('/api/profile').then(r => r.json()).then(data => {
      if (data?.gender?.toLowerCase().startsWith('f')) setGender('female');
    }).catch(() => {});
  }, []);

  function resetForm() {
    setStep(1); setSide('front'); setZones([]); setAreaSymptoms({});
    setPainLevel(5); setDuration(''); setNotes('');
    setAnswers({ movementPain: false, nightPain: false, takingMedication: false, hasFever: false });
    setSubmitted(false); setBookStep5Open(false);
  }

  const STEP_LABELS = [
    t('steps.zones'), t('steps.symptoms'), t('steps.painScale'),
    t('steps.questions'), t('steps.review'),
  ];

  return (
    <div className="max-w-lg mx-auto">
      {submitted ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: '#d1fae5' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" className="w-8 h-8">
              <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{t('success.title')}</h2>
          <p className="text-sm text-gray-500">{t('success.subtitle')}</p>
          <button onClick={resetForm} className="btn-primary">{t('buttons.newReport')}</button>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-6 px-1">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex-1 flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={{ background: i + 1 <= step ? BRAND : '#e5e7eb', color: i + 1 <= step ? 'white' : '#9ca3af' }}
                  >
                    {i + 1 < step ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    ) : i + 1}
                  </div>
                  <span className="text-[10px] text-gray-400 hidden sm:block">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1 transition-colors" style={{ background: i + 1 < step ? BRAND : '#e5e7eb' }} />
                )}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">{t('step1.heading')}</h2>
              <p className="text-sm text-gray-500 mb-4">{t('step1.subtitle')}</p>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                  {(['front', 'back'] as const).map((s) => (
                    <button key={s} onClick={() => setSide(s)}
                      className="py-1.5 px-5 rounded-lg text-sm font-medium transition-colors"
                      style={side === s ? { background: 'white', color: BRAND, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6b7280' }}>
                      {s === 'front' ? t('step1.front') : t('step1.back')}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                  {(['male', 'female'] as const).map((g) => (
                    <button key={g} onClick={() => setGender(g)}
                      className="py-1.5 px-3 rounded-lg text-sm font-medium transition-colors"
                      style={gender === g ? { background: 'white', color: BRAND, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6b7280' }}>
                      {g === 'male' ? '♂' : '♀'}
                    </button>
                  ))}
                </div>
              </div>
              <BodySVG side={side} selectedZones={zones} onToggle={toggleZone} gender={gender} />
              {zones.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                  {zones.map((id) => (
                    <span key={id} className="text-xs px-2.5 py-1 rounded-full text-white flex items-center gap-1" style={{ background: BRAND }}>
                      {getZoneLabel(id)}
                      <button onClick={() => toggleZone(id)} className="opacity-70 hover:opacity-100 leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-5">
                <button onClick={() => setStep(2)} disabled={zones.length === 0} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: BRAND }}>
                  {t('buttons.next')}
                  <span className="w-6 h-6 rounded-full bg-white/20 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M2 7h10M8 3l4 4-4 4" /></svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">{t('step2.heading')}</h2>
              <p className="text-sm text-gray-500 mb-4">{t('step2.subtitle')}</p>
              {selectedGroups.map((group, gIdx) => (
                <div key={group} className={gIdx > 0 ? 'mt-5' : ''}>
                  {selectedGroups.length > 1 && (
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND }}>
                        {(tAreaSymptoms as (k: string) => string)(`${group}.label`)}
                      </span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {(AREA_SYMPTOM_KEYS[group] ?? []).map((symptomKey, sIdx) => {
                      const isActive = (areaSymptoms[group] ?? []).includes(symptomKey);
                      return (
                        <button key={symptomKey}
                          onClick={() => toggleAreaSymptom(group, symptomKey)}
                          className="relative py-3 px-4 rounded-xl border-2 text-sm font-medium text-start transition-all"
                          style={{ borderColor: isActive ? BRAND : '#e5e7eb', background: isActive ? 'var(--tibbna-light)' : 'white', color: isActive ? '#0e7490' : '#374151' }}>
                          {(tAreaSymptoms as (k: string) => string)(`${group}.${symptomKey}`)}
                          {sIdx < 3 && !isActive && (
                            <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 rounded-full" style={{ background: BRAND, opacity: 0.4 }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex justify-between mt-5">
                <button onClick={() => setStep(1)} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium text-sm transition-colors hover:bg-gray-200 dark:hover:bg-slate-600">
                  <span className="w-6 h-6 rounded-full bg-gray-300/60 dark:bg-slate-600 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M12 7H2M6 3L2 7l4 4" /></svg>
                  </span>
                  {t('buttons.back')}
                </button>
                <button onClick={() => setStep(3)} disabled={!hasAnySymptom} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: BRAND }}>
                  {t('buttons.next')}
                  <span className="w-6 h-6 rounded-full bg-white/20 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M2 7h10M8 3l4 4-4 4" /></svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">{t('step3.heading')}</h2>
              <p className="text-sm text-gray-500 mb-6">{t('step3.subtitle')}</p>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">{t('step3.painLevel')}</span>
                  <span className="text-2xl font-bold" style={{ color: painColor(painLevel) }}>
                    {painLevel} <span className="text-sm font-normal">— {painLabel(painLevel)}</span>
                  </span>
                </div>
                <input type="range" min="1" max="10" value={painLevel}
                  onChange={(e) => setPainLevel(Number(e.target.value))}
                  className="w-full h-3 rounded-full appearance-none cursor-pointer"
                  style={{ background: 'linear-gradient(to right, #22c55e, #f59e0b, #ef4444)', accentColor: painColor(painLevel) }} />
                <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
                  {Array.from({ length: 10 }, (_, i) => <span key={i}>{i + 1}</span>)}
                </div>
              </div>
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('step3.duration')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {DURATION_KEYS.map((key) => (
                    <button key={key} onClick={() => setDuration(key)}
                      className="py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all"
                      style={{ borderColor: duration === key ? BRAND : '#e5e7eb', background: duration === key ? 'var(--tibbna-light)' : 'white', color: duration === key ? '#0e7490' : '#374151' }}>
                      {t(`durations.${key}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between mt-5">
                <button onClick={() => setStep(2)} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium text-sm transition-colors hover:bg-gray-200 dark:hover:bg-slate-600">
                  <span className="w-6 h-6 rounded-full bg-gray-300/60 dark:bg-slate-600 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M12 7H2M6 3L2 7l4 4" /></svg>
                  </span>
                  {t('buttons.back')}
                </button>
                <button onClick={() => setStep(4)} disabled={!duration} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: BRAND }}>
                  {t('buttons.next')}
                  <span className="w-6 h-6 rounded-full bg-white/20 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M2 7h10M8 3l4 4-4 4" /></svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">{t('step4.heading')}</h2>
              <p className="text-sm text-gray-500 mb-4">{t('step4.subtitle')}</p>
              <div className="space-y-3 mb-5">
                {QUESTION_KEYS.map((key) => {
                  const val = answers[key];
                  return (
                    <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <span className="text-sm text-gray-700 pe-4">{t(`questions.${key}`)}</span>
                      <div className="flex gap-2 shrink-0">
                        {([true, false] as const).map((v) => (
                          <button key={String(v)}
                            onClick={() => setAnswers((a) => ({ ...a, [key]: v }))}
                            className="px-3 py-1 rounded-lg text-sm font-medium border transition-all"
                            style={{
                              borderColor: val === v ? (v ? '#22c55e' : '#ef4444') : '#e5e7eb',
                              background: val === v ? (v ? '#f0fdf4' : '#fef2f2') : 'white',
                              color: val === v ? (v ? '#16a34a' : '#dc2626') : '#6b7280',
                            }}>
                            {v ? tCommon('yes') : tCommon('no')}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('step4.notes')} <span className="text-gray-400 font-normal">({t('step4.notesOptional')})</span>
                </label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('step4.notesPlaceholder')} className="input resize-none" rows={3} maxLength={500} />
              </div>
              <div className="flex justify-between mt-5">
                <button onClick={() => setStep(3)} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium text-sm transition-colors hover:bg-gray-200 dark:hover:bg-slate-600">
                  <span className="w-6 h-6 rounded-full bg-gray-300/60 dark:bg-slate-600 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M12 7H2M6 3L2 7l4 4" /></svg>
                  </span>
                  {t('buttons.back')}
                </button>
                <button onClick={() => setStep(5)} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80" style={{ background: BRAND }}>
                  {t('steps.review')}
                  <span className="w-6 h-6 rounded-full bg-white/20 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M2 7h10M8 3l4 4-4 4" /></svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">{t('step5.heading')}</h2>
              <div className="space-y-3 text-sm">
                <SummaryRow label={t('step5.affectedAreas')}>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {zones.map((id) => (
                      <span key={id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: BRAND }}>{getZoneLabel(id)}</span>
                    ))}
                  </div>
                </SummaryRow>
                <SummaryRow label={t('step5.symptoms')}>
                  <div className="flex flex-col gap-1.5 items-end">
                    {Object.entries(areaSymptoms).filter(([, syms]) => syms.length > 0).map(([group, syms]) => (
                      <div key={group} className="text-end">
                        {selectedGroups.length > 1 && (
                          <span className="text-[10px] text-gray-400 me-1">
                            {(tAreaSymptoms as (k: string) => string)(`${group}.label`)}:
                          </span>
                        )}
                        <span className="inline-flex flex-wrap gap-1 justify-end">
                          {syms.map(sym => (
                            <span key={sym} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              {(tAreaSymptoms as (k: string) => string)(`${group}.${sym}`)}
                            </span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </SummaryRow>
                <SummaryRow label={t('step5.painLevel')}>
                  <span className="font-bold text-base" style={{ color: painColor(painLevel) }}>{painLevel}/10 — {painLabel(painLevel)}</span>
                </SummaryRow>
                <SummaryRow label={t('step5.duration')}>
                  <span className="text-gray-700">{getDurationLabel(duration)}</span>
                </SummaryRow>
                {QUESTION_KEYS.map((key) => (
                  <SummaryRow key={key} label={t(`questions.${key}`)}>
                    <span style={{ color: answers[key] ? '#16a34a' : '#dc2626' }}>{answers[key] ? tCommon('yes') : tCommon('no')}</span>
                  </SummaryRow>
                ))}
                {notes && (
                  <SummaryRow label={t('step5.notes')}>
                    <span className="text-gray-600 text-xs max-w-[200px] text-end">{notes}</span>
                  </SummaryRow>
                )}
              </div>
              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(4)} className="btn-secondary">{t('buttons.edit')}</button>
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                  {submitting ? t('buttons.submitting') : t('buttons.submit')}
                </button>
              </div>
              {/* Placement 2 — Book a Doctor at end of diagnosis flow */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setBookStep5Open(o => !o)}
                  className="w-full flex items-center justify-between px-5 py-3 rounded-2xl text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <span className="flex items-center gap-2.5">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0" aria-hidden="true">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H9v-2h3v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
                    </svg>
                    {tBooking('bookDoctor')}
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`w-4 h-4 shrink-0 transition-transform ${bookStep5Open ? 'rotate-180' : ''}`} aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {bookStep5Open && <BookDoctorOptions />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Placement 1 — Book a Doctor above diagnoses/history */}
      <div className="mt-8 mb-5">
        <button
          type="button"
          onClick={() => setBookAboveOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80"
          style={{ background: 'var(--color-primary)' }}
        >
          <span className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0" aria-hidden="true">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H9v-2h3v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
            {tBooking('bookDoctor')}
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`w-4 h-4 shrink-0 transition-transform ${bookAboveOpen ? 'rotate-180' : ''}`} aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {bookAboveOpen && <BookDoctorOptions />}
      </div>

      {/* Pain History — collapsed by default, open on tap */}
      <div className="mt-0">
        {loadingHistory ? (
          <PageLoader />
        ) : !historyOpen ? (
          /* ── Collapsed: single entry button ─────────────────────── */
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl border bg-white dark:bg-slate-800 transition-all hover:border-[var(--color-primary)] hover:shadow-sm"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--tibbna-light)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </span>
              <span className="text-start min-w-0">
                <span className="block font-semibold text-sm" style={{ color: 'var(--color-heading)' }}>
                  {t('history.title')}{history.length > 0 ? ` (${history.length})` : ''}
                </span>
                <span className="block text-xs" style={{ color: 'var(--color-muted)' }}>
                  {history.length === 0 ? t('history.noRecords') : formatDateTime(history[0].recordedAt)}
                </span>
              </span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4 shrink-0 text-gray-300 rtl:rotate-180" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ) : (
          /* ── Open: header + records list ─────────────────────────── */
          <div>
            {/* Back header */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setHistoryOpen(false); setExpandedRecordId(null); }}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 shrink-0 transition-colors"
                aria-label="Close history"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="w-5 h-5 rtl:rotate-180" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <h3 className="font-semibold flex-1" style={{ color: 'var(--color-heading)' }}>
                {t('history.title')}
              </h3>
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{history.length}</span>
            </div>

            {/* Records list — newest first */}
            {history.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--color-muted)' }}>{t('history.noRecords')}</p>
            ) : (
              <div className="space-y-2">
                {history.map((rec) => {
                  const isExpanded = expandedRecordId === rec.id;
                  return (
                    <div key={rec.id} className="card overflow-hidden">
                      {/* Row — always visible */}
                      <button
                        type="button"
                        onClick={() => setExpandedRecordId(id => id === rec.id ? null : rec.id)}
                        className="w-full flex items-start gap-3 p-4 text-start hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ background: painColor(rec.painLevel) }}>
                          {rec.painLevel}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: painColor(rec.painLevel) }}>
                              {painLabel(rec.painLevel)}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{formatDateTime(rec.recordedAt)}</span>
                          </div>
                          <p className="text-sm mt-1 truncate" style={{ color: 'var(--color-heading)' }}>
                            {rec.zones.map((id) => getZoneLabel(id)).join(', ')}
                          </p>
                          {!isExpanded && rec.symptoms?.length > 0 && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>
                              {rec.symptoms.slice(0, 4).map((s) => getSymptomLabel(s)).join(' · ')}
                            </p>
                          )}
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className={`w-4 h-4 shrink-0 mt-1 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t px-4 pb-4 pt-3 space-y-3 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                          {/* Affected areas */}
                          <div>
                            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>{t('step5.affectedAreas')}</p>
                            <div className="flex flex-wrap gap-1">
                              {rec.zones.map((id) => (
                                <span key={id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: BRAND }}>{getZoneLabel(id)}</span>
                              ))}
                            </div>
                          </div>
                          {/* Symptoms */}
                          {rec.symptoms?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>{t('step5.symptoms')}</p>
                              {rec.areaSymptoms && Object.keys(rec.areaSymptoms).length > 0 ? (
                                <div className="space-y-1">
                                  {Object.entries(rec.areaSymptoms).filter(([, s]) => s.length > 0).map(([group, syms]) => (
                                    <div key={group} className="flex flex-wrap gap-1 items-center">
                                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: BRAND }}>
                                        {(tAreaSymptoms as (k: string) => string)(`${group}.label`)}
                                      </span>
                                      {syms.map(sym => (
                                        <span key={sym} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200">
                                          {(tAreaSymptoms as (k: string) => string)(`${group}.${sym}`)}
                                        </span>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {rec.symptoms.map((s) => (
                                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200">
                                      {getSymptomLabel(s)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {/* Pain level */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{t('step5.painLevel')}</span>
                            <span className="font-bold" style={{ color: painColor(rec.painLevel) }}>{rec.painLevel}/10 — {painLabel(rec.painLevel)}</span>
                          </div>
                          {/* Duration */}
                          {rec.duration && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{t('step5.duration')}</span>
                              <span style={{ color: 'var(--color-heading)' }}>{getDurationLabel(rec.duration)}</span>
                            </div>
                          )}
                          {/* Q&A — only show "Yes" answers to save space */}
                          {QUESTION_KEYS.filter(k => rec[k]).map((key) => (
                            <div key={key} className="flex items-center justify-between">
                              <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{t(`questions.${key}`)}</span>
                              <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>{tCommon('yes')}</span>
                            </div>
                          ))}
                          {/* Notes */}
                          {rec.notes && (
                            <div>
                              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>{t('step5.notes')}</p>
                              <p className="text-xs" style={{ color: 'var(--color-heading)' }}>{rec.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
