import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Inter } from 'next/font/google';
import { locales, isRTL, type Locale } from '@/i18n/config';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  if (!(locales as readonly string[]).includes(locale)) notFound();

  const messages = await getMessages();
  const dir = isRTL(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint — prevents the light flash
            for dark-mode users. Mirrors applyTheme() in settings/profile. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('hp-theme');if(t==='dark'||(t!=='light'&&t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} min-h-screen bg-background text-foreground font-sans antialiased`}>
        <NextIntlClientProvider locale={locale as Locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
