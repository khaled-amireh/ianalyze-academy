import { writeFileSync, mkdirSync } from 'node:fs';
import { requireSupabaseTarget, target } from './release-target.mjs';
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
  const query = `select exists(select 1 from auth.users u join app_private.user_roles r on r.user_id=u.id where u.id='${owner}'::uuid and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) and r.role='team') as verified_leader,
    (select count(*)=3 and bool_and(p.prosrc ~ '^[[:space:]]*select[[:space:]]+false;?[[:space:]]*$' and p.provolatile='i' and not p.prosecdef and p.pronargs=0 and p.prorettype='boolean'::regtype and l.lanname='sql') from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace join pg_catalog.pg_language l on l.oid=p.prolang where n.nspname='app_private' and p.proname in ('uploads_enabled','submission_service_enabled','leaderboard_enabled')) as unrelated_gates_closed`;
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${target.project}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ read_only: true, query }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw new Error('Read-only Leader readiness request failed; registration release stopped.');
  const rows = await response.json();
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    rows[0].verified_leader !== true ||
    rows[0].unrelated_gates_closed !== true
  )
    throw new Error(
      'Verified Leader or unrelated-gate checkpoint failed; registration release stopped.',
    );
  mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
  writeFileSync(
    new URL('../artifacts/registration-readiness.json', import.meta.url),
    JSON.stringify(
      {
        project: target.project,
        verifiedLeader: true,
        unrelatedGatesClosed: true,
        verifiedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Verified owner UUID has a confirmed Auth account and Team access; unrelated gates remain closed.',
  );
}
