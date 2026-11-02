import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyRegistrationApproval } from '../scripts/registration-approval.mjs';
test('registration release requires a fresh verified Leader and unchanged closed submission/ranking gates', () => {
  const now = Date.now();
  const proof = {
    project: 'ocihwiqtgqplwgyhpwjv',
    verifiedLeader: true,
    unrelatedGatesClosed: true,
    verifiedAt: new Date(now).toISOString(),
  };
  assert.equal(verifyRegistrationApproval(proof, now), true);
  for (const patch of [
    { verifiedLeader: false },
    { unrelatedGatesClosed: false },
    { project: 'other' },
    { verifiedAt: 'invalid' },
    { verifiedAt: new Date(now - 16 * 60000).toISOString() },
    { verifiedAt: new Date(now + 60000).toISOString() },
  ])
    assert.throws(() => verifyRegistrationApproval({ ...proof, ...patch }, now));
});
