import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isOwnerTeamTransitionActor,
  OWNER_AUTH_ID,
} from '../src/features/portal/owner-team-transition-access.ts';
import { directionForLocale } from '../src/lib/locale-direction.ts';

const owner = {
  status: 'signed-in',
  user: { id: OWNER_AUTH_ID, email: null, confirmed: true },
  role: 'team',
  error: null,
} as const;

test('owner Team transition control requires the verified exact owner UUID and Team role', () => {
  assert.equal(isOwnerTeamTransitionActor(owner), true);
  assert.equal(isOwnerTeamTransitionActor({ ...owner, role: 'student' }), false);
  assert.equal(
    isOwnerTeamTransitionActor({ ...owner, user: { ...owner.user, confirmed: false } }),
    false,
  );
  assert.equal(
    isOwnerTeamTransitionActor({ ...owner, user: { ...owner.user, id: 'not-owner' } }),
    false,
  );
  assert.equal(isOwnerTeamTransitionActor({ ...owner, status: 'signed-out' }), false);
  assert.equal(isOwnerTeamTransitionActor({ ...owner, status: 'loading' }), false);
});

test('Team transition action is conditional on the server pending check and has a visible retry state', () => {
  const source = readFileSync(
    new URL('../src/features/portal/owner-team-transition.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /current_user_can_complete_hussein_team_transition/);
  assert.match(source, /result\.data === true \? 'pending' : 'none'/);
  assert.match(source, /state === 'pending' \?\s*\(/);
  assert.match(source, /complete_owner_approved_hussein_team_transition/);
  assert.match(source, /state !== 'pending' \|\| busy/);
  assert.match(source, /teamTransitionNone|No owner-approved Team assignment is pending/);
  assert.match(source, /teamTransitionError|The assignment status could not be verified/);
});

test('locale direction restores RTL Arabic and LTR English', () => {
  assert.equal(directionForLocale('ar'), 'rtl');
  assert.equal(directionForLocale('en'), 'ltr');
});
