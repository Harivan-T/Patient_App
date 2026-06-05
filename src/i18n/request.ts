import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  const validLocale = (locales as readonly string[]).includes(locale as string)
    ? (locale as Locale)
    : defaultLocale;

  return {
    locale: validLocale,
    messages: (await import(`./locales/${validLocale}/common.json`)).default,
  };
});
