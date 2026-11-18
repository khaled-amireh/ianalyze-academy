export type TextDirection = 'ltr' | 'rtl';

export function directionForLocale(locale: 'ar' | 'en'): TextDirection {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
