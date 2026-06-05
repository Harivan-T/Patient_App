export const locales = ['en', 'ar', 'ku'] as const;
export const defaultLocale = 'en' as const;
export const rtlLocales = ['ar', 'ku'] as const;

export type Locale = (typeof locales)[number];

export function isRTL(locale: string): boolean {
  return (rtlLocales as readonly string[]).includes(locale);
}
