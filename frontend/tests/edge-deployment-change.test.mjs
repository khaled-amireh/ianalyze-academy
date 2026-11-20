import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { edgeDeploymentRequired } from '../scripts/edge-deployment-change.mjs';

test('unrelated frontend, package, lockfile and documentation changes skip Edge deployment', () => {
  assert.equal(
    edgeDeploymentRequired([
      'frontend/package.json',
      'frontend/package-lock.json',
      'frontend/src/features/portal/team-page.tsx',
      'README.md',
    ]),
    false,
  );
});

test('Edge Function source changes still require deployment', () => {
  assert.equal(edgeDeploymentRequired(['supabase/functions/notebook-submit/index.ts']), true);
  assert.equal(edgeDeploymentRequired(['supabase/functions/_shared/notebook.ts']), true);
});

test('Edge deployment and target scripts still require deployment', () => {
  assert.equal(edgeDeploymentRequired(['frontend/scripts/deploy-supabase-edge.mjs']), true);
  assert.equal(edgeDeploymentRequired(['frontend/scripts/release-target.mjs']), true);
});

test('invalid change inventory fails closed', () => {
  assert.equal(edgeDeploymentRequired(null), true);
  assert.equal(edgeDeploymentRequired(['frontend/package.json', null]), true);
});

test('production workflow delegates Edge change detection to the tested helper', () => {
  const workflow = readFileSync(
    new URL('../../.github/workflows/production.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /run: node frontend\/scripts\/edge-deployment-change\.mjs/);
  assert.match(workflow, /if: steps\.edge_changes\.outputs\.changed == 'true'/);
});
