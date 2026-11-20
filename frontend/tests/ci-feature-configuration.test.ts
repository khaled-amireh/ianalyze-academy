import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { productionFeatures } from '../scripts/production-feature-approval.mjs';
import { verifyRegistrationApproval } from '../scripts/registration-approval.mjs';

const workflow = readFileSync(
  new URL('../../.github/workflows/production.yml', import.meta.url),
  'utf8',
);
const approvals = ['ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED', 'ACADEMY_LEADERBOARD_APPROVED'];
const now = Date.parse('2026-11-20T19:00:00Z');
const proof = {
  schemaVersion: 2,
  project: 'ocihwiqtgqplwgyhpwjv',
  verifiedLeader: true,
  gateDefinitionsSafe: true,
  verifiedAt: new Date(now).toISOString(),
  gates: { leaderboard_enabled: true, submission_service_enabled: true, uploads_enabled: false },
};
function jobEnvironment(variables: Record<string, string>) {
  const beforeSteps = workflow.split(/\r?\n {4}steps:/)[0];
  const env: Record<string, string> = {};
  for (const name of ['ACADEMY_REGISTRATION_APPROVED', ...approvals]) {
    const mapping = beforeSteps.match(
      new RegExp(`^      ${name}: \\$\\{\\{ vars\\.([A-Z_]+) \\}\\}\\r?$`, 'm'),
    );
    assert.ok(mapping, `Missing explicit job-wide variable mapping: ${name}`);
    assert.equal(mapping[1], name);
    // An unset GitHub repository variable evaluates to an empty string.
    env[name] = variables[mapping[1]] ?? '';
  }
  return env;
}
const approvedVariables = {
  ACADEMY_REGISTRATION_APPROVED: 'true',
  ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED: 'true',
  ACADEMY_LEADERBOARD_APPROVED: 'true',
};

test('only the two approved CI mappings changed from the previously reviewed workflow', () => {
  let restored = workflow;
  for (const name of approvals) {
    const line = new RegExp(`^      ${name}: [^\\r\\n]+\\r?\\n`, 'gm');
    assert.equal([...restored.matchAll(line)].length, 1);
    restored = restored.replace(line, '');
  }
  assert.equal(
    createHash('sha256').update(restored).digest('hex'),
    '417ca0fb7072a8b50fe3238223532a20cd933f5e8313b1223a2f71fd111203e7',
  );
});
test('job-wide explicit approvals satisfy existing enabled-gate proof and build consumers', () => {
  const env = jobEnvironment(approvedVariables);
  assert.equal(verifyRegistrationApproval(proof, now, env), true);
  assert.deepEqual(productionFeatures(env, env.ACADEMY_REGISTRATION_APPROVED === 'true'), {
    submissions: true,
    leaderboard: true,
  });
});
test('missing, empty, false or malformed feature approvals cannot accept enabled production gates', () => {
  for (const name of approvals)
    for (const value of [undefined, '', 'false', 'TRUE', ' true', '1']) {
      const variables: Record<string, string> = { ...approvedVariables };
      if (value === undefined) delete variables[name];
      else variables[name] = value;
      assert.throws(() => verifyRegistrationApproval(proof, now, jobEnvironment(variables)));
    }
});
test('feature mappings cannot bypass registration approval or a stale readiness proof', () => {
  const env = jobEnvironment({ ...approvedVariables, ACADEMY_REGISTRATION_APPROVED: 'false' });
  assert.throws(() => productionFeatures(env, env.ACADEMY_REGISTRATION_APPROVED === 'true'));
  assert.throws(() =>
    verifyRegistrationApproval(proof, now + 15 * 60 * 1000 + 1, jobEnvironment(approvedVariables)),
  );
});
