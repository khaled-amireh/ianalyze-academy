import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { week1TestTarget } from '../scripts/week1-test-target.mjs';
import { datasetStatistics, BINGO_IGNORE_REASON } from '../src/features/week1/domain.ts';

test(
  'real isolated Supabase: immutable attempts, accurate statistics and independent concurrent actions',
  { skip: process.env.RUN_LOCAL_SUPABASE_TESTS !== '1' },
  async (t) => {
    const url = week1TestTarget(process.env.LOCAL_SUPABASE_URL),
      dbUrl = week1TestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database');
    assert.equal(new URL(url).port, '54331');
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const admin = createClient(url, process.env.LOCAL_SUPABASE_SECRET_KEY, options),
      sql = postgres(dbUrl, { max: 1 });
    const tables = [
      'profiles',
      'academy_weeks',
      'activities',
      'submissions',
      'rubrics',
      'rubric_criteria',
      'grades',
      'grade_criterion_scores',
      'announcements',
      'week1_datasets',
      'week1_bingo_boards',
      'week1_bingo_claims',
      'week1_session',
    ];
    async function snapshot() {
      const rows = {};
      for (const table of tables)
        rows[table] = (
          await sql`select count(*)::int as n,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) as hash from ${sql('public.' + table)} t`
        )[0];
      return rows;
    }
    const before = await snapshot(),
      users = [];
    const conns = [postgres(dbUrl, { max: 1 }), postgres(dbUrl, { max: 1 })];
    t.after(async () => {
      for (const user of users) {
        await user.api.auth.signOut();
        assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);
      }
      await Promise.all(conns.map((c) => c.end()));
      const after = await snapshot();
      await sql.end();
      assert.deepEqual(after, before, 'Existing records must be preserved');
    });
    async function account() {
      const email = `attempt-${randomUUID()}@example.test`,
        password = `Local-${randomUUID()}-Aa9!`;
      const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.ifError(r.error);
      const api = createClient(url, process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY, options),
        user = { api, id: r.data.user.id };
      users.push(user);
      assert.ifError((await api.auth.signInWithPassword({ email, password })).error);
      assert.ifError(
        (
          await api
            .from('profiles')
            .update({
              full_name: 'Synthetic Attempt Test',
              whatsapp: '+962790000001',
              major: 'Software Engineering',
              university: 'Another University',
              academic_year: 2,
              python_experience: 'none',
            })
            .eq('id', user.id)
        ).error,
      );
      assert.ifError(
        (await api.rpc('complete_registration', { p_consent_version: 'registration-v1' })).error,
      );
      return user;
    }
    const credentials = JSON.parse(
      readFileSync(
        new URL('../artifacts/week1-isolated/review-accounts.json', import.meta.url),
        'utf8',
      ),
    ).find((a) => a.role === 'team');
    const team = createClient(url, process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY, options);
    assert.ifError(
      (
        await team.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        })
      ).error,
    );
    const teamId = (await team.auth.getUser()).data.user.id;
    const stats = async () => {
      const r = await team.from('week1_datasets').select('*').eq('status', 'submitted');
      assert.ifError(r.error);
      return datasetStatistics(r.data);
    };
    const baseline = await stats(),
      a = await account(),
      b = await account();
    const payload = {
      title: 'Football',
      url: 'https://www.kaggle.com/datasets/example/football',
      topic: 'Sport',
      description: 'Synthetic match results',
      column1: 'team',
      column2: 'goals',
      column3: 'date',
      question: 'Which club scored most?',
      status: 'submitted',
    };
    const starts = await Promise.all([
      a.api.rpc('week1_start_dataset_attempt'),
      a.api.rpc('week1_start_dataset_attempt'),
    ]);
    starts.forEach((r) => assert.ifError(r.error));
    assert.equal(starts[0].data, starts[1].data);
    const first = starts[0].data;
    assert.deepEqual(await stats(), baseline);
    const pids = await Promise.all(
      conns.map(async (c) => (await c`select pg_backend_pid() as id`)[0].id),
    );
    assert.equal(new Set(pids).size, 2);
    const submitted = await Promise.all(
      conns.map((c) =>
        c.begin(async (tx) => {
          await tx`set local role authenticated`;
          await tx`select set_config('request.jwt.claim.sub',${a.id},true)`;
          return (
            await tx`select public.week1_save_dataset(${tx.json(payload)},1,${first}) as id`
          )[0].id;
        }),
      ),
    );
    assert.deepEqual(submitted, [first, first]);
    const firstRow = (await a.api.from('week1_datasets').select('*').eq('id', first).single()).data;
    assert.ok(firstRow.submitted_at);
    assert.equal(firstRow.version, 2);
    assert.ok(
      (
        await a.api.rpc('week1_save_dataset', {
          p_data: { ...payload, title: 'Overwrite' },
          p_version: 2,
          p_attempt_id: first,
        })
      ).error,
    );
    assert.ok(
      (
        await b.api.rpc('week1_save_dataset', {
          p_data: payload,
          p_version: 2,
          p_attempt_id: first,
        })
      ).error,
    );
    assert.equal((await b.api.from('week1_datasets').select('*').eq('id', first)).data.length, 0);
    assert.deepEqual(await stats(), { total: baseline.total + 1, students: baseline.students + 1 });
    const again = await Promise.all([
      a.api.rpc('week1_start_dataset_attempt', { p_previous_id: first }),
      a.api.rpc('week1_start_dataset_attempt', { p_previous_id: first }),
    ]);
    again.forEach((r) => assert.ifError(r.error));
    assert.equal(again[0].data, again[1].data);
    assert.notEqual(again[0].data, first);
    const second = again[0].data;
    const draft = (await a.api.from('week1_datasets').select('*').eq('id', second).single()).data;
    assert.equal(draft.title, '');
    assert.equal(draft.url, '');
    assert.equal(draft.status, 'draft');
    assert.deepEqual(await stats(), { total: baseline.total + 1, students: baseline.students + 1 });
    assert.ifError(
      (
        await a.api.rpc('week1_save_dataset', {
          p_data: { ...payload, title: 'Second' },
          p_version: 1,
          p_attempt_id: second,
        })
      ).error,
    );
    assert.ifError(
      (await b.api.rpc('week1_save_dataset', { p_data: payload, p_version: 0 })).error,
    );
    assert.deepEqual(await stats(), { total: baseline.total + 3, students: baseline.students + 2 });
    assert.deepEqual(
      (await a.api.from('week1_datasets').select('*').eq('id', first).single()).data,
      firstRow,
    );
    assert.ifError(
      (await a.api.rpc('week1_start_dataset_attempt', { p_previous_id: second })).error,
    );
    assert.deepEqual(await stats(), { total: baseline.total + 3, students: baseline.students + 2 });
    assert.equal((await a.api.from('week1_session').select('*')).data.length, 0);
    assert.ok((await a.api.rpc('week1_save_session', { p_topics: [], p_version: 1 })).error);
    // The unchanged Bingo review transition must still serialize independent reviewers.
    assert.ifError((await a.api.rpc('week1_start_bingo')).error);
    const board = (await a.api.from('week1_bingo_boards').select('*').single()).data;
    for (let i = 0; i < 4; i++)
      assert.ifError(
        (
          await a.api.rpc('week1_mark_bingo', {
            p_challenge: board.board_order[i],
            p_completed: true,
            p_version: i + 1,
            p_round_id: board.id,
          })
        ).error,
      );
    assert.ifError((await a.api.rpc('week1_claim_bingo', { p_round_id: board.id })).error);
    const claim = (await a.api.from('week1_bingo_claims').select('*').single()).data;
    const reviewed = await Promise.allSettled(
      conns.map((c, i) =>
        c.begin(async (tx) => {
          await tx`set local role authenticated`;
          await tx`select set_config('request.jwt.claim.sub',${teamId},true)`;
          await tx`select public.week1_review_bingo(${claim.id},${i ? 'rejected' : 'verified'},${BINGO_IGNORE_REASON})`;
        }),
      ),
    );
    assert.equal(reviewed.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(reviewed.find((r) => r.status === 'rejected').reason.code, '40001');
    assert.equal(
      (await b.api.from('week1_bingo_claims').select('*').eq('id', claim.id)).data.length,
      0,
    );
    assert.ifError((await a.api.rpc('week1_play_again', { p_round_id: board.id })).error);
    assert.equal(
      (await a.api.from('week1_bingo_claims').select('*').eq('id', claim.id)).data.length,
      1,
    );
  },
);
