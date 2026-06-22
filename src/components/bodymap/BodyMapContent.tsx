'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { BookDoctorOptions } from '@/components/ui/BookDoctorOptions';
import { Body3DSelector } from '@/components/body3d/Body3DSelector';

interface PainRecord {
  id: string;
  zones: string[];
  symptoms: string[];
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

const SYMPTOM_KEYS  = ['pain', 'burning', 'swelling', 'numbness', 'stiffness', 'tingling', 'pressure', 'throbbing'] as const;
const DURATION_KEYS = ['today', 'fewDays', 'oneToTwoWeeks', 'oneMonth', 'threeMonths', 'overYear'] as const;
const QUESTION_KEYS = ['movementPain', 'nightPain', 'takingMedication', 'hasFever'] as const;

// Converts SVG-era dash IDs ("l-shoulder", "head-b") → translation keys ("l_shoulder", "head")
// Also passes through 3D mesh keys ("arm_left") unchanged
function zoneKey(id: string): string {
  return id.replace(/-b$/, '').replace(/-/g, '_');
}

function painColor(level: number): string {
  if (level <= 3) return '#22c55e';
  if (level <= 6) return '#f59e0b';
  return '#ef4444';
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
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

// ── Main component ────────────────────────────────────────────────────────────

export function BodyMapContent() {
  const t        = useTranslations('bodymap');
  const tCommon  = useTranslations('common');
  const tBooking = useTranslations('booking');

  const [step, setStep]         = useState(1);
  const [zones, setZones]       = useState<string[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [painLevel, setPainLevel] = useState(5);
  const [duration, setDuration] = useState('');
  const [answers, setAnswers]   = useState({
    movementPain: false, nightPain: false, takingMedication: false, hasFever: false,
  });
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [history, setHistory]       = useState<PainRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [bookStep5Open, setBookStep5Open]   = useState(false);
  const [bookHistoryOpen, setBookHistoryOpen] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getZoneLabel(id: string): string {
    return t(`zones.${zoneKey(id)}` as Parameters<typeof t>[0]);
  }

  function painLabel(level: number): string {
    if (level <= 3) return t('pain.mild');
    if (level <= 6) return t('pain.moderate');
    return t('pain.severe');
  }

  function getSymptomLabel(key: string): string {
    return t(`symptoms.${key.toLowerCase()}` as Parameters<typeof t>[0]);
  }

  function getDurationLabel(key: string): string {
    return t(`durations.${key}` as Parameters<typeof t>[0]);
  }

  function toggleZone(id: string) {
    setZones((prev) => prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]);
  }

  function toggleSymptom(key: string) {
    setSymptoms((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/pain-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones, symptoms, painLevel, duration, ...answers, notes }),
      });
      if (res.ok) { setSubmitted(true); loadHistory(); }
    } finally { setSubmitting(false); }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res  = await fetch('/api/pain-record');
      const data = await res.json();
      setHistory(data.records ?? []);
    } finally { setLoadingHistory(false); }
  }

  useEffect(() => { loadHistory(); }, []);

  function resetForm() {
    setStep(1); setZones([]); setSymptoms([]);
    setPainLevel(5); setDuration(''); setNotes('');
    setAnswers({ movementPain: false, nightPain: false, takingMedication: false, hasFever: false });
    setSubmitted(false);
    setBookStep5Open(false);
    setBookHistoryOpen(false);
  }

  const STEP_LABELS = [
    t('steps.zones'), t('steps.symptoms'), t('steps.painScale'),
    t('steps.questions'), t('steps.review'),
  ];

  // ── Shared nav button atoms ───────────────────────────────────────────────

  const NextBtn = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: BRAND }}
    >
      {t('buttons.next')}
      <span className="w-6 h-6 rounded-full bg-white/20 inline-flex items-center justify-center shrink-0" aria-hidden>
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180">
          <path d="M2 7h10M8 3l4 4-4 4" />
        </svg>
      </span>
    </button>
  );

  const BackBtn = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium text-sm transition-colors hover:bg-gray-200 dark:hover:bg-slate-600"
    >
      <span className="w-6 h-6 rounded-full bg-gray-300/60 dark:bg-slate-600 inline-flex items-center justify-center shrink-0" aria-hidden>
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180">
          <path d="M12 7H2M6 3L2 7l4 4" />
        </svg>
      </span>
      {t('buttons.back')}
    </button>
  );

  // ── Render ────────────────────────────────────────────────────────────────

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
          {/* Step progress bar */}
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

          {/* ── STEP 1 — 3D body selector ──────────────────────────────── */}
          {step === 1 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">{t('step1.heading')}</h2>
              <p className="text-sm text-gray-500 mb-4">{t('step1.subtitle')}</p>
              <Body3DSelector selected={zones} onToggle={toggleZone} />
              <div className="flex justify-end mt-5">
                <NextBtn onClick={() => setStep(2)} disabled={zones.length === 0} />
              </div>
            </div>
          )}

          {/* ── STEP 2 — Symptoms ─────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">{t('step2.heading')}</h2>
              <p className="text-sm text-gray-500 mb-4">{t('step2.subtitle')}</p>
              <div className="grid grid-cols-2 gap-2">
                {SYMPTOM_KEYS.map((key) => {
                  const active = symptoms.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSymptom(key)}
                      className="py-3 px-4 rounded-xl border-2 text-sm font-medium text-start transition-all"
                      style={{
                        borderColor: active ? BRAND : '#e5e7eb',
                        background: active ? 'var(--tibbna-light)' : 'white',
                        color: active ? '#0e7490' : '#374151',
                      }}
                    >
                      {t(`symptoms.${key}`)}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between mt-5">
                <BackBtn onClick={() => setStep(1)} />
                <NextBtn onClick={() => setStep(3)} disabled={symptoms.length === 0} />
              </div>
            </div>
          )}

          {/* ── STEP 3 — Pain scale + duration ────────────────────────── */}
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
                <input
                  type="range" min="1" max="10" value={painLevel}
                  onChange={(e) => setPainLevel(Number(e.target.value))}
                  className="w-full h-3 rounded-full appearance-none cursor-pointer"
                  style={{ background: 'linear-gradient(to right, #22c55e, #f59e0b, #ef4444)', accentColor: painColor(painLevel) }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
                  {Array.from({ length: 10 }, (_, i) => <span key={i}>{i + 1}</span>)}
                </div>
              </div>
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('step3.duration')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {DURATION_KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={() => setDuration(key)}
                      className="py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all"
                      style={{
                        borderColor: duration === key ? BRAND : '#e5e7eb',
                        background: duration === key ? 'var(--tibbna-light)' : 'white',
                        color: duration === key ? '#0e7490' : '#374151',
                      }}
                    >
                      {t(`durations.${key}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between mt-5">
                <BackBtn onClick={() => setStep(2)} />
                <NextBtn onClick={() => setStep(4)} disabled={!duration} />
              </div>
            </div>
          )}

          {/* ── STEP 4 — Yes/No questions + notes ─────────────────────── */}
          {step === 4 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">{t('step4.heading')}</h2>
              <p className="text-sm text-gray-500 mb-4">{t('step4.subtitle')}</p>
              <div className="space-y-3 mb-5">
                {QUESTION_KEYS.map((key) => {
                  const val = answers[key];
                  return (
                    <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-border bg-gray-50 dark:bg-slate-700/40 dark:border-slate-600">
                      <span className="text-sm text-gray-700 pe-4">{t(`questions.${key}`)}</span>
                      <div className="flex gap-2 shrink-0">
                        {([true, false] as const).map((v) => (
                          <button
                            key={String(v)}
                            onClick={() => setAnswers((a) => ({ ...a, [key]: v }))}
                            className="px-3 py-1 rounded-lg text-sm font-medium border transition-all"
                            style={{
                              borderColor: val === v ? (v ? '#22c55e' : '#ef4444') : '#e5e7eb',
                              background: val === v ? (v ? '#f0fdf4' : '#fef2f2') : 'white',
                              color: val === v ? (v ? '#16a34a' : '#dc2626') : '#6b7280',
                            }}
                          >
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
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('step4.notesPlaceholder')}
                  className="input resize-none"
                  rows={3}
                  maxLength={500}
                />
              </div>
              <div className="flex justify-between mt-5">
                <BackBtn onClick={() => setStep(3)} />
                <button
                  onClick={() => setStep(5)}
                  className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80"
                  style={{ background: BRAND }}
                >
                  {t('steps.review')}
                  <span className="w-6 h-6 rounded-full bg-white/20 inline-flex items-center justify-center shrink-0" aria-hidden>
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180">
                      <path d="M2 7h10M8 3l4 4-4 4" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 5 — Review + submit ───────────────────────────────── */}
          {step === 5 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">{t('step5.heading')}</h2>
              <div className="space-y-3 text-sm">
                <SummaryRow label={t('step5.affectedAreas')}>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {zones.map((id) => (
                      <span key={id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: BRAND }}>
                        {getZoneLabel(id)}
                      </span>
                    ))}
                  </div>
                </SummaryRow>
                <SummaryRow label={t('step5.symptoms')}>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {symptoms.map((key) => (
                      <span key={key} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {getSymptomLabel(key)}
                      </span>
                    ))}
                  </div>
                </SummaryRow>
                <SummaryRow label={t('step5.painLevel')}>
                  <span className="font-bold text-base" style={{ color: painColor(painLevel) }}>
                    {painLevel}/10 — {painLabel(painLevel)}
                  </span>
                </SummaryRow>
                <SummaryRow label={t('step5.duration')}>
                  <span className="text-gray-700">{getDurationLabel(duration)}</span>
                </SummaryRow>
                {QUESTION_KEYS.map((key) => (
                  <SummaryRow key={key} label={t(`questions.${key}`)}>
                    <span style={{ color: answers[key] ? '#16a34a' : '#dc2626' }}>
                      {answers[key] ? tCommon('yes') : tCommon('no')}
                    </span>
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
                  {submitting ? t('buttons.submitting') : tBooking('submitRecord')}
                </button>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setBookStep5Open((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors"
                  style={{
                    borderColor: bookStep5Open ? 'var(--color-primary)' : 'var(--color-border)',
                    color: 'var(--color-primary)',
                    background: bookStep5Open ? 'var(--tibbna-light)' : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
                    </svg>
                    {tBooking('bookDoctor')}
                  </div>
                  <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 shrink-0 transition-transform ${bookStep5Open ? 'rotate-180' : ''}`}>
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                  </svg>
                </button>
                {bookStep5Open && <BookDoctorOptions />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Book a Doctor toggle (above pain history) ──────────────────────── */}
      <div className="mt-8">
        <button
          type="button"
          onClick={() => setBookHistoryOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 mb-5 rounded-xl border text-sm font-semibold transition-colors"
          style={{
            borderColor: bookHistoryOpen ? 'var(--color-primary)' : 'var(--color-border)',
            color: 'var(--color-primary)',
            background: bookHistoryOpen ? 'var(--tibbna-light)' : 'white',
          }}
        >
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
            </svg>
            {tBooking('bookDoctor')}
          </div>
          <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 shrink-0 transition-transform ${bookHistoryOpen ? 'rotate-180' : ''}`}>
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
        </button>
        {bookHistoryOpen && <BookDoctorOptions />}

        {/* ── Pain history ─────────────────────────────────────────────── */}
        <h3 className="font-semibold text-gray-900 mb-3">{t('history.title')}</h3>
        {loadingHistory ? (
          <PageLoader />
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('history.noRecords')}</p>
        ) : (
          <div className="space-y-2">
            {history.map((rec) => (
              <div key={rec.id} className="card p-4 flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: painColor(rec.painLevel) }}
                >
                  {rec.painLevel}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: painColor(rec.painLevel) }}>
                      {painLabel(rec.painLevel)}
                    </span>
                    <span className="text-xs text-gray-400">{formatDateTime(rec.recordedAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 truncate">
                    {rec.zones.map((id) => getZoneLabel(id)).join(', ')}
                  </p>
                  {rec.symptoms?.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {rec.symptoms.map((s) => getSymptomLabel(s)).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
