import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolveProductionBuildGates } from '../scripts/production-build-gates.mjs';
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
    { verifiedLeader: 'true' },
    { gateDefinitionsSafe: false },
    { gateDefinitionsSafe: undefined },
    { gates: undefined },
    { gates: { ...proof.gates, uploads_enabled: true } },
    { gates: { ...proof.gates, leaderboard_enabled: 'true' } },
    { gates: { ...proof.gates, submission_service_enabled: false } },
    { gates: { ...proof.gates, extra: false } },
    { project: 'other' },
    { verifiedAt: 'invalid' },
    { verifiedAt: new Date(now - 16 * 60000).toISOString() },
    { verifiedAt: new Date(now + 60000).toISOString() },
  ])
    assert.throws(() => verifyRegistrationApproval({ ...proof, ...patch }, now, enabled));
  assert.throws(() => verifyRegistrationApproval(proof, NaN, enabled));
  assert.throws(() => verifyRegistrationApproval(proof, Infinity, enabled));
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
  assert.equal(
    approvedRegistrationGates({ ACADEMY_LEADERBOARD_APPROVED: 'TRUE' }).leaderboard_enabled,
    false,
  );
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
    "create or replace function app_private.submission_service_enabled() returns boolean language sql immutable set search_path='' as 'select false;'",
  ]) {
    await restore();
    await db.exec(ddl);
    await assert.rejects(checkpoint());
  }
  await restore();
  await db.exec(
    'alter function app_private.leaderboard_enabled() rename to synthetic_missing_gate',
  );
  await assert.rejects(checkpoint());
  await db.exec(
    'alter function app_private.synthetic_missing_gate() rename to leaderboard_enabled',
  );
  await db.exec(
    "create function app_private.leaderboard_enabled(integer) returns boolean language sql immutable set search_path='' as 'select true;'",
  );
  await assert.rejects(checkpoint());
  await db.exec('drop function app_private.leaderboard_enabled(integer)');
  for (const change of [
    'update auth.users set email_confirmed_at=null where id=$1',
    'update auth.users set deleted_at=now() where id=$1',
    "update auth.users set banned_until=now()+interval '1 day' where id=$1",
    "update app_private.user_roles set role='student' where user_id=$1",
  ]) {
    await db.query(
      'update auth.users set email_confirmed_at=now(),deleted_at=null,banned_until=null where id=$1',
      [owner],
    );
    await db.query("update app_private.user_roles set role='team' where user_id=$1", [owner]);
    await db.query(change, [owner]);
    await assert.rejects(checkpoint());
  }
});

test('proof and production builder agree on all eight independent approval combinations', () => {
  for (const registration of ['false', 'true'])
    for (const submissions of ['false', 'true'])
      for (const leaderboard of ['false', 'true']) {
        const environment = {
          ACADEMY_REGISTRATION_APPROVED: registration,
          ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED: submissions,
          ACADEMY_LEADERBOARD_APPROVED: leaderboard,
        };
        const gates = approvedRegistrationGates(environment);
        const verified = verifyRegistrationApproval({ ...proof, gates }, now, environment);
        const build = resolveProductionBuildGates(environment, verified);
        assert.equal(build.metadata.registration, registration === 'true');
        assert.equal(build.metadata.privacyApproved, registration === 'true');
        assert.equal(build.metadata.submissions, gates.submission_service_enabled);
        assert.equal(build.metadata.leaderboard, gates.leaderboard_enabled);
        assert.equal(build.metadata.developmentPreviews, false);
        assert.equal(gates.uploads_enabled, false);
      }
});

test('15-minute validity and future timestamp allowance retain their exact boundaries', () => {
  for (const age of [0, 15 * 60000, -30000])
    assert.equal(
      verifyRegistrationApproval(
        { ...proof, verifiedAt: new Date(now - age).toISOString() },
        now,
        enabled,
      ),
      true,
    );
  for (const age of [15 * 60000 + 1, -30001])
    assert.throws(() =>
      verifyRegistrationApproval(
        { ...proof, verifiedAt: new Date(now - age).toISOString() },
        now,
        enabled,
      ),
    );
});

// All HTTP calls and proof writes are intercepted in this isolated subprocess.
// Synthetic fixtures never populate the real registration-readiness file.
function mockReadiness(scenario: string) {
  const checker = new URL('../scripts/check-registration-readiness.mjs', import.meta.url).href;
  const approval = new URL('../scripts/registration-approval.mjs', import.meta.url).href;
  const source = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const scenario = ${JSON.stringify(scenario)};
    const writes = [];
    fs.mkdirSync = () => undefined;
    fs.writeFileSync = (path, data) => { assert.equal(new URL(path).pathname.endsWith('/artifacts/registration-readiness.json'), true); writes.push(JSON.parse(data)); };
    syncBuiltinESMExports();
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.supabase.com/v1/projects/ocihwiqtgqplwgyhpwjv/database/query');
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer SYNTHETIC_TOKEN_ONLY');
      assert.equal(JSON.parse(options.body).read_only, true);
      if (scenario === 'network') throw new Error('SYNTHETIC_PRIVATE_PROVIDER_DETAIL');
      return {
        ok: scenario !== 'http',
        json: async () => {
          if (scenario === 'json') throw new Error('SYNTHETIC_PRIVATE_PROVIDER_DETAIL');
          if (scenario === 'empty') return [];
          return [{ verified_leader: scenario !== 'leader', gate_definitions_safe: true,
            gates: { leaderboard_enabled: true, submission_service_enabled: true, uploads_enabled: scenario === 'uploads' } }];
        }
      };
    };
    let error;
    try { await import(${JSON.stringify(checker)}); } catch (caught) { error = caught; }
    if (scenario === 'pass') {
      assert.equal(error, undefined);
      assert.equal(writes.length, 1);
      const { verifyRegistrationApproval, registrationApproved } = await import(${JSON.stringify(approval)});
      assert.equal(verifyRegistrationApproval(writes[0], Date.now(), process.env), true);
      assert.deepEqual(Object.keys(writes[0]).sort(), ['gateDefinitionsSafe','gates','project','schemaVersion','verifiedAt','verifiedLeader']);
      const read = fs.readFileSync;
      fs.readFileSync = (path, ...options) => {
        if (String(path).endsWith('/artifacts/registration-readiness.json')) return JSON.stringify(writes[0]);
        return read(path, ...options);
      };
      syncBuiltinESMExports();
      assert.equal(registrationApproved(), true);
      process.env.ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED = 'false';
      assert.throws(() => registrationApproved());
      process.env.ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED = 'true';
      process.env.ACADEMY_LEADERBOARD_APPROVED = 'false';
      assert.throws(() => registrationApproved());
      for (const value of ['false', 'TRUE', '']) {
        process.env.ACADEMY_REGISTRATION_APPROVED = value;
        assert.equal(registrationApproved(), false);
      }
    } else {
      assert.ok(error);
      assert.equal(writes.length, 0);
      assert.doesNotMatch(error.message, /SYNTHETIC_PRIVATE_PROVIDER_DETAIL|SYNTHETIC_TOKEN_ONLY/);
    }
    console.log('SYNTHETIC_CHECK_PASS');
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    timeout: 15000,
    env: {
      ...process.env,
      ...enabled,
      ACADEMY_REGISTRATION_APPROVED: 'true',
      SUPABASE_PROJECT_ID: 'ocihwiqtgqplwgyhpwjv',
      PRODUCTION_ORIGIN: 'https://ianalyze-academy.pages.dev',
      SUPABASE_ACCESS_TOKEN: 'SYNTHETIC_TOKEN_ONLY',
      ACADEMY_LEADER_USER_ID: '00000000-0000-4000-8000-000000000001',
    },
  });
  assert.equal(result.status, 0, `${scenario}: ${result.stderr}`);
  assert.match(result.stdout, /SYNTHETIC_CHECK_PASS/);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /SYNTHETIC_PRIVATE_PROVIDER_DETAIL|SYNTHETIC_TOKEN_ONLY/,
  );
}

test('readiness command binds v2 evidence to the exact target using SELECT-only transport', () => {
  mockReadiness('pass');
});

test('network, malformed responses, untrusted Leaders and legacy uploads fail without proof writes', () => {
  for (const scenario of ['network', 'http', 'json', 'empty', 'leader', 'uploads'])
    mockReadiness(scenario);
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
