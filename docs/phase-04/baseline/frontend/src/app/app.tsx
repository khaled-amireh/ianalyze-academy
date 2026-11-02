import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Direction } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { DEV_PREVIEWS } from './config';
import { RouteEffects } from './route-effects';
import { PublicLayout } from '@/components/layout/public-layout';
import { HomePage } from '@/pages/public/home-page';
import { AboutPage } from '@/pages/public/about-page';
import { SyllabusPage } from '@/pages/public/syllabus-page';
import { VideosPage } from '@/pages/public/videos-page';
import { TeamPage } from '@/pages/public/team-page';
import { JoinPage } from '@/pages/public/join-page';
import { LeaderboardPage } from '@/pages/public/leaderboard-page';
import { ContactPage } from '@/pages/public/contact-page';
import { NotFoundPage } from '@/pages/public/not-found-page';
import { LoadingIndicator } from '@/components/shared/loading-indicator';

const DevelopmentPreview = import.meta.env.DEV ? lazy(() => import('@/dev/dev-routes')) : null;

export function App() {
  const { i18n } = useTranslation();
  return (
    <Direction.Provider dir={i18n.resolvedLanguage === 'ar' ? 'rtl' : 'ltr'}>
      <RouteEffects />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="eda" element={<SyllabusPage />} />
          <Route path="videos" element={<VideosPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="join" element={<JoinPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="contact" element={<ContactPage />} />
          {DEV_PREVIEWS && DevelopmentPreview && (
            <Route
              path="_preview/*"
              element={
                <Suspense fallback={<LoadingIndicator />}>
                  <DevelopmentPreview />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Direction.Provider>
  );
}
