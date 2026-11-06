import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { DEV_PREVIEWS } from '@/app/config';
import { PageContainer } from '@/components/shared/page-container';
import { MixedText } from '@/components/shared/mixed-text';
import { ParentLogo } from './brand-logo';
import { SocialLinks } from '@/components/shared/academy-content';
import { JoinNavigation } from '@/features/portal/account-navigation';

export function Footer() {
  const { t, i18n } = useTranslation();
  return (
    <footer className="site-footer" dir={i18n.resolvedLanguage === 'ar' ? 'rtl' : 'ltr'}>
      <PageContainer>
        <div className="footer-grid">
          <div>
            <Link className="footer-title" to="/">
              <MixedText>{t('brand.name')}</MixedText>
            </Link>
            <p>
              <MixedText>{t('brand.description')}</MixedText>
            </p>
            <p className="text-sm">{t('brand.university')}</p>
          </div>
          <nav aria-label={t('common.footerNavigation')}>
            {(['about', 'join', 'leaderboard', 'contact'] as const).map((key) =>
              key === 'join' ? (
                <JoinNavigation key={key} />
              ) : (
                <Link to={`/${key}`} key={key}>
                  <MixedText>{t(`nav.${key}`)}</MixedText>
                </Link>
              ),
            )}
          </nav>
          <div>
            <ParentLogo transparent />
            <p>
              <MixedText>{t('brand.initiative')}</MixedText>
            </p>
            <p className="text-sm">{t('common.contactPending')}</p>
            <SocialLinks />
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            <MixedText>{t('common.footerNote')}</MixedText>
          </span>
          {DEV_PREVIEWS && <Link to="/_preview/components">{t('common.devLink')}</Link>}
        </div>
      </PageContainer>
    </footer>
  );
}
