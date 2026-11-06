import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { publicNavigation } from '@/app/navigation';
import { MixedText } from '@/components/shared/mixed-text';
import { PageContainer } from '@/components/shared/page-container';
import { BrandLogo } from './brand-logo';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';
import { MobileNavigation } from './mobile-navigation';
import {
  JoinNavigation,
  ProfileNavigation,
  NotificationBell,
} from '@/features/portal/account-navigation';
import { AccountLink } from '@/features/portal/auth-pages';

export function Navbar() {
  const { t, i18n } = useTranslation();
  const direction = i18n.resolvedLanguage === 'ar' ? 'rtl' : 'ltr';
  return (
    <>
      <header className="site-header">
        <PageContainer className="navbar-inner">
          <BrandLogo />
          <nav className="desktop-nav" dir={direction} aria-label={t('common.navigation')}>
            {publicNavigation.map((item) => (
              <NavLink key={item.id} to={item.to} end={item.to === '/'}>
                <MixedText>{t(`nav.${item.id}`)}</MixedText>
              </NavLink>
            ))}
          </nav>
          <div className="header-actions" dir={direction}>
            <AccountLink className="header-account navigation-login" />
            <div className="header-preferences">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            <ProfileNavigation />
            <NotificationBell />
            <JoinNavigation className="desktop-join navigation-join" />
            <MobileNavigation />
          </div>
        </PageContainer>
      </header>
    </>
  );
}
