import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requirePagesTarget,
  requireReleaseCi,
  requireSupabaseTarget,
} from '../scripts/release-target.mjs';

const ci = {
  CI: 'true',
  GITHUB_ACTIONS: 'true',
  GITHUB_EVENT_NAME: 'push',
  GITHUB_REPOSITORY: 'khaled-amireh/ianalyze-academy',
  GITHUB_REF: 'refs/heads/codex/supabase-auth-integration',
  GITHUB_SHA: 'a'.repeat(40),
};
const destinations = {
  CLOUDFLARE_ACCOUNT_ID: 'f25401b10b1826c747cd11739a9410bc',
  CLOUDFLARE_PAGES_PROJECT: 'ianalyze-academy',
  CLOUDFLARE_PRODUCTION_BRANCH: 'main',
  SUPABASE_PROJECT_ID: 'ocihwiqtgqplwgyhpwjv',
  PRODUCTION_ORIGIN: 'https://ianalyze-academy.pages.dev',
};

test('only reviewed repository pushes can deploy; local, PR, fork and other-branch runs fail', () => {
  assert.doesNotThrow(() => requireReleaseCi(ci));
  assert.doesNotThrow(() => requireReleaseCi({ ...ci, GITHUB_REF: 'refs/heads/main' }));
  for (const change of [
    { GITHUB_ACTIONS: '' },
    { GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_EVENT_NAME: 'workflow_dispatch' },
    { GITHUB_REPOSITORY: 'someone-else/ianalyze-academy' },
    { GITHUB_REF: 'refs/heads/unreviewed' },
    { GITHUB_SHA: 'not-a-commit' },
  ])
    assert.throws(() => requireReleaseCi({ ...ci, ...change }));
});

test('Pages account, project, production alias and origin cannot drift', () => {
  assert.doesNotThrow(() => requirePagesTarget(destinations));
  for (const name of [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_PAGES_PROJECT',
    'CLOUDFLARE_PRODUCTION_BRANCH',
    'PRODUCTION_ORIGIN',
  ])
    assert.throws(() => requirePagesTarget({ ...destinations, [name]: 'unexpected-target' }));
});

test('Edge deployment is bound to the existing Supabase project and approved origin', () => {
  assert.doesNotThrow(() => requireSupabaseTarget(destinations));
  assert.throws(() =>
    requireSupabaseTarget({ ...destinations, SUPABASE_PROJECT_ID: 'another-project' }),
  );
  assert.throws(() =>
    requireSupabaseTarget({ ...destinations, PRODUCTION_ORIGIN: 'https://attacker.invalid' }),
  );
});
