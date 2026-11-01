import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { publicPages } from './navigation';

export function RouteEffects() {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  const { t } = useTranslation();
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.getElementById('page-title')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  useEffect(() => {
    const page = publicPages.find((page) => pathname === `/${page}`);
    document.title = `${page ? t(`nav.${page}`) : pathname === '/' ? t('nav.home') : t('error.notFoundTitle')} · iAnalyze Academy`;
  }, [pathname, t]);
  return null;
}
