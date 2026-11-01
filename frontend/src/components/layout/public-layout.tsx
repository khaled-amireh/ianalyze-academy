import { Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Navbar } from './navbar';
import { Footer } from './footer';

export function PublicLayout() {
  const { t } = useTranslation();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t('common.skip')}
      </a>
      <Navbar />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
