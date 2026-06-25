'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import enMsg from '@/i18n/locales/en/common.json';
import arMsg from '@/i18n/locales/ar/common.json';
import kuMsg from '@/i18n/locales/ku/common.json';

/* ── Types ───────────────────────────────────────────────────────────────── */
type Step   = 'splash' | 'language' | 'login' | 'otp';
type Locale = 'en' | 'ar' | 'ku';

/* ── Translations ─────────────────────────────────────────────────────────
   Import all locale files so the login form reflects the selected language,
   not the URL locale (which can't change mid-navigation without a reload). */
const MSG: Record<Locale, typeof enMsg> = { en: enMsg, ar: arMsg, ku: kuMsg };

function tl(
  locale: Locale,
  ns: 'login' | 'common',
  key: string,
  vars?: Record<string, string | number>,
): string {
  const section = MSG[locale][ns] as Record<string, unknown>;
  const val = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], section);
  let str = typeof val === 'string' ? val : key;
  if (vars) Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{{${k}}}`, String(v)); });
  return str;
}

/* ── Static data ─────────────────────────────────────────────────────────── */
const LANGUAGES: { code: Locale; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English',   dir: 'ltr' },
  { code: 'ku', label: 'کوردی',     dir: 'rtl' },
  { code: 'ar', label: 'العربية',   dir: 'rtl' },
];

function validatePatientId(v: string): string {
  if (/[a-zA-Z]/.test(v))          return 'patientIdHasLetters';
  if (v.length > 12)               return 'patientIdTooLong';
  if (v.length > 0 && v.length < 12) return 'patientIdTooShort';
  return '';
}

/* ── Timing ──────────────────────────────────────────────────────────────── */
const BG_WHITE = '#FFFFFF';
const BG_TEAL  = '#A7C8CF';
const BG_MS    = 700;   // background-color transition
const OUT_MS   = 320;   // content exit
const IN_DELAY = 40;    // pause before content enters

/* ════════════════════════════════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════════════════════════════════ */
export default function SplashPage({ params }: { params: { locale: string } }) {
  /* ── Step / locale ──────────────────────────────────────────────────────── */
  const [step, setStep]     = useState<Step>('splash');
  const [locale, setLocale] = useState<Locale>(
    (['en', 'ar', 'ku'].includes(params.locale) ? params.locale : 'en') as Locale,
  );
  const isRTL = locale === 'ar' || locale === 'ku';
  const t  = (key: string, vars?: Record<string, string | number>) => tl(locale, 'login',  key, vars);
  const tc = (key: string) => tl(locale, 'common', key);

  /* ── Entrance / transition state ─────────────────────────────────────────── */
  const [logoReady,     setLogoReady]     = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [reduced,       setReduced]       = useState(false);
  const advanced = useRef(false);

  /* ── Background color ────────────────────────────────────────────────────── */
  const [bgColor, setBgColor] = useState(BG_WHITE);

  /* ── Login form state ────────────────────────────────────────────────────── */
  const [patientId,  setPatientId]  = useState('');
  const [phone,      setPhone]      = useState('');
  const [otp,        setOtp]        = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [countdown,  setCountdown]  = useState(0);
  const [idWarning,  setIdWarning]  = useState('');
  const [devOtp,     setDevOtp]     = useState('');

  /* ── Countdown timer ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  /* ── Reduced-motion detection + white→teal transition ─────────────────── */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const r   = mq.matches;
    setReduced(r);
    if (r) { setBgColor(BG_TEAL); return; }
    const id = setTimeout(() => setBgColor(BG_TEAL), 50);
    return () => clearTimeout(id);
  }, []);

  /* ── Logo entrance (once) ────────────────────────────────────────────────── */
  useEffect(() => {
    const id = setTimeout(() => setLogoReady(true), 40);
    return () => clearTimeout(id);
  }, []);

  /* ── Auto-advance splash → language ────────────────────────────────────── */
  useEffect(() => {
    const id = setTimeout(advance, 1800);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function advance() {
    if (advanced.current) return;
    advanced.current = true;
    setStep('language');
    setTimeout(() => setContentVisible(true), 30);
  }

  /* ── Step transition helper ──────────────────────────────────────────────── */
  function goStep(next: Step, onSwitch?: () => void) {
    if (reduced) {
      onSwitch?.();
      setStep(next);
      setContentVisible(true);
      return;
    }
    setContentVisible(false);
    setTimeout(() => {
      onSwitch?.();
      setStep(next);
      setTimeout(() => setContentVisible(true), IN_DELAY);
    }, OUT_MS);
  }

  /* ── Language selection → login ─────────────────────────────────────────── */
  function selectLocale(code: Locale) {
    setLocale(code);
    goStep('login', () => setBgColor(BG_WHITE));
  }

  /* ── Login form handlers ─────────────────────────────────────────────────── */
  function handlePatientIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    setPatientId(raw);
    setIdWarning(validatePatientId(raw));
  }

  function handlePatientIdPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 12);
    setPatientId(pasted);
    setIdWarning(validatePatientId(pasted));
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const warn = validatePatientId(patientId);
    if (warn) { setIdWarning(warn); return; }
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(t(`errors.${data.error}`) || data.error); return; }
      if (data.devOtp) { setDevOtp(data.devOtp); setOtp(data.devOtp); }
      goStep('otp', () => setCountdown(60));
    } catch {
      setError(t('errors.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'otpExpired') { setOtp(''); setDevOtp(''); setCountdown(0); }
        setError(t(`errors.${data.error}`) || data.error);
        return;
      }
      window.location.href = `/${locale}/dashboard`;
    } catch {
      setError(t('errors.invalidOtp'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(''); setOtp(''); setDevOtp(''); setCountdown(60);
    const res  = await fetch('/api/auth/send-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, phone }),
    });
    const data = await res.json();
    if (data.devOtp) { setDevOtp(data.devOtp); setOtp(data.devOtp); }
  }

  /* ── Styles ──────────────────────────────────────────────────────────────── */
  const bgStyle: React.CSSProperties = {
    background: bgColor,
    transition: reduced ? 'none' : `background-color ${BG_MS}ms ease-in-out`,
  };

  // Content fades + gently rises in, fades out on exit.
  const contentStyle: React.CSSProperties = reduced ? {} : {
    transition:  `opacity ${contentVisible ? 450 : OUT_MS}ms ease-out, transform ${contentVisible ? 450 : OUT_MS}ms ease-out`,
    opacity:     contentVisible ? 1 : 0,
    transform:   contentVisible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.98)',
    pointerEvents: contentVisible ? 'auto' : 'none',
  };

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    // pt-[22vh] anchors the logo at a fixed vertical position regardless of
    // how tall the content below it grows — logo never shifts during transitions.
    <div
      className="min-h-screen overflow-y-auto flex flex-col items-center"
      style={{ ...bgStyle, paddingTop: 'max(12vh, 32px)', paddingBottom: '32px' }}
      onClick={step === 'splash' ? advance : undefined}
    >
      {/* ── PERSISTENT LOGO — mounts once, never re-animates ─────────────── */}
      <div className={`flex flex-col items-center gap-2 select-none transition-all duration-700 ease-out ${
        logoReady ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-95'
      }`}>
        <Image
          src="/tibbna-logo.png"
          alt="Tibbna"
          width={120}
          height={120}
          priority
          className={`object-contain ${step === 'splash' ? 'animate-pulse' : ''}`}
        />
        <h1 className="text-3xl font-bold tracking-wide" style={{ color: 'var(--color-primary)' }}>
          Tibbna
        </h1>
      </div>

      {/* ── STEP CONTENT — fades in/out on each transition ───────────────── */}
      <div className="mt-8 w-full max-w-sm px-4" style={contentStyle}>

        {/* Language buttons */}
        {step === 'language' && (
          <div className="flex flex-col gap-3">
            {LANGUAGES.map(({ code, label, dir }) => (
              <button
                key={code}
                dir={dir}
                onClick={() => selectLocale(code)}
                className="w-full py-3 px-5 rounded-xl text-base font-semibold border-2
                           bg-white dark:bg-slate-800
                           border-[var(--color-border)] dark:border-slate-600
                           text-gray-800 dark:text-gray-100
                           hover:border-[var(--color-primary)] hover:bg-[var(--tibbna-light)]
                           hover:text-[var(--color-primary)]
                           active:scale-95 transition-all duration-150"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Login form */}
        {step === 'login' && (
          <div className="card p-7" dir={isRTL ? 'rtl' : 'ltr'}>
            <form onSubmit={handleSendOtp} className="space-y-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                {t('subtitle')}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('patientId')}
                </label>
                <input
                  type="text" inputMode="numeric"
                  value={patientId}
                  onChange={handlePatientIdChange}
                  onPaste={handlePatientIdPaste}
                  placeholder={t('patientIdPlaceholder')}
                  className={`input ${idWarning ? 'border-amber-500 focus:ring-amber-400' : ''}`}
                  maxLength={12} required autoComplete="off"
                />
                {idWarning && (
                  <p className="mt-1.5 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1">
                    <span>⚠</span>{t(`errors.${idWarning}`)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('phone')}
                </label>
                <div className="flex input p-0 overflow-hidden">
                  <span className="flex items-center px-3 bg-gray-50 dark:bg-slate-700 border-e border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 text-sm font-medium shrink-0">
                    +964
                  </span>
                  <input
                    type="tel" value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="7XX XXX XXXX"
                    className="flex-1 px-3 py-2.5 bg-transparent text-sm focus:outline-none"
                    required dir="ltr"
                  />
                </div>
              </div>
              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? t('sending') : t('title')}
              </button>
            </form>
          </div>
        )}

        {/* OTP form */}
        {step === 'otp' && (
          <div className="card p-7" dir={isRTL ? 'rtl' : 'ltr'}>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('otpTitle')}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('otpSubtitle')}</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">{phone}</p>
              </div>
              {devOtp && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600 rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">
                    DEV MODE — Code not sent via SMS
                  </p>
                  <p className="text-3xl font-mono font-bold tracking-[0.4em] text-amber-800 dark:text-amber-300">
                    {devOtp}
                  </p>
                </div>
              )}
              <input
                type="text" inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('otpPlaceholder')}
                className="input text-center text-3xl tracking-[0.5em] font-mono"
                maxLength={6} required dir="ltr" autoFocus
              />
              {error && (
                <div className={`text-sm rounded-lg px-3 py-2 ${
                  countdown === 0
                    ? 'text-amber-700 bg-amber-50 border border-amber-200'
                    : 'text-red-600 bg-red-50'
                }`}>
                  {error}
                  {countdown === 0 && (
                    <button type="button" onClick={handleResend} disabled={loading}
                      className="block w-full mt-2 font-semibold underline underline-offset-2 text-center"
                      style={{ color: 'var(--color-primary)' }}>
                      {t('resend')}
                    </button>
                  )}
                </div>
              )}
              <button type="submit" disabled={loading || otp.length < 6} className="btn-primary w-full">
                {loading ? t('verifying') : t('verify')}
              </button>
              <div className="text-center">
                {countdown > 0 ? (
                  <span className="text-sm text-gray-500">{t('resendIn', { seconds: countdown })}</span>
                ) : !error ? (
                  <button type="button" onClick={handleResend} className="text-sm hover:underline"
                    style={{ color: 'var(--color-primary)' }}>
                    {t('resend')}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => goStep('login', () => { setOtp(''); setError(''); })}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                ← {tc('back')}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
