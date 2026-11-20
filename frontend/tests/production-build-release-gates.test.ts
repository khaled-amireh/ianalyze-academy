import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  expectedProductionBuildMetadata,
  resolveProductionBuildGates,
} from '../scripts/production-build-gates.mjs';

const workflow = readFileSync(
  new URL('../../.github/workflows/production.yml', import.meta.url),
  'utf8',
);
const builder = readFileSync(
  new URL('../scripts/build-pages-production.mjs', import.meta.url),
  'utf8',
);
const artifactChecker = readFileSync(
  new URL('../scripts/check-pages-artifact.mjs', import.meta.url),
  'utf8',
);

test('production build maps each explicit approval to only its matching frontend gate', () => {
  const gates = resolveProductionBuildGates(
    {
      ACADEMY_REGISTRATION_APPROVED: 'true',
      ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED: 'true',
      ACADEMY_LEADERBOARD_APPROVED: 'true',
    },
    true,
  );

  assert.deepEqual(gates.vite, {
    VITE_ENABLE_REGISTRATION: 'true',
    VITE_ENABLE_SUBMISSIONS: 'true',
    VITE_ENABLE_LEADERBOARD: 'true',
    VITE_PRIVACY_APPROVED: 'true',
    VITE_ENABLE_DEV_PREVIEWS: 'false',
  });
  assert.deepEqual(gates.metadata, {
    registration: true,
    submissions: true,
    leaderboard: true,
    privacyApproved: true,
    developmentPreviews: false,
  });
});

test('feature approvals fail closed independently when absent, malformed, or false', () => {
  for (const value of [undefined, 'false', 'TRUE', '1', 'yes']) {
    const environment = {
      ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED: value,
      ACADEMY_LEADERBOARD_APPROVED: 'true',
    };
    const gates = resolveProductionBuildGates(environment, false);
    assert.equal(gates.metadata.submissions, false);
    assert.equal(gates.metadata.leaderboard, true);
    assert.equal(gates.metadata.registration, false);
    assert.equal(gates.metadata.privacyApproved, false);
    assert.equal(gates.metadata.developmentPreviews, false);
  }
});

test('registration still requires its existing verified approval and privacy follows it', () => {
  const unverified = resolveProductionBuildGates(
    {
      ACADEMY_REGISTRATION_APPROVED: 'true',
      ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED: 'true',
      ACADEMY_LEADERBOARD_APPROVED: 'true',
    },
    false,
  );
  assert.equal(unverified.metadata.registration, false);
  assert.equal(unverified.metadata.privacyApproved, false);
  assert.equal(unverified.metadata.submissions, true);
  assert.equal(unverified.metadata.leaderboard, true);

  const approvalRemoved = resolveProductionBuildGates(
    {
      ACADEMY_REGISTRATION_APPROVED: 'false',
      ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED: 'true',
      ACADEMY_LEADERBOARD_APPROVED: 'true',
    },
    true,
  );
  assert.equal(approvalRemoved.metadata.registration, false);
  assert.equal(approvalRemoved.metadata.privacyApproved, false);
});

test('configured artifact expectations follow the three independent approvals', () => {
  assert.deepEqual(
    expectedProductionBuildMetadata({
      ACADEMY_REGISTRATION_APPROVED: 'true',
      ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED: 'false',
      ACADEMY_LEADERBOARD_APPROVED: 'true',
    }),
    {
      registration: true,
      submissions: false,
      leaderboard: true,
      privacyApproved: true,
      developmentPreviews: false,
    },
  );
});

test('production workflow supplies the explicit approval variables to the builder', () => {
  assert.match(
    workflow,
    /^[ ]{6}ACADEMY_REGISTRATION_APPROVED: \$\{\{ vars\.ACADEMY_REGISTRATION_APPROVED \}\}$/m,
  );
  assert.match(
    workflow,
    /^[ ]{6}ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED: \$\{\{ vars\.ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED \}\}$/m,
  );
  assert.match(
    workflow,
    /^[ ]{6}ACADEMY_LEADERBOARD_APPROVED: \$\{\{ vars\.ACADEMY_LEADERBOARD_APPROVED \}\}$/m,
  );
  assert.match(builder, /registrationApproved\(\)/);
  assert.match(builder, /resolveProductionBuildGates\(process\.env, registration\)/);
  assert.match(artifactChecker, /expectedProductionBuildMetadata\(process\.env\)/);
});

test('Edge deployment watches its function and deploy tooling, not package metadata', () => {
  const diffCommand = workflow.split('git diff --quiet')[1]?.split('; then')[0] ?? '';
  assert.match(diffCommand, /supabase\/functions/);
  assert.match(diffCommand, /frontend\/scripts\/deploy-supabase-edge\.mjs/);
  assert.match(diffCommand, /frontend\/scripts\/release-target\.mjs/);
  assert.doesNotMatch(diffCommand, /frontend\/package(?:-lock)?\.json/);
});
