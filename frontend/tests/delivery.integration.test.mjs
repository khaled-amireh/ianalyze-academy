import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { localTestTarget } from '../scripts/local-test-target.mjs';

describe(
  'functional delivery against disposable local Supabase and Edge runtime',
  { skip: process.env.RUN_LOCAL_SUPABASE_TESTS !== '1' },
  () => {
    let sql, admin, a, b, team, organizer, url, key, secret;
    const users = [],
      paths = [],
      ids = {
        week: randomUUID(),
        activity: randomUUID(),
        rubric: randomUUID(),
        criterion: randomUUID(),
        request: randomUUID(),
      };
    const notebook = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          id: 'local-test',
          cell_type: 'code',
          metadata: {},
          source: 'print("LOCAL TEST ONLY")',
          execution_count: null,
          outputs: [],
        },
      ],
    });
    const options = {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    };
    const invoke = async (user, body = notebook, request = ids.request, extra = {}) => {
      const token = user ? (await user.client.auth.getSession()).data.session?.access_token : null;
      return fetch(`${url}/functions/v1/notebook-submit`, {
        method: 'POST',
        headers: {
          apikey: key,
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : { Authorization: 'Bearer invalid-token' }),
          'Content-Type': 'application/x-ipynb+json',
          'X-Activity-ID': ids.activity,
          'X-Request-ID': request,
          'X-Filename': 'work.ipynb',
          ...extra,
        },
        body,
      });
    };
    before(async () => {
      url = localTestTarget(process.env.LOCAL_SUPABASE_URL);
      const db = localTestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database');
      key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
      secret = process.env.LOCAL_SUPABASE_SECRET_KEY;
      assert.ok(key && secret);
      sql = postgres(db, { max: 1 });
      assert.equal(
        (
          await sql`select app_private.uploads_enabled() as legacy,app_private.submission_service_enabled() as service,app_private.leaderboard_enabled() as leaderboard`
        )[0].legacy,
        false,
      );
      assert.equal(
        (await sql`select app_private.submission_service_enabled() as enabled`)[0].enabled,
        false,
      );
      assert.equal(
        Number((await sql`select count(*) as n from public.academy_weeks`)[0].n),
        0,
        'Fresh disposable database required',
      );
      admin = createClient(url, secret, options);
      for (const name of ['a', 'b', 'team', 'organizer']) {
        const email = `delivery-${name}-${randomUUID()}@example.test`,
          password = `Local-${randomUUID()}-Aa9!`;
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        assert.equal(created.error, null);
        users.push(created.data.user.id);
        const client = createClient(url, key, options);
        assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
        assert.equal(
          (
            await client
              .from('profiles')
              .update({
                full_name: 'LOCAL TEST ONLY',
                whatsapp: '+962790000000',
                major: 'Data Science & Artificial Intelligence',
                university: 'Local Test University',
                academic_year: 4,
                python_experience: 'none',
              })
              .eq('id', created.data.user.id)
          ).error,
          null,
        );
        assert.equal(
          (await client.rpc('complete_registration', { p_consent_version: 'registration-v1' }))
            .error,
          null,
        );
        const user = { id: created.data.user.id, client };
        if (name === 'a') a = user;
        if (name === 'b') b = user;
        if (name === 'team') team = user;
        if (name === 'organizer') organizer = user;
      }
      await sql`update app_private.user_roles set role='team',grant_reason='LOCAL TEST ONLY: Leader' where user_id=${team.id}`;
      await sql`update app_private.user_roles set role='team',grant_reason='LOCAL TEST ONLY: Organizer' where user_id=${organizer.id}`;
      await sql`insert into public.academy_weeks(id,week_number,kind,title_ar,title_en,status) values(${ids.week},1,'teaching','LOCAL TEST ONLY','LOCAL TEST ONLY','published')`;
      await sql`insert into public.activities(id,week_id,title_ar,title_en,instructions_ar,instructions_en,max_score,status) values(${ids.activity},${ids.week},'LOCAL TEST ONLY','LOCAL TEST ONLY','LOCAL TEST ONLY','LOCAL TEST ONLY',10,'published')`;
      await sql`insert into public.rubrics(id,activity_id,version) values(${ids.rubric},${ids.activity},1)`;
      await sql`insert into public.rubric_criteria(id,rubric_id,label_ar,label_en,max_points,sort_order) values(${ids.criterion},${ids.rubric},'LOCAL TEST ONLY','LOCAL TEST ONLY',10,0)`;
      await sql`update public.rubrics set status='published' where id=${ids.rubric}`;
    });
    after(async () => {
      if (!sql) return;
      try {
        await sql`create or replace function app_private.submission_service_enabled() returns boolean language sql immutable set search_path='' as $$select false$$`;
        await sql`create or replace function app_private.leaderboard_enabled() returns boolean language sql immutable set search_path='' as $$select false$$`;
        if (admin) {
          const objects = await admin.storage
            .from('student-submissions')
            .list(a?.id ?? 'not-a-real-user');
          // Exact paths are collected only from this suite's UUID-scoped reservations.
          void objects;
          for (const path of paths)
            assert.equal(
              (await admin.storage.from('student-submissions').remove([path])).error,
              null,
            );
        }
        await sql.begin(async (tx) => {
          await tx`set local session_replication_role=replica`;
          await tx`delete from public.grade_criterion_scores where grade_id in(select id from public.grades where submission_id in(select id from public.submissions where activity_id=${ids.activity}))`;
          await tx`delete from public.grades where submission_id in(select id from public.submissions where activity_id=${ids.activity})`;
          await tx`delete from public.submissions where activity_id=${ids.activity}`;
          await tx`delete from public.rubric_criteria where rubric_id in(select id from public.rubrics where activity_id=${ids.activity})`;
          await tx`delete from public.rubrics where activity_id=${ids.activity}`;
          await tx`delete from public.activities where id=${ids.activity}`;
          await tx`delete from public.academy_weeks where id=${ids.week}`;
        });
        for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
      } finally {
        await sql.end();
      }
    });
    it('rejects invalid identity and closed gates before storing any file', async () => {
      assert.equal((await invoke(null)).status, 401);
      assert.equal((await invoke(a)).status, 503);
      assert.ok(
        (
          await a.client.rpc('reserve_notebook', {
            p_student_id: a.id,
            p_activity_id: ids.activity,
            p_request_id: ids.request,
            p_sha256: 'a'.repeat(64),
            p_bytes: 1,
          })
        ).error,
      );
      assert.ok(
        (
          await team.client.rpc('finalize_notebook', {
            p_submission_id: ids.request,
            p_sha256: 'a'.repeat(64),
          })
        ).error,
      );
    });
    it('Leader and Organizer share Team permissions; editable metadata never grants them', async () => {
      for (const member of [team, organizer]) {
        assert.equal((await member.client.rpc('current_academy_role')).data, 'team');
        const profiles = await member.client.from('profiles').select('id,whatsapp').eq('id', a.id);
        assert.equal(profiles.error, null);
        assert.equal(profiles.data.length, 1);
        const activity = await member.client
          .from('activities')
          .update({ instructions_en: 'LOCAL TEST ONLY' })
          .eq('id', ids.activity)
          .select('id');
        assert.equal(activity.error, null);
        assert.equal(activity.data.length, 1);
      }
      assert.equal(
        (await a.client.auth.updateUser({ data: { role: 'team', leader: true, organizer: true } }))
          .error,
        null,
      );
      assert.equal((await a.client.rpc('current_academy_role')).data, 'student');
      assert.ok(
        (
          await a.client.from('activities').insert({
            week_id: ids.week,
            title_ar: 'اختبار',
            title_en: 'LOCAL TEST ONLY',
            max_score: 10,
          })
        ).error,
      );
    });
    it('allows atomic Team draft rubric creation/editing and rejects Student or immutable edits', async () => {
      const criteria = [{ label_ar: 'اختبار محلي', label_en: 'LOCAL DRAFT ONLY', max_points: 10 }];
      assert.ok(
        (
          await a.client.rpc('create_draft_rubric', {
            p_activity_id: ids.activity,
            p_criteria: criteria,
          })
        ).error,
      );
      const invalid = await team.client.rpc('create_draft_rubric', {
        p_activity_id: ids.activity,
        p_criteria: [{ ...criteria[0], max_points: -1 }],
      });
      assert.ok(invalid.error);
      assert.equal(
        Number(
          (await sql`select count(*) as n from public.rubrics where activity_id=${ids.activity}`)[0]
            .n,
        ),
        1,
      );
      const made = await team.client.rpc('create_draft_rubric', {
        p_activity_id: ids.activity,
        p_criteria: criteria,
      });
      assert.equal(made.error, null);
      assert.equal(
        (
          await team.client.rpc('save_draft_rubric', {
            p_rubric_id: made.data,
            p_criteria: [
              { ...criteria[0], max_points: 4 },
              { ...criteria[0], max_points: 6 },
            ],
          })
        ).error,
        null,
      );
      assert.ok(
        (
          await team.client.rpc('save_draft_rubric', {
            p_rubric_id: ids.rubric,
            p_criteria: criteria,
          })
        ).error,
      );
    });
    it('validates real Edge uploads, rejects HTML/oversize/origins, and leaves legacy browser uploads closed', async () => {
      // Local-only operator overrides, restored in teardown. Never committed as activation migrations.
      await sql`create or replace function app_private.submission_service_enabled() returns boolean language sql immutable set search_path='' as $$select true$$`;
      assert.equal(
        (await invoke(a, notebook, randomUUID(), { Origin: 'https://untrusted.example' })).status,
        403,
      );
      assert.equal((await invoke(a, '<html>bad</html>', randomUUID())).status, 400);
      assert.equal((await invoke(a, ' '.repeat(262145), randomUUID())).status, 400);
      assert.equal((await invoke(team)).status, 403);
      const concurrent = await Promise.all([invoke(a), invoke(a)]);
      for (const result of concurrent) {
        assert.equal(result.status, 200, `Edge upload status ${result.status}`);
        assert.equal((await result.json()).status, 'submitted');
      }
      const row = (await sql`select * from public.submissions where id=${ids.request}`)[0];
      assert.equal(row.status, 'submitted');
      assert.equal(row.notebook_bytes, Buffer.byteLength(notebook));
      paths.push(row.object_path);
      assert.equal(
        (
          await a.client.storage
            .from('student-submissions')
            .upload(row.object_path, '{}', { upsert: true, contentType: 'application/json' })
        ).error !== null,
        true,
      );
      assert.equal((await sql`select app_private.uploads_enabled() as enabled`)[0].enabled, false);
    });
    it('is idempotent, enforces ownership, and requires a Team resubmission request', async () => {
      assert.equal((await invoke(a)).status, 200);
      assert.equal(
        Number(
          (await sql`select count(*) as n from public.submissions where student_id=${a.id}`)[0].n,
        ),
        1,
      );
      assert.equal((await invoke(b, notebook, ids.request)).status, 409);
      assert.equal((await invoke(a, notebook, randomUUID())).status, 409);
      assert.ok((await b.client.storage.from('student-submissions').download(paths[0])).error);
      assert.equal(
        (await team.client.storage.from('student-submissions').download(paths[0])).error,
        null,
      );
      assert.equal(
        (await team.client.rpc('request_resubmission', { p_submission_id: ids.request })).error,
        null,
      );
      const second = randomUUID();
      assert.equal((await invoke(a, notebook, second)).status, 200);
      paths.push(
        (await sql`select object_path from public.submissions where id=${second}`)[0].object_path,
      );
      assert.equal((await invoke(a, notebook, randomUUID())).status, 409);
    });
    it('publishes real rubric grades and returns pseudonymous deterministic rankings only', async () => {
      const submission = (
        await sql`select id from public.submissions where student_id=${a.id} and activity_id=${ids.activity} and attempt=2`
      )[0];
      const args = {
        p_submission_id: submission.id,
        p_scores: { [ids.criterion]: 9 },
        p_feedback: 'LOCAL TEST feedback',
        p_expected_revision: 0,
        p_publish: true,
      };
      assert.equal(
        (await team.client.rpc('save_grade', { ...args, p_publish: false })).error,
        null,
      );
      assert.equal(
        (await sql`select status from public.submissions where id=${submission.id}`)[0].status,
        'under_review',
      );
      assert.deepEqual((await a.client.from('grades').select('*')).data, []);
      assert.equal(
        (await organizer.client.rpc('save_grade', { ...args, p_expected_revision: 1 })).error,
        null,
      );
      assert.equal(
        (await sql`select status from public.submissions where id=${submission.id}`)[0].status,
        'reviewed',
      );
      assert.ok(
        (await a.client.from('submissions').update({ status: 'reviewed' }).eq('id', submission.id))
          .error,
      );
      assert.equal(
        (await team.client.rpc('save_grade', { ...args, p_publish: false, p_expected_revision: 2 }))
          .error,
        null,
      );
      assert.equal(
        (await sql`select status from public.submissions where id=${submission.id}`)[0].status,
        'reviewed',
        'An unpublished correction does not hide existing published review',
      );
      assert.equal(
        (
          await team.client.rpc('save_grade', {
            ...args,
            p_submission_id: ids.request,
            p_publish: false,
          })
        ).error,
        null,
      );
      assert.equal(
        (await sql`select status from public.submissions where id=${ids.request}`)[0].status,
        'resubmission_required',
        'Keep the explicit resubmission request',
      );
      assert.deepEqual((await b.client.from('grades').select('*')).data, []);
      const anonymous = createClient(url, key, options);
      assert.deepEqual((await anonymous.rpc('academy_leaderboard')).data, []);
      await sql`create or replace function app_private.leaderboard_enabled() returns boolean language sql immutable set search_path='' as $$select true$$`;
      const first = await anonymous.rpc('academy_leaderboard');
      assert.equal(first.error, null);
      assert.equal(first.data.length, 1);
      assert.deepEqual(Object.keys(first.data[0]).sort(), [
        'activities',
        'alias',
        'points',
        'rank',
      ]);
      assert.match(first.data[0].alias, /^Learner [a-f0-9]{10}$/);
      assert.equal(first.data[0].points, 9);
      assert.deepEqual((await anonymous.rpc('academy_leaderboard')).data, first.data);
      assert.equal(JSON.stringify(first.data).includes(a.id), false);
      assert.equal(JSON.stringify(first.data).includes('+962'), false);
    });
    it('counts the best attempt once and ranks tied students deterministically without private fields', async () => {
      const request = randomUUID();
      assert.equal((await invoke(b, notebook, request)).status, 200);
      const uploaded = (
        await sql`select object_path from public.submissions where id=${request}`
      )[0];
      paths.push(uploaded.object_path);
      for (const [id, revision] of [
        [ids.request, 1],
        [request, 0],
      ]) {
        assert.equal(
          (
            await organizer.client.rpc('save_grade', {
              p_submission_id: id,
              p_scores: { [ids.criterion]: 9 },
              p_feedback: 'LOCAL TIE TEST ONLY',
              p_expected_revision: revision,
              p_publish: true,
            })
          ).error,
          null,
        );
      }
      const anonymous = createClient(url, key, options);
      const first = await anonymous.rpc('academy_leaderboard');
      assert.equal(first.error, null);
      assert.equal(first.data.length, 2);
      assert.deepEqual(
        first.data.map((row) => [row.rank, row.points, row.activities]),
        [
          [1, 9, 1],
          [2, 9, 1],
        ],
      );
      assert.notEqual(first.data[0].alias, first.data[1].alias);
      for (const row of first.data)
        assert.deepEqual(Object.keys(row).sort(), ['activities', 'alias', 'points', 'rank']);
      assert.deepEqual((await anonymous.rpc('academy_leaderboard')).data, first.data);
    });
    it('enforces deadline and request throttling through the database', async () => {
      await sql`update public.activities set due_at=now()-interval '1 hour' where id=${ids.activity}`;
      assert.equal((await invoke(b, notebook, randomUUID())).status, 409);
      await sql`update public.activities set due_at=null where id=${ids.activity}`;
      for (let i = 0; i < 10; i++)
        await admin.rpc('claim_submission_request', { p_student_id: b.id });
      const result = await admin.rpc('claim_submission_request', { p_student_id: b.id });
      assert.ok(result.error);
      assert.equal((await invoke(b, notebook, randomUUID())).status, 429);
    });
  },
);
