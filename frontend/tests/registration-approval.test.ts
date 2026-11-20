import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyRegistrationApproval,
  registrationApproved,
  approvedRegistrationGates,
  registrationReadinessQuery,
} from '../scripts/registration-approval.mjs';
const enabled = {
  ACADEMY_LEADERBOARD_APPROVED: 'true',
  ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED: 'true',
};
const now = Date.now(),
  proof = {
    schemaVersion: 2,
    project: 'ocihwiqtgqplwgyhpwjv',
    verifiedLeader: true,
    gateDefinitionsSafe: true,
    gates: approvedRegistrationGates(enabled),
    verifiedAt: new Date(now).toISOString(),
  };
test('fresh proof accepts only exact explicitly approved already-active gates with legacy uploads closed', () => {
  assert.equal(verifyRegistrationApproval(proof, now, enabled), true);
  assert.equal(
    verifyRegistrationApproval({ ...proof, gates: approvedRegistrationGates({}) }, now, {}),
    true,
  );
  assert.throws(() => verifyRegistrationApproval(proof, now, {}));
  assert.throws(() =>
    verifyRegistrationApproval({ ...proof, gates: approvedRegistrationGates({}) }, now, enabled),
  );
});
test('unsafe, missing, stale, mismatched or legacy proofs fail closed', () => {
  for (const patch of [
    { schemaVersion: 1 },
    { verifiedLeader: false },
    { gateDefinitionsSafe: false },
    { gates: undefined },
    { gates: { ...proof.gates, uploads_enabled: true } },
    { gates: { ...proof.gates, leaderboard_enabled: 'true' } },
    { gates: { ...proof.gates, extra: false } },
    { project: 'other' },
    { verifiedAt: 'invalid' },
    { verifiedAt: new Date(now - 16 * 60000).toISOString() },
    { verifiedAt: new Date(now + 60000).toISOString() },
  ])
    assert.throws(() => verifyRegistrationApproval({ ...proof, ...patch }, now, enabled));
  assert.throws(() =>
    verifyRegistrationApproval(
      {
        project: proof.project,
        verifiedLeader: true,
        unrelatedGatesClosed: true,
        verifiedAt: proof.verifiedAt,
      },
      now,
      enabled,
    ),
  );
  assert.throws(() => approvedRegistrationGates({ ACADEMY_LEADERBOARD_APPROVED: 'TRUE' }));
});
test('read-only metadata query never interpolates an unvalidated owner or executes a gate', () => {
  assert.throws(() => registrationReadinessQuery("x';drop table public.profiles;--"));
  const sql = registrationReadinessQuery('00000000-0000-4000-8000-000000000001');
  assert.ok(
    !/app_private\.(?:uploads_enabled|leaderboard_enabled|submission_service_enabled)\s*\(/.test(
      sql,
    ),
  );
  assert.match(sql, /pg_catalog.pg_proc/);
  assert.match(sql, /p.proconfig/);
  assert.match(sql, /p.provolatile='i'/);
});

test('PostgreSQL metadata guard rejects altered definitions and accepts approved active state without production writes', async (t) => {
  const { createDatabase } = await import('../scripts/database-fixture.mjs');
  const db = await createDatabase();
  t.after(() => db.close());
  await db.exec(
    'alter table auth.users add column deleted_at timestamptz,add column banned_until timestamptz',
  );
  const owner = '00000000-0000-4000-8000-000000000001';
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at)values($1,'fixture@example.test',now())",
    [owner],
  );
  await db.query("update app_private.user_roles set role='team' where user_id=$1", [owner]);
  const restore = async () => {
    await db.exec('alter function app_private.leaderboard_enabled() owner to postgres');
    for (const [name, value] of [
      ['leaderboard_enabled', 'true'],
      ['submission_service_enabled', 'true'],
      ['uploads_enabled', 'false'],
    ])
      await db.exec(
        `create or replace function app_private.${name}() returns boolean language sql immutable security invoker set search_path='' as 'select ${value};';`,
      );
  };
  const checkpoint = async () => {
    const row = (await db.query(registrationReadinessQuery(owner))).rows[0];
    return verifyRegistrationApproval(
      {
        ...proof,
        verifiedLeader: row.verified_leader,
        gateDefinitionsSafe: row.gate_definitions_safe,
        gates: row.gates,
      },
      now,
      enabled,
    );
  };
  await restore();
  assert.equal(await checkpoint(), true);
  for (const ddl of [
    'alter function app_private.leaderboard_enabled() stable',
    'alter function app_private.leaderboard_enabled() security definer',
    "alter function app_private.leaderboard_enabled() set search_path='public'",
    'alter function app_private.leaderboard_enabled() reset all',
    'alter function app_private.leaderboard_enabled() owner to authenticated',
    "create or replace function app_private.leaderboard_enabled() returns boolean language sql immutable set search_path='' as 'select coalesce(true,false);'",
    "create or replace function app_private.uploads_enabled() returns boolean language sql immutable set search_path='' as 'select true;'",
  ]) {
    await restore();
    await db.exec(ddl);
    await assert.rejects(checkpoint());
  }
  await restore();
  await db.query('update auth.users set email_confirmed_at=null where id=$1', [owner]);
  await assert.rejects(checkpoint());
});

test('configured build reports an actionable missing-proof error without leaking paths or values', () => {
  const previous = process.env.ACADEMY_REGISTRATION_APPROVED;
  process.env.ACADEMY_REGISTRATION_APPROVED = 'true';
  try {
    assert.throws(
      () => registrationApproved(new URL('./__absent_registration_proof__.json', import.meta.url)),
      /REGISTRATION_READINESS_MISSING_OR_INVALID/,
    );
  } finally {
    if (previous === undefined) delete process.env.ACADEMY_REGISTRATION_APPROVED;
    else process.env.ACADEMY_REGISTRATION_APPROVED = previous;
  }
});
