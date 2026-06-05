'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function handlePatientIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setPatientId(raw);
    setIdWarning(validatePatientId(raw));
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
      router.push(`/${locale}/profile`);
      router.refresh();
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #EDF8FC 0%, #f0f9ff 60%, #fefce8 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-1">
          <Image
            src="/tibbna-logo.png"
            alt="Tibbna"
            width={72}
            height={72}
            className="object-contain"
          />
          <h1 className="text-2xl font-bold tracking-wide" style={{ color: '#6BC9E4' }}>Tibbna</h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 'credentials' ? t('subtitle') : t('otpSubtitle')}
          </p>
        </div>

        <div className="card p-8">
          {step === 'credentials' ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <h2 className="text-xl font-semibold text-center text-gray-900 mb-6">{t('title')}</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('patientId')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={patientId}
                  onChange={handlePatientIdChange}
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
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('phonePlaceholder')}
                  className="input"
                  required
                  dir="ltr"
                />
              </div>

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? t('sending') : t('sendOtp')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <h2 className="text-xl font-semibold text-center text-gray-900 mb-2">{t('otpTitle')}</h2>
              <p className="text-center text-sm text-gray-500 mb-6">{phone}</p>

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
                      style={{ color: '#6BC9E4' }}
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
                    style={{ color: '#6BC9E4' }}
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
