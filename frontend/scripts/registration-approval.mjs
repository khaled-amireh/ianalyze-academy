import { readFileSync } from 'node:fs';
import { productionFeatures } from './production-feature-approval.mjs';
export function approvedRegistrationGates(environment = {}) {
  const features = productionFeatures(environment, true);
  return {
    leaderboard_enabled: features.leaderboard,
    submission_service_enabled: features.submissions,
    uploads_enabled: false,
  };
}
export function registrationReadinessQuery(owner) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(owner ?? '')
  )
    throw new Error('Valid approved Leader UUID required.');
  return `select exists(select 1 from auth.users u join app_private.user_roles r on r.user_id=u.id where u.id='${owner}'::uuid and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) and r.role='team') as verified_leader,
 (select count(*)=3 and bool_and(p.prosrc ~ '^[[:space:]]*select[[:space:]]+(true|false);?[[:space:]]*$' and p.provolatile='i' and not p.prosecdef and p.pronargs=0 and p.prorettype='boolean'::regtype and l.lanname='sql' and pg_get_userbyid(p.proowner)='postgres' and p.proconfig is not null and p.proconfig=array['search_path=""']::text[]) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace join pg_catalog.pg_language l on l.oid=p.prolang where n.nspname='app_private' and p.proname in ('uploads_enabled','submission_service_enabled','leaderboard_enabled')) as gate_definitions_safe,
 (select jsonb_object_agg(p.proname,case when p.prosrc ~ '^[[:space:]]*select[[:space:]]+true;?[[:space:]]*$' then true when p.prosrc ~ '^[[:space:]]*select[[:space:]]+false;?[[:space:]]*$' then false else null end) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname in ('uploads_enabled','submission_service_enabled','leaderboard_enabled')) as gates`;
}
export function verifyRegistrationApproval(proof, now = Date.now(), environment = {}) {
  const expected = approvedRegistrationGates(environment);
  if (
    proof?.schemaVersion !== 2 ||
    proof?.project !== 'ocihwiqtgqplwgyhpwjv' ||
    proof?.verifiedLeader !== true ||
    proof?.gateDefinitionsSafe !== true ||
    !proof?.gates ||
    Object.keys(proof.gates).sort().join(',') !== Object.keys(expected).sort().join(',') ||
    Object.entries(expected).some(([k, v]) => proof.gates[k] !== v) ||
    !Number.isFinite(now) ||
    !Number.isFinite(Date.parse(proof?.verifiedAt)) ||
    now - Date.parse(proof.verifiedAt) > 15 * 60 * 1000 ||
    Date.parse(proof.verifiedAt) > now + 30000
  )
    throw new Error(
      'Registration requires a fresh verified Leader, safe constant gate definitions and exact approved feature states; legacy uploads must be closed.',
    );
  return true;
}
export function registrationApproved(
  proofPath = new URL('../artifacts/registration-readiness.json', import.meta.url),
) {
  if (process.env.ACADEMY_REGISTRATION_APPROVED !== 'true') return false;
  let proof;
  try {
    proof = JSON.parse(readFileSync(proofPath, 'utf8'));
  } catch {
    throw new Error(
      'REGISTRATION_READINESS_MISSING_OR_INVALID: Obtain a fresh v2 Leader and exact feature-gate proof with check-registration-readiness.mjs in an authorized read-only production session; never fabricate or reuse expired evidence.',
    );
  }
  return verifyRegistrationApproval(proof, Date.now(), process.env);
}
