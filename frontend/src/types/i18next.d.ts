import 'i18next';
import type en from '@/locales/en.json';
import type preview from '@/dev/locales/en.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    strictKeyChecks: true;
    resources: { translation: typeof en; preview: typeof preview };
  }
}
