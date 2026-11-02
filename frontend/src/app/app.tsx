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
import {
  academyClient,
  leaderboardEnabled,
  privacyApproved,
  registrationEnabled,
} from '@/lib/academy-client';
import { AuthCallback, AuthPage, ProtectedPortal } from '@/features/portal/auth-pages';
const StudentPortal = lazy(() =>
  import('@/features/portal/student-page').then((m) => ({ default: m.StudentPage })),
);
const TeamPortal = lazy(() =>
  import('@/features/portal/team-page').then((m) => ({ default: m.TeamPageLive })),
);
const PrivacyNotice =
  import.meta.env.DEV || import.meta.env.VITE_PRIVACY_APPROVED === 'true'
    ? lazy(() => import('@/features/portal/privacy-page').then((m) => ({ default: m.PrivacyPage })))
    : null;
const Rankings = lazy(() =>
  import('@/features/portal/leaderboard').then((m) => ({ default: m.LiveLeaderboard })),
);

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
          <Route
            path="join"
            element={
              academyClient && registrationEnabled && privacyApproved ? (
                <AuthPage mode="signup" />
              ) : (
                <JoinPage />
              )
            }
          />
          <Route
            path="leaderboard"
            element={
              academyClient && leaderboardEnabled ? (
                <Suspense fallback={<LoadingIndicator />}>
                  <Rankings />
                </Suspense>
              ) : (
                <LeaderboardPage />
              )
            }
          />
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="auth/recover" element={<AuthPage mode="recover" />} />
          <Route path="auth/callback" element={<AuthCallback />} />
          <Route
            path="privacy"
            element={
              PrivacyNotice ? (
                <Suspense fallback={<LoadingIndicator />}>
                  <PrivacyNotice />
                </Suspense>
              ) : (
                <NotFoundPage />
              )
            }
          />
          <Route element={<ProtectedPortal />}>
            <Route
              path="student"
              element={
                <Suspense fallback={<LoadingIndicator />}>
                  <StudentPortal />
                </Suspense>
              }
            />
            <Route path="auth/reset" element={<AuthPage mode="reset" />} />
          </Route>
          <Route element={<ProtectedPortal team />}>
            <Route
              path="workspace"
              element={
                <Suspense fallback={<LoadingIndicator />}>
                  <TeamPortal />
                </Suspense>
              }
            />
          </Route>
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
