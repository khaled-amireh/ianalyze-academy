import 'i18next';
import type en from '@/locales/en.json';
import type preview from '@/dev/locales/en.json';
import type assignments from '@/locales/assignments.en.json';
import type drafts from '@/locales/drafts.en.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    strictKeyChecks: true;
    resources: {
      translation: typeof en & { assignments: typeof assignments; drafts: typeof drafts };
      preview: typeof preview;
    };
  }
}
