import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { publicPages } from './navigation';
import { usePortalCopy } from '@/features/portal/copy';

export function RouteEffects() {
  const { pathname, hash } = useLocation();
  const previousPath = useRef(pathname);
  const { t } = useTranslation();
  const { c } = usePortalCopy();
  useEffect(() => {
    if (previousPath.current === pathname + hash) return;
    previousPath.current = pathname + hash;
    const frame = requestAnimationFrame(() => {
      const anchor = hash ? document.getElementById(hash.slice(1)) : null;
      if (anchor) anchor.scrollIntoView({ behavior: 'instant', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
      const focusTarget = anchor ?? document.getElementById('page-title');
      if (anchor && !anchor.hasAttribute('tabindex')) anchor.tabIndex = -1;
      focusTarget?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  useEffect(() => {
    const page = publicPages.find((page) => pathname === `/${page}`);
    const portalTitles: Record<string, string> = {
      '/login': c.login,
      '/auth/callback': c.login,
      '/auth/recover': c.recover,
      '/auth/reset': c.reset,
      '/student': c.dashboard,
      '/workspace': c.team,
      '/privacy': c.privacy,
    };
    document.title = `${portalTitles[pathname] ?? (page ? t(`nav.${page}`) : pathname === '/' ? t('nav.home') : t('error.notFoundTitle'))} · iAnalyze Academy`;
  }, [pathname, t, c]);
  return null;
}
