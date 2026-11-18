// Synthetic, guarded local fixtures. The clock is controlled ONLY by the test
// database owner, restored in cleanup, and has no client/API override parameter.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { week1TestTarget } from './week1-test-target.mjs';
export async function scoringFixture() {
  assert.equal(process.env.RUN_LOCAL_SUPABASE_TESTS, '1');
  const url = week1TestTarget(process.env.LOCAL_SUPABASE_URL),
    dbURL = week1TestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database');
  assert.equal(new URL(url).port, '54331');
  assert.equal(new URL(dbURL).port, '54332');
  const db = postgres(dbURL, { max: 1 }),
    options = { auth: { persistSession: false, autoRefreshToken: false } },
    admin = createClient(url, process.env.LOCAL_SUPABASE_SECRET_KEY, options),
    users = [],
    activities = [];
  const originalClock = (
    await db`select pg_get_functiondef('app_private.scoring_now()'::regprocedure) as ddl`
  )[0].ddl;
  const tables = (
    await db`select tablename from pg_tables where schemaname='public' order by tablename`
  ).map((x) => x.tablename);
  async function snapshot() {
    const r = {};
    for (const table of tables)
      r[table] = (
        await db`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) hash from ${db('public.' + table)} t`
      )[0].hash;
    return r;
  }
  const before = await snapshot();
  const recovery = () =>
    writeFileSync(
      'artifacts/week1-isolated/scoring-fixture-recovery.json',
      JSON.stringify(
        { databasePort: 54332, originalClock, users: users.map((u) => u.id), activities },
        null,
        2,
      ) + '\n',
    );
  const clock = async (value) => {
    assert.match(value, /^[0-9TZ:+.-]+$/);
    await db.unsafe(
      `create or replace function app_private.scoring_now() returns timestamptz language sql volatile set search_path='' as $$ select '${value}'::timestamptz $$`,
    );
    recovery();
  };
  async function account(alias, role = 'student') {
    const credentials = {
        email: `scoring-${randomUUID()}@example.test`,
        password: `Local-${randomUUID()}-Aa9!`,
      },
      made = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
    assert.ifError(made.error);
    const api = createClient(url, process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY, options),
      user = { ...credentials, id: made.data.user.id, api, alias };
    users.push(user);
    recovery();
    assert.ifError((await api.auth.signInWithPassword(credentials)).error);
    if (role === 'team')
      await db`update app_private.user_roles set role='team',grant_reason='Isolated scoring fixture' where user_id=${user.id}`;
    assert.ifError(
      (
        await api
          .from('profiles')
          .update({
            full_name: 'PRIVATE Scoring Person',
            whatsapp: '+962790000001',
            major: 'Software Engineering',
            university: 'Other University',
            academic_year: 2,
            python_experience: 'none',
            leaderboard_name: alias,
          })
          .eq('id', user.id)
      ).error,
    );
    assert.ifError(
      (await api.rpc('complete_registration', { p_consent_version: 'registration-v1' })).error,
    );
    return user;
  }
  let team;
  async function assignment(start) {
    const end = '2026-12-02T00:00+03',
      data = {
        title_en: 'SCORING FIXTURE ' + randomUUID(),
        title_ar: 'SCORING FIXTURE',
        instructions_en: 'Local test',
        instructions_ar: 'Local test',
        reference_links: '',
        submission_type: 'link',
        publish_at: start,
        due_at: end,
        phases: [{ name: 'Original phase', start, end, points: 50 }],
        status: 'published',
        accepting: true,
        archived: false,
        sort_order: 999,
      };
    const r = await team.api.rpc('save_assignment', {
      p_data: data,
      p_version: 0,
      p_request: randomUUID(),
    });
    assert.ifError(r.error);
    activities.push(r.data);
    recovery();
    return r.data;
  }
  async function submission(user, activity) {
    const id = randomUUID();
    await db`insert into public.submissions(id,student_id,activity_id,assignment_submission,status,link_url,phase_snapshot,max_eligible_points,submitted_at) values(${id},${user.id},${activity},true,'submitted','https://example.test/scoring',${db.json({ name: 'Original phase', points: 50 })},50,'2026-11-19T12:00+03')`;
    return id;
  }
  async function review(id, points, revision = 0) {
    const r = await team.api.rpc('review_assignment', {
      p_submission: id,
      p_points: points,
      p_feedback: 'PRIVATE SCORING FEEDBACK',
      p_revision: revision,
    });
    assert.ifError(r.error);
    return r;
  }
  async function packet(view, week) {
    const r = await admin.rpc('academy_rankings', {
      p_view: view,
      ...(week ? { p_week: week } : {}),
    });
    assert.ifError(r.error);
    return r.data;
  }
  async function cleanup() {
    try {
      await db.unsafe(originalClock);
      for (const id of activities) {
        await db`delete from public.point_awards where source_key=${'assignment:' + id}`;
        await db`delete from public.grades where submission_id in(select id from public.submissions where activity_id=${id})`;
        await db`delete from public.submissions where activity_id=${id}`;
        await db`update public.activities set status='draft' where id=${id}`;
        await db`delete from public.activities where id=${id}`;
      }
      for (const user of [...users].reverse()) {
        await db`delete from public.point_awards where student_id=${user.id}`;
        await user.api.auth.signOut();
        assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);
        await db`delete from app_private.scoring_award_events where student_id=${user.id}`;
        await db`delete from app_private.scoring_membership_events where student_id=${user.id}`;
      }
      assert.deepEqual(await snapshot(), before, 'All existing public records preserved exactly');
      assert.equal(
        (await db`select pg_get_functiondef('app_private.scoring_now()'::regprocedure) as ddl`)[0]
          .ddl,
        originalClock,
        'Trusted server clock restored',
      );
      writeFileSync(
        'artifacts/week1-isolated/scoring-fixture-recovery.json',
        JSON.stringify(
          { cleaned: true, clockRestored: true, originalRecordsPreserved: true },
          null,
          2,
        ) + '\n',
      );
    } finally {
      await db.end();
    }
  }
  try {
    await clock('2026-11-19T12:00+03');
    team = await account('Scoring Organizer', 'team');
  } catch (e) {
    await cleanup();
    throw e;
  }
  return {
    db,
    url,
    admin,
    users,
    activities,
    team,
    clock,
    account,
    assignment,
    submission,
    review,
    packet,
    cleanup,
  };
}
