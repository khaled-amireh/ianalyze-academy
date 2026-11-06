import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DESKTOP_NAV_QUERY, publicNavigation, secondaryNavigation } from '@/app/navigation';
import { MixedText } from '@/components/shared/mixed-text';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';
import { JoinNavigation } from '@/features/portal/account-navigation';
import { AccountLink } from '@/features/portal/auth-pages';

export function MobileNavigation() {
  const { t, i18n } = useTranslation();
  const direction = i18n.resolvedLanguage === 'ar' ? 'rtl' : 'ltr';
  const [open, setOpen] = useState(false);
  const navigated = useRef(false);
  useEffect(() => {
    const desktop = matchMedia(DESKTOP_NAV_QUERY);
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="mobile-menu-trigger"
          aria-label={t('common.menu')}
        >
          <Menu aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="mobile-dialog"
        dir="rtl"
        aria-modal="true"
        closeLabel={t('common.close')}
        onCloseAutoFocus={(event) => {
          if (navigated.current) {
            event.preventDefault();
            navigated.current = false;
          }
        }}
      >
        <DialogHeader dir={direction}>
          <DialogTitle>{t('common.mobileTitle')}</DialogTitle>
          <DialogDescription>{t('common.mobileDescription')}</DialogDescription>
        </DialogHeader>
        <nav className="mobile-nav-links" aria-label={t('common.navigation')}>
          <AccountLink
            className="navigation-login"
            onNavigate={() => {
              navigated.current = true;
              setOpen(false);
            }}
          />
          {[...publicNavigation, ...secondaryNavigation].map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              dir={direction}
              end={item.to === '/'}
              onClick={() => {
                navigated.current = true;
                setOpen(false);
              }}
            >
              <MixedText>{t(`nav.${item.id}`)}</MixedText>
            </NavLink>
          ))}
          <JoinNavigation
            className="navigation-join"
            onNavigate={() => {
              navigated.current = true;
              setOpen(false);
            }}
          />
        </nav>
        <div className="mobile-preferences" dir="ltr">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </DialogContent>
    </Dialog>
  );
}
