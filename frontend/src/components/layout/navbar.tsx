import { Link, NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { publicNavigation } from '@/app/navigation';
import { Button } from '@/components/ui/button';
import { MixedText } from '@/components/shared/mixed-text';
import { PageContainer } from '@/components/shared/page-container';
import { BrandLogo } from './brand-logo';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';
import { MobileNavigation } from './mobile-navigation';

export function Navbar() {
  const { t } = useTranslation();
  return (
    <>
      <header className="site-header">
        <PageContainer className="navbar-inner">
          <BrandLogo />
          <nav className="desktop-nav" aria-label={t('common.navigation')}>
            {publicNavigation.map((item) => (
              <NavLink key={item.id} to={item.to} end={item.to === '/'}>
                <MixedText>{t(`nav.${item.id}`)}</MixedText>
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <div className="header-preferences">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            <Button asChild className="desktop-join" size="sm">
              <Link to="/join">
                <span>
                  <MixedText>{t('nav.join')}</MixedText>
                </span>
                <ArrowRight className="directional" aria-hidden="true" />
              </Link>
            </Button>
            <MobileNavigation />
          </div>
        </PageContainer>
      </header>
    </>
  );
}
