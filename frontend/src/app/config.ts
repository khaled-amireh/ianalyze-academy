import type { Locale, Theme } from '../types/preferences.ts';

export const DEFAULT_LOCALE: Locale = 'ar';
export const DEFAULT_THEME: Theme = 'light';
export const LOCALE_KEY = 'ianalyze.language';
export const THEME_KEY = 'ianalyze.theme';
export const DEV_PREVIEWS =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_PREVIEWS === 'true';
