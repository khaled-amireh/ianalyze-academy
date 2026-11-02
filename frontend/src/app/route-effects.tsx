import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { publicPages } from './navigation';

export function RouteEffects() {
  const { pathname, hash } = useLocation();
  const previousPath = useRef(pathname);
  const { t } = useTranslation();
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
    document.title = `${page ? t(`nav.${page}`) : pathname === '/' ? t('nav.home') : t('error.notFoundTitle')} · iAnalyze Academy`;
  }, [pathname, t]);
  return null;
}
