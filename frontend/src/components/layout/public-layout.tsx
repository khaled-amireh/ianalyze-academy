import { Outlet } from 'react-router';
import { Suspense } from 'react';
import { RouteEffects } from '@/app/route-effects';
import { LoadingIndicator } from '@/components/shared/loading-indicator';
import { useTranslation } from 'react-i18next';
import { Navbar } from './navbar';
import { Footer } from './footer';
import { PageTransition } from './page-transition';

export function PublicLayout() {
  const { t } = useTranslation();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t('common.skip')}
      </a>
      <Navbar />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<LoadingIndicator />}>
          <RouteEffects />
          <PageTransition>
            <Outlet />
          </PageTransition>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
