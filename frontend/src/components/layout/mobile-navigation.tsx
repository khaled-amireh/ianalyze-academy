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
import { publicNavigation, secondaryNavigation } from '@/app/navigation';
import { MixedText } from '@/components/shared/mixed-text';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';

export function MobileNavigation() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const navigated = useRef(false);
  useEffect(() => {
    const desktop = matchMedia('(min-width:1120px)');
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
        aria-modal="true"
        closeLabel={t('common.close')}
        onCloseAutoFocus={(event) => {
          if (navigated.current) {
            event.preventDefault();
            navigated.current = false;
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('common.mobileTitle')}</DialogTitle>
          <DialogDescription>{t('common.mobileDescription')}</DialogDescription>
        </DialogHeader>
        <nav className="mobile-nav-links" aria-label={t('common.navigation')}>
          {[...publicNavigation, ...secondaryNavigation, { id: 'join', to: '/join' } as const].map(
            (item) => (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.to === '/'}
                onClick={() => {
                  navigated.current = true;
                  setOpen(false);
                }}
              >
                <MixedText>{t(`nav.${item.id}`)}</MixedText>
              </NavLink>
            ),
          )}
        </nav>
        <div className="mobile-preferences">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </DialogContent>
    </Dialog>
  );
}
