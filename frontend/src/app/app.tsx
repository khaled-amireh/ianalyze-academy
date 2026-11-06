import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Direction } from 'radix-ui';
import { LAYOUT_DIR } from '@/lib/i18n';
import { DEV_PREVIEWS } from './config';
import { PublicLayout } from '@/components/layout/public-layout';
import { HomePage } from '@/pages/public/home-page';
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
const AboutPage = lazy(() =>
  import('@/pages/public/about-page').then((m) => ({ default: m.AboutPage })),
);
const ProfilePage = lazy(() =>
  import('@/features/portal/profile-page').then((m) => ({ default: m.ProfilePage })),
);
const NotificationsPage = lazy(() =>
  import('@/features/portal/notifications').then((m) => ({ default: m.NotificationsPage })),
);
const SyllabusPage = lazy(() =>
  import('@/pages/public/syllabus-page').then((m) => ({ default: m.SyllabusPage })),
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
  return (
    <Direction.Provider dir={LAYOUT_DIR}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="eda" element={<SyllabusPage />} />
          <Route path="videos/*" element={<NotFoundPage />} />
          <Route path="team" element={<Navigate to="/about#team" replace />} />
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
              path="profile"
              element={
                <Suspense fallback={<LoadingIndicator />}>
                  <ProfilePage />
                </Suspense>
              }
            />
            <Route
              path="profile/edit"
              element={
                <Suspense fallback={<LoadingIndicator />}>
                  <ProfilePage edit />
                </Suspense>
              }
            />
            <Route
              path="notifications"
              element={
                <Suspense fallback={<LoadingIndicator />}>
                  <NotificationsPage />
                </Suspense>
              }
            />
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
