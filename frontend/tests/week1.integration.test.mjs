import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { week1TestTarget as localTestTarget } from '../scripts/week1-test-target.mjs';
import { BINGO_IGNORE_REASON, isIgnoredClaim } from '../src/features/week1/domain.ts';

// Requires the real isolated stack and this migration. No production targets,
// existing students, credentials in output, simulated API, or fake auth sessions.
test(
  'real isolated Supabase: persistence, RLS and independent concurrent organizers',
  {
    skip: process.env.RUN_LOCAL_SUPABASE_TESTS !== '1',
  },
  async (t) => {
    const url = localTestTarget(process.env.LOCAL_SUPABASE_URL);
    const database = localTestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database');
    const key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
    const secret = process.env.LOCAL_SUPABASE_SECRET_KEY;
    assert.ok(key && secret);
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const admin = createClient(url, secret, options);
    const sql = postgres(database, { max: 2, connect_timeout: 5 });
    const users = [];
    const originalSession = (
      await sql`select to_jsonb(s) row from public.week1_session s where id=1`
    )[0].row;
    t.after(async () => {
      const current = (await sql`select topics from public.week1_session where id=1`)[0];
      assert.deepEqual(
        current.topics,
        originalSession.topics,
        'Never overwrite an independent session edit',
      );
      await sql`update public.week1_session set version=${originalSession.version},updated_at=${originalSession.updated_at},updated_by=${originalSession.updated_by} where id=1`;
      for (const user of users) {
        await sql`update public.week1_session set updated_by=null where updated_by=${user.id}`;
        await admin.auth.admin.deleteUser(user.id);
      }
      await sql.end();
    });
    async function account(team = false) {
      const email = `week1-${randomUUID()}@example.test`,
        password = `Week1-${randomUUID()}-Aa9!`;
      const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.ifError(result.error);
      users.push(result.data.user);
      const id = result.data.user.id;
      if (team)
        await sql`update app_private.user_roles set role='team',grant_reason='Synthetic local Week 1 integration test' where user_id=${id}`;
      const api = createClient(url, key, options);
      assert.ifError((await api.auth.signInWithPassword({ email, password })).error);
      assert.ifError(
        (
          await api
            .from('profiles')
            .update({
              full_name: 'Synthetic Week 1 Test',
              whatsapp: '+962790000001',
              major: 'Software Engineering',
              university: 'Another University',
              academic_year: 2,
              python_experience: 'none',
            })
            .eq('id', id)
        ).error,
      );
      assert.ifError(
        (await api.rpc('complete_registration', { p_consent_version: 'registration-v1' })).error,
      );
      return { api, id, email, password };
    }
    const a = await account(),
      b = await account(),
      leader = await account(true),
      organizer = await account(true);
    const payload = {
      title: 'Football',
      url: 'https://www.kaggle.com/datasets/example/football',
      topic: 'Sport',
      description: 'Match results',
      column1: 'team',
      column2: 'goals',
      column3: 'date',
      question: 'Which team scored most?',
      status: 'submitted',
    };
    assert.ifError(
      (await a.api.rpc('week1_save_dataset', { p_data: payload, p_version: 0 })).error,
    );
    assert.equal((await b.api.from('week1_datasets').select('*')).data.length, 0);
    assert.ifError(
      (
        await b.api.rpc('week1_save_dataset', {
          p_data: { ...payload, title: 'Second student dataset' },
          p_version: 0,
        })
      ).error,
    );
    assert.equal(
      (await b.api.from('week1_datasets').select('*').eq('student_id', a.id)).data.length,
      0,
    );
    assert.equal(
      (await a.api.from('week1_datasets').select('*').eq('student_id', b.id)).data.length,
      0,
    );
    for (const reviewer of [leader, organizer]) {
      const submissions = await reviewer.api
        .from('week1_datasets')
        .select('*')
        .in('student_id', [a.id, b.id]);
      assert.ifError(submissions.error);
      assert.equal(submissions.data.length, 2);
      assert.ok(submissions.data.every((row) => row.submitted_at && row.created_at));
      const names = await reviewer.api
        .from('profiles')
        .select('id,full_name')
        .in('id', [a.id, b.id]);
      assert.ifError(names.error);
      assert.equal(names.data.length, 2);
      assert.ok(names.data.every((row) => row.full_name));
    }
    assert.equal(
      (await leader.api.from('week1_datasets').select('*').eq('student_id', a.id)).data.length,
      1,
    );
    assert.ok(
      (
        await a.api.rpc('week1_save_dataset', {
          p_data: { ...payload, url: 'https://example.test' },
          p_version: 1,
        })
      ).error,
    );
    assert.ifError((await a.api.rpc('week1_start_bingo')).error);
    const initial = (await a.api.from('week1_bingo_boards').select('*').single()).data;
    assert.deepEqual(
      [...initial.board_order].sort((x, y) => x - y),
      Array.from({ length: 16 }, (_, i) => i),
    );
    assert.ifError((await a.api.rpc('week1_start_bingo')).error);
    const restored = createClient(url, key, options);
    assert.ifError(
      (await restored.auth.signInWithPassword({ email: a.email, password: a.password })).error,
    );
    const restoredDataset = (await restored.from('week1_datasets').select('*').single()).data;
    for (const field of Object.keys(payload)) assert.equal(restoredDataset[field], payload[field]);
    assert.deepEqual(
      (await restored.from('week1_bingo_boards').select('*').single()).data.board_order,
      initial.board_order,
    );
    assert.ok((await a.api.rpc('week1_claim_bingo')).error);
    for (let i = 0; i < 4; i++)
      assert.ifError(
        (
          await a.api.rpc('week1_mark_bingo', {
            p_challenge: initial.board_order[i],
            p_completed: true,
            p_version: i + 1,
          })
        ).error,
      );
    assert.equal(
      (await restored.from('week1_bingo_boards').select('*').single()).data.completed.length,
      4,
    );
    const duplicateAttempts = await Promise.all([
      a.api.rpc('week1_claim_bingo'),
      restored.rpc('week1_claim_bingo'),
    ]);
    assert.equal(duplicateAttempts.filter((result) => !result.error).length, 1);
    let claim = (
      await a.api.from('week1_bingo_claims').select('*').eq('status', 'pending').single()
    ).data;
    assert.ok(claim);
    assert.deepEqual(claim.board_snapshot, initial.board_order);
    assert.ok(
      (
        await b.api.rpc('week1_review_bingo', {
          p_id: claim.id,
          p_status: 'verified',
          p_reason: '',
        })
      ).error,
    );
    assert.ifError(
      (
        await leader.api.rpc('week1_review_bingo', {
          p_id: claim.id,
          p_status: 'rejected',
          p_reason: 'Please confirm the challenges in person',
        })
      ).error,
    );
    assert.ifError((await restored.rpc('week1_claim_bingo')).error);
    claim = (await a.api.from('week1_bingo_claims').select('*').eq('status', 'pending').single())
      .data;
    const connections = [postgres(database, { max: 1 }), postgres(database, { max: 1 })];
    const backendIds = await Promise.all(
      connections.map(
        async (connection) => (await connection`select pg_backend_pid() as id`)[0].id,
      ),
    );
    assert.equal(new Set(backendIds).size, 2, 'Reviewers must use independent PostgreSQL sessions');
    const reviews = await Promise.allSettled(
      connections.map((connection, index) =>
        connection.begin(async (tx) => {
          await tx`set local role authenticated`;
          await tx`select set_config('request.jwt.claim.sub',${index === 0 ? leader.id : organizer.id},true)`;
          await tx`select public.week1_review_bingo(${claim.id},${index === 0 ? 'verified' : 'rejected'},'Conflicting review')`;
        }),
      ),
    );
    await Promise.all(connections.map((connection) => connection.end()));
    assert.equal(reviews.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(reviews.find((result) => result.status === 'rejected').reason.code, '40001');
    const reviewed = (
      await restored.from('week1_bingo_claims').select('*').eq('id', claim.id).single()
    ).data;
    assert.ok(reviewed.reviewed_at && reviewed.reviewed_by);
    if (reviewed.status === 'rejected') {
      assert.ifError((await restored.rpc('week1_claim_bingo')).error);
      claim = (
        await restored.from('week1_bingo_claims').select('*').eq('status', 'pending').single()
      ).data;
      assert.ifError(
        (
          await leader.api.rpc('week1_review_bingo', {
            p_id: claim.id,
            p_status: 'verified',
            p_reason: '',
          })
        ).error,
      );
    }
    assert.ok((await a.api.rpc('week1_claim_bingo')).error);
    assert.equal((await b.api.from('week1_bingo_claims').select('*')).data.length, 0);
    assert.equal((await a.api.from('week1_session').select('*')).data.length, 0);
    const session = (await leader.api.from('week1_session').select('*').single()).data;
    assert.ok(session);
    assert.ok(
      (await a.api.rpc('week1_save_session', { p_topics: [], p_version: session.version })).error,
    );
    assert.deepEqual(
      (await organizer.api.from('week1_session').select('*').single()).data.topics,
      session.topics,
    );
    const edited = [
      {
        id: randomUUID(),
        title_en: 'Synthetic topic',
        title_ar: 'موضوع تجريبي',
        description: 'Local test',
        notes: 'Private synthetic note',
        links: 'https://example.test',
        status: 'planned',
      },
      ...session.topics.slice().reverse(),
    ];
    assert.ifError(
      (await leader.api.rpc('week1_save_session', { p_topics: edited, p_version: session.version }))
        .error,
    );
    let saved = (await organizer.api.from('week1_session').select('*').single()).data;
    assert.deepEqual(saved.topics, edited);
    edited[0].status = 'completed';
    assert.ifError(
      (
        await organizer.api.rpc('week1_save_session', {
          p_topics: edited,
          p_version: saved.version,
        })
      ).error,
    );
    saved = (await leader.api.from('week1_session').select('*').single()).data;
    assert.equal(saved.topics[0].status, 'completed');
    assert.equal((await a.api.from('week1_session').select('*')).data.length, 0);
    assert.ifError(
      (
        await leader.api.rpc('week1_save_session', {
          p_topics: session.topics,
          p_version: saved.version,
        })
      ).error,
    );
    // A new round never overwrites the verified one or bypasses a pending claim.
    const previous = (
      await a.api.from('week1_bingo_boards').select('*').is('retired_at', null).single()
    ).data;
    const preserved = (
      await a.api.from('week1_bingo_claims').select('*').eq('status', 'verified').single()
    ).data;
    const starts = await Promise.all([
      a.api.rpc('week1_play_again', { p_round_id: previous.id }),
      restored.rpc('week1_play_again', { p_round_id: previous.id }),
    ]);
    assert.equal(starts.filter((r) => !r.error).length, 1);
    const next = (
      await restored.from('week1_bingo_boards').select('*').is('retired_at', null).single()
    ).data;
    assert.notEqual(next.id, previous.id);
    assert.notDeepEqual(next.board_order, previous.board_order);
    assert.deepEqual(next.completed, []);
    assert.deepEqual(
      (await a.api.from('week1_bingo_claims').select('*').eq('id', preserved.id).single()).data,
      preserved,
    );
    for (let i = 0; i < 4; i++)
      assert.ifError(
        (
          await a.api.rpc('week1_mark_bingo', {
            p_challenge: next.board_order[i],
            p_completed: true,
            p_version: i + 1,
            p_round_id: next.id,
          })
        ).error,
      );
    assert.ifError((await a.api.rpc('week1_claim_bingo', { p_round_id: next.id })).error);
    const incoming = (
      await organizer.api.from('week1_bingo_claims').select('*').eq('round_id', next.id).single()
    ).data;
    assert.ok(incoming?.reference);
    assert.equal(incoming.status, 'pending');
    assert.ok(incoming.created_at);
    assert.equal(incoming.challenges.length, 4);
    assert.equal(
      (await b.api.from('week1_bingo_claims').select('*').eq('round_id', next.id)).data.length,
      0,
    );
    assert.ok((await a.api.rpc('week1_play_again', { p_round_id: next.id })).error);
    assert.ok(
      (
        await organizer.api.rpc('week1_review_bingo', {
          p_id: incoming.id,
          p_status: 'rejected',
          p_reason: '',
        })
      ).error,
    );
    assert.ifError(
      (
        await organizer.api.rpc('week1_review_bingo', {
          p_id: incoming.id,
          p_status: 'rejected',
          p_reason: BINGO_IGNORE_REASON,
        })
      ).error,
    );
    const ignored = (
      await restored.from('week1_bingo_claims').select('*').eq('id', incoming.id).single()
    ).data;
    assert.equal(isIgnoredClaim(ignored), true);
    assert.equal(ignored.reviewed_by, organizer.id);
    assert.ok(ignored.reviewed_at);
    assert.equal(
      (
        await leader.api
          .from('week1_bingo_claims')
          .select('*')
          .eq('id', incoming.id)
          .eq('status', 'pending')
      ).data.length,
      0,
    );
    assert.ok(
      (
        await leader.api.rpc('week1_review_bingo', {
          p_id: incoming.id,
          p_status: 'verified',
          p_reason: '',
        })
      ).error,
    );
    assert.ifError((await a.api.rpc('week1_play_again', { p_round_id: next.id })).error);
    assert.equal((await a.api.from('week1_bingo_boards').select('*')).data.length, 3);
    assert.equal(
      (await a.api.from('week1_bingo_boards').select('*').is('retired_at', null)).data.length,
      1,
    );
  },
);
