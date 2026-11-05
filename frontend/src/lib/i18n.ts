import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { DEFAULT_LOCALE, LOCALE_KEY } from '@/app/config';
import { readPreference, savePreference } from '@/lib/preferences';
import type { Locale } from '@/types/preferences';

// The page layout stays right-to-left in both languages so switching language
// only swaps the text. English paragraphs still read left-to-right through
// `unicode-bidi: plaintext` in styles/simplify.css.
export const LAYOUT_DIR = 'rtl';

export function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = LAYOUT_DIR;
}

const locale = readPreference(LOCALE_KEY, ['ar', 'en'] as const, DEFAULT_LOCALE);
applyLocale(locale);
void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: locale,
  fallbackLng: 'en',
  supportedLngs: ['ar', 'en'],
  initAsync: false,
  interpolation: { escapeValue: false },
});

export function changeLocale(next: Locale) {
  applyLocale(next);
  savePreference(LOCALE_KEY, next);
  void i18n.changeLanguage(next);
}
export default i18n;
