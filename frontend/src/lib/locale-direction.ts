import type { Locale } from '@/types/preferences';

export type TextDirection = 'ltr' | 'rtl';

export function directionForLocale(locale: Locale): TextDirection {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
