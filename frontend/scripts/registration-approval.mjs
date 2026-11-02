import { readFileSync } from 'node:fs';
export function verifyRegistrationApproval(proof, now = Date.now()) {
  if (
    proof?.project !== 'ocihwiqtgqplwgyhpwjv' ||
    proof?.verifiedLeader !== true ||
    proof?.unrelatedGatesClosed !== true ||
    !Number.isFinite(Date.parse(proof?.verifiedAt)) ||
    now - Date.parse(proof.verifiedAt) > 15 * 60 * 1000 ||
    Date.parse(proof.verifiedAt) > now + 30000
  )
    throw new Error(
      'Registration requires a fresh verified Leader and closed submission/ranking gates.',
    );
  return true;
}
export function registrationApproved() {
  if (process.env.ACADEMY_REGISTRATION_APPROVED !== 'true') return false;
  return verifyRegistrationApproval(
    JSON.parse(
      readFileSync(new URL('../artifacts/registration-readiness.json', import.meta.url), 'utf8'),
    ),
  );
}
