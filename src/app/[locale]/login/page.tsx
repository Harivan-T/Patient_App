'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

type Step = 'credentials' | 'otp';

function validatePatientId(value: string): string {
  if (/[a-zA-Z]/.test(value)) return 'patientIdHasLetters';
  if (value.length > 12) return 'patientIdTooLong';
  if (value.length > 0 && value.length < 12) return 'patientIdTooShort';
  return '';
}

export default function LoginPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('login');
  const tc = useTranslations('common');
  const { locale } = params;

  const [step, setStep] = useState<Step>('credentials');
  const [patientId, setPatientId] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [idWarning, setIdWarning] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

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
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t(`errors.${data.error}` as never) || data.error);
        return;
      }
      if (data.devOtp) {
        setDevOtp(data.devOtp);
        setOtp(data.devOtp);
      }
      setStep('otp');
      setCountdown(60);
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
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'otpExpired') {
          setOtp('');
          setDevOtp('');
          setCountdown(0);
        }
        setError(t(`errors.${data.error}` as never) || data.error);
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
    setError('');
    setOtp('');
    setDevOtp('');
    setCountdown(60);
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, phone }),
    });
    const data = await res.json();
    if (data.devOtp) {
      setDevOtp(data.devOtp);
      setOtp(data.devOtp);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        {/* Logo — fade-in + scale on mount, pulse logo while loading */}
        <div className={`flex flex-col items-center mb-8 gap-2 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-95'
        }`}>
          <Image
            src="/tibbna-logo.png"
            alt="Tibbna"
            width={96}
            height={96}
            className={`object-contain transition-opacity duration-300 ${loading ? 'animate-pulse' : ''}`}
          />
          <h1 className="text-3xl font-bold tracking-wide" style={{ color: 'var(--color-primary)' }}>Tibbna</h1>
        </div>

        <div className="card p-8">
          {step === 'credentials' ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-2">{t('subtitle')}</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('patientId')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={patientId}
                  onChange={handlePatientIdChange}
                  onPaste={handlePatientIdPaste}
                  placeholder={t('patientIdPlaceholder')}
                  className={`input ${idWarning ? 'border-amber-500 focus:ring-amber-400' : ''}`}
                  maxLength={12}
                  required
                  autoComplete="off"
                />
                {idWarning && (
                  <p className="mt-1.5 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1">
                    <span>⚠</span>
                    {t(`errors.${idWarning}` as never)}
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
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="7XX XXX XXXX"
                    className="flex-1 px-3 py-2.5 bg-transparent text-sm focus:outline-none"
                    required
                    dir="ltr"
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
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="text-center mb-6">
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
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('otpPlaceholder')}
                className="input text-center text-3xl tracking-[0.5em] font-mono"
                maxLength={6}
                required
                dir="ltr"
                autoFocus
              />

              {error && (
                <div className={`text-sm rounded-lg px-3 py-2 ${
                  countdown === 0
                    ? 'text-amber-700 bg-amber-50 border border-amber-200'
                    : 'text-red-600 bg-red-50'
                }`}>
                  {error}
                  {countdown === 0 && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={loading}
                      className="block w-full mt-2 font-semibold underline underline-offset-2 text-center"
                      style={{ color: 'var(--color-primary)' }}
                    >
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
                  <span className="text-sm text-gray-500">
                    {t('resendIn', { seconds: countdown })}
                  </span>
                ) : !error ? (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-sm hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {t('resend')}
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setOtp(''); setError(''); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                ← {tc('back')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
