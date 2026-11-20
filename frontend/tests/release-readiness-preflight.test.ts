import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configuredBuildReadiness } from '../scripts/release-readiness-preflight.mjs';
const env = {
  VITE_SUPABASE_URL: 'https://ocihwiqtgqplwgyhpwjv.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  ACADEMY_REGISTRATION_APPROVED: 'true',
};
test('offline preflight distinguishes configuration from missing and stale proof without revealing input', () => {
  const missing = configuredBuildReadiness(env, undefined);
  assert.equal(missing.checks[0].passed, true);
  assert.equal(missing.checks.at(-1).category, 'missing-evidence');
  assert.equal(missing.configuredBuildReady, false);
  assert.equal(
    configuredBuildReadiness(env, {}).checks.at(-1).category,
    'stale-or-invalid-evidence',
  );
  assert.equal(configuredBuildReadiness({}, undefined).configuredBuildReady, false);
  assert.ok(!JSON.stringify(missing).includes(env.VITE_SUPABASE_PUBLISHABLE_KEY));
  assert.equal(
    configuredBuildReadiness({ ...env, ACADEMY_REGISTRATION_APPROVED: 'false' }, undefined)
      .configuredBuildReady,
    true,
  );
});

test('release check fails fast on offline readiness before running the validation suite', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(
    packageJson.scripts['release:check'],
    'npm run check:readiness && npm run validate && npm run build:production && npm run check:pages:production',
  );
});
