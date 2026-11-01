import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FlaskConical } from 'lucide-react';
import i18n from '@/lib/i18n';
import ar from './locales/ar.json';
import en from './locales/en.json';
import { ComponentGallery } from './component-gallery';
import { StudentFoundation } from '@/pages/student/student-foundation';
import { OrganizerFoundation } from '@/pages/organizer/organizer-foundation';
import { AdminFoundation } from '@/pages/admin/admin-foundation';
import { NotFoundPage } from '@/pages/public/not-found-page';
import { PageContainer } from '@/components/shared/page-container';

i18n.addResourceBundle('ar', 'preview', ar, true, true);
i18n.addResourceBundle('en', 'preview', en, true, true);
function DevelopmentLayout() {
  const { t } = useTranslation('preview');
  return (
    <PageContainer className="development-preview" data-preview="IANALYZE_DEV_ONLY_01">
      <div className="dev-notice" role="note">
        <FlaskConical aria-hidden="true" />
        <p>{t('notice')}</p>
      </div>
      <nav className="preview-tabs" aria-label={t('components.eyebrow')}>
        {(['components', 'student', 'organizer', 'admin'] as const).map((tab) => (
          <NavLink key={tab} to={`/_preview/${tab}`}>
            {t(`tabs.${tab}`)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </PageContainer>
  );
}
export default function DevelopmentRoutes() {
  return (
    <Routes>
      <Route element={<DevelopmentLayout />}>
        <Route index element={<Navigate to="components" replace />} />
        <Route path="components" element={<ComponentGallery />} />
        <Route path="student/:section?" element={<StudentFoundation />} />
        <Route path="organizer/:section?" element={<OrganizerFoundation />} />
        <Route path="admin/:section?" element={<AdminFoundation />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
