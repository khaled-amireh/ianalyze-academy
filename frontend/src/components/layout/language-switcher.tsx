import { useTranslation } from 'react-i18next';
import { changeLocale } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <div className="language-switcher" role="group" dir="ltr" aria-label={t('common.language')}>
      {(['ar', 'en'] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => changeLocale(locale)}
          aria-pressed={i18n.resolvedLanguage === locale}
          aria-label={t(locale === 'ar' ? 'common.arabic' : 'common.english')}
          lang={locale}
          dir="ltr"
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
