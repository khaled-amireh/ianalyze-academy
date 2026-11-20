import { writeFileSync, mkdirSync } from 'node:fs';
import { requireSupabaseTarget, target } from './release-target.mjs';
import {
  registrationReadinessQuery,
  verifyRegistrationApproval,
} from './registration-approval.mjs';
requireSupabaseTarget();
if (process.env.ACADEMY_REGISTRATION_APPROVED !== 'true') {
  console.log('Public registration remains closed.');
} else {
  const owner = process.env.ACADEMY_LEADER_USER_ID;
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      owner ?? '',
    ) ||
    !process.env.SUPABASE_ACCESS_TOKEN
  )
    throw new Error(
      'Verified owner UUID and authorized CI credential are required before opening registration.',
    );
  // SELECT only; UUID is validated above. Privileged gates are inspected without EXECUTE.
  const query = registrationReadinessQuery(owner);
  let response;
  try {
    response = await fetch(
      `https://api.supabase.com/v1/projects/${target.project}/database/query`,
      {
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ read_only: true, query }),
        signal: AbortSignal.timeout(20000),
      },
    );
  } catch {
    throw new Error('Read-only Leader readiness request failed; registration release stopped.');
  }
  if (!response.ok)
    throw new Error('Read-only Leader readiness request failed; registration release stopped.');
  let rows;
  try {
    rows = await response.json();
  } catch {
    throw new Error('Unexpected read-only readiness response.');
  }
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0])
    throw new Error('Unexpected read-only readiness response.');
  const proof = {
    schemaVersion: 2,
    project: target.project,
    verifiedLeader: rows[0].verified_leader,
    gateDefinitionsSafe: rows[0].gate_definitions_safe,
    gates: rows[0].gates,
    verifiedAt: new Date().toISOString(),
  };
  verifyRegistrationApproval(proof, Date.now(), process.env);
  mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
  writeFileSync(
    new URL('../artifacts/registration-readiness.json', import.meta.url),
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(
    'Verified owner UUID has a confirmed Auth account and Team access; approved gate states match exactly; legacy uploads remain closed.',
  );
}
