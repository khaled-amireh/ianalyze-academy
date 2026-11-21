import type { AuthSnapshot } from '@/features/auth/auth-store';

export const OWNER_AUTH_ID = '79b1672a-b609-4ec4-814a-15ed209796af';

export function isOwnerTeamTransitionActor(auth: AuthSnapshot) {
  return (
    auth.status === 'signed-in' &&
    auth.role === 'team' &&
    auth.user?.confirmed === true &&
    auth.user.id === OWNER_AUTH_ID
  );
}
