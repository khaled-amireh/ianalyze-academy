import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Direction } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { DEV_PREVIEWS } from './config';
import { PublicLayout } from '@/components/layout/public-layout';
import { HomePage } from '@/pages/public/home-page';
import { NotFoundPage } from '@/pages/public/not-found-page';
import { LoadingIndicator } from '@/components/shared/loading-indicator';

const DevelopmentPreview = import.meta.env.DEV ? lazy(() => import('@/dev/dev-routes')) : null;
const AboutPage = lazy(() =>
  import('@/pages/public/about-page').then((m) => ({ default: m.AboutPage })),
);
const SyllabusPage = lazy(() =>
  import('@/pages/public/syllabus-page').then((m) => ({ default: m.SyllabusPage })),
);
const VideosPage = lazy(() =>
  import('@/pages/public/videos-page').then((m) => ({ default: m.VideosPage })),
);
const TeamPage = lazy(() =>
  import('@/pages/public/team-page').then((m) => ({ default: m.TeamPage })),
);
const JoinPage = lazy(() =>
  import('@/pages/public/join-page').then((m) => ({ default: m.JoinPage })),
);
const LeaderboardPage = lazy(() =>
  import('@/pages/public/leaderboard-page').then((m) => ({ default: m.LeaderboardPage })),
);
const ContactPage = lazy(() =>
  import('@/pages/public/contact-page').then((m) => ({ default: m.ContactPage })),
);

export function App() {
  const { i18n } = useTranslation();
  return (
    <Direction.Provider dir={i18n.resolvedLanguage === 'ar' ? 'rtl' : 'ltr'}>
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
