'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

type Step = 'splash' | 'language';

const LANGUAGES = [
  { code: 'en', label: 'English',   dir: 'ltr' as const },
  { code: 'ku', label: 'کوردی',     dir: 'rtl' as const },
  { code: 'ar', label: 'العربية',   dir: 'rtl' as const },
];

export default function SplashPage() {
  const [step, setStep]           = useState<Step>('splash');
  const [logoReady, setLogoReady] = useState(false);
  const [langReady, setLangReady] = useState(false);
  const advanced                  = useRef(false);

  // Trigger fade-in on first paint
  useEffect(() => {
    const t = setTimeout(() => setLogoReady(true), 40);
    return () => clearTimeout(t);
  }, []);

  // Auto-advance after 1.8 s
  useEffect(() => {
    const t = setTimeout(advance, 1800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function advance() {
    if (advanced.current) return;
    advanced.current = true;
    setStep('language');
    setTimeout(() => setLangReady(true), 60);
  }

  function selectLocale(code: string) {
    window.location.href = `/${code}/login`;
  }

  const bg = "min-h-screen flex items-center justify-center";
  const bgStyle = { background: 'linear-gradient(135deg, var(--tibbna-light) 0%, #f0f9ff 60%, #fefce8 100%)' };

  /* ── Splash ── */
  if (step === 'splash') {
    return (
      <div className={bg} style={bgStyle} onClick={advance}>
        <div className={`flex flex-col items-center gap-3 select-none transition-all duration-700 ease-out ${
          logoReady ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-95'
        }`}>
          <Image
            src="/tibbna-logo.png"
            alt="Tibbna"
            width={100}
            height={100}
            priority
            className="object-contain animate-pulse"
          />
          <h1 className="text-3xl font-bold tracking-wide" style={{ color: 'var(--color-primary)' }}>
            Tibbna
          </h1>
        </div>
      </div>
    );
  }

  /* ── Language select ── */
  return (
    <div className={bg} style={bgStyle}>
      <div className={`flex flex-col items-center gap-8 w-full max-w-xs px-6 transition-all duration-500 ease-out ${
        langReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
      }`}>
        {/* Mini logo */}
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/tibbna-logo.png"
            alt="Tibbna"
            width={64}
            height={64}
            className="object-contain"
          />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>Tibbna</h1>
        </div>

        {/* Language buttons */}
        <div className="w-full flex flex-col gap-3">
          {LANGUAGES.map(({ code, label, dir }) => (
            <button
              key={code}
              dir={dir}
              onClick={() => selectLocale(code)}
              className="w-full py-4 px-6 rounded-2xl text-xl font-semibold border-2
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
      </div>
    </div>
  );
}
