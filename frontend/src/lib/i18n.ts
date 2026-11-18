import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import assignmentAr from '@/locales/assignments.ar.json';
import assignmentEn from '@/locales/assignments.en.json';
import draftAr from '@/locales/drafts.ar.json';
import draftEn from '@/locales/drafts.en.json';
import { DEFAULT_LOCALE, LOCALE_KEY } from '@/app/config';
import { readPreference, savePreference } from '@/lib/preferences';
import { directionForLocale } from '@/lib/locale-direction';
import type { Locale } from '@/types/preferences';

export function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = directionForLocale(locale);
}

const locale = readPreference(LOCALE_KEY, ['ar', 'en'] as const, DEFAULT_LOCALE);
applyLocale(locale);
void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: { ...ar, assignments: assignmentAr, drafts: draftAr } },
    en: { translation: { ...en, assignments: assignmentEn, drafts: draftEn } },
  },
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
