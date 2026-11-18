import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { week1TestTarget } from '../scripts/week1-test-target.mjs';
test(
  'real isolated Auth/Storage/PostgreSQL assignments, awards, concurrency and private session content',
  { skip: process.env.RUN_LOCAL_SUPABASE_TESTS !== '1' },
  async (t) => {
    const url = week1TestTarget(process.env.LOCAL_SUPABASE_URL),
      dbUrl = week1TestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database');
    assert.equal(new URL(url).port, '54331');
    const options = { auth: { persistSession: false, autoRefreshToken: false } },
      admin = createClient(url, process.env.LOCAL_SUPABASE_SECRET_KEY, options),
      sql = postgres(dbUrl, { max: 1 });
    const tables = (
      await sql`select tablename from pg_tables where schemaname='public' order by tablename`
    ).map((x) => x.tablename);
    async function snapshot() {
      const result = {};
      for (const table of tables)
        result[table] = (
          await sql`select count(*)::int as count,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) as hash from ${sql('public.' + table)} t`
        )[0];
      return result;
    }
    const before = await snapshot(),
      users = [],
      activities = [],
      paths = [],
      connections = [postgres(dbUrl, { max: 1 }), postgres(dbUrl, { max: 1 })];
    const credentials = JSON.parse(
      readFileSync(
        new URL('../artifacts/week1-isolated/review-accounts.json', import.meta.url),
        'utf8',
      ),
    ).find((x) => x.role === 'team');
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
    const checks = [];
    assert.equal(
      (await sql`select count(*)::int as n from public.week1_session where id=99`)[0].n,
      0,
    );
    t.after(async () => {
      if (paths.length)
        assert.ifError((await admin.storage.from('student-submissions').remove(paths)).error);
      for (const id of activities) {
        await sql`delete from public.point_awards where source_key=${'assignment:' + id}`;
        await sql`delete from public.grades where submission_id in(select id from public.submissions where activity_id=${id})`;
        await sql`delete from public.submissions where activity_id=${id}`;
        await sql`update public.activities set status='draft' where id=${id}`;
        await sql`delete from public.activities where id=${id}`;
      }
      await sql`delete from public.session_public_content where week_number=99`;
      await sql`delete from public.week1_session where id=99`;
      for (const u of users) {
        await sql`delete from public.point_awards where student_id=${u.id}`;
        await u.api.auth.signOut();
        assert.ifError((await admin.auth.admin.deleteUser(u.id)).error);
      }
      await team.auth.signOut();
      await Promise.all(connections.map((c) => c.end()));
      const after = await snapshot();
      await sql.end();
      assert.deepEqual(after, before, 'All existing records must remain byte-identical');
    });
    async function account() {
      const email = `assignment-${randomUUID()}@example.test`,
        password = `Local-${randomUUID()}-Aa9!`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.ifError(created.error);
      const api = createClient(url, process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY, options),
        id = created.data.user.id;
      const user = { api, id };
      users.push(user);
      assert.ifError((await api.auth.signInWithPassword({ email, password })).error);
      assert.ifError(
        (
          await api
            .from('profiles')
            .update({
              full_name: 'Synthetic Assignment Student',
              whatsapp: '+962790000001',
              major: 'AI',
              university: 'Other University',
              academic_year: 2,
              python_experience: 'none',
            })
            .eq('id', id)
        ).error,
      );
      assert.ifError(
        (await api.rpc('complete_registration', { p_consent_version: 'registration-v1' })).error,
      );
      return user;
    }
    const a = await account(),
      b = await account();
    const now = Date.now(),
      date = (n) => new Date(now + n).toISOString();
    const config = {
      title_en: 'Synthetic Assignment ' + randomUUID(),
      title_ar: 'Synthetic Assignment',
      instructions_en: 'Local integration only',
      instructions_ar: 'Local integration only',
      reference_links: 'https://example.test',
      submission_type: 'either',
      publish_at: date(-7200000),
      due_at: date(7200000),
      phases: [
        { name: 'Early', start: date(-7200000), end: date(3600000), points: 20 },
        { name: 'Regular', start: date(3600000), end: date(7200000), points: 15 },
      ],
      status: 'draft',
      accepting: true,
      archived: false,
      sort_order: 0,
    };
    async function create(overrides = {}) {
      const r = await team.rpc('save_assignment', {
        p_data: { ...config, ...overrides },
        p_version: 0,
      });
      assert.ifError(r.error);
      activities.push(r.data);
      return r.data;
    }
    const id = await create();
    assert.equal((await a.api.from('activities').select('*').eq('id', id)).data.length, 0);
    assert.ok((await a.api.rpc('save_assignment', { p_data: config, p_version: 0 })).error);
    assert.ifError(
      (
        await team.rpc('save_assignment', {
          p_id: id,
          p_data: { ...config, status: 'published' },
          p_version: 1,
        })
      ).error,
    );
    assert.equal((await a.api.from('activities').select('*').eq('id', id)).data.length, 1);
    const invalidPhase = await team.rpc('save_assignment', {
      p_data: { ...config, phases: [config.phases[0], { ...config.phases[1], start: date(0) }] },
      p_version: 0,
    });
    assert.ok(invalidPhase.error);
    for (const link of [
      'https:///',
      'https://example.test:99999/work',
      'https://user:password@example.test/',
    ])
      assert.ok(
        (
          await a.api.rpc('submit_assignment', {
            p_activity: id,
            p_request: randomUUID(),
            p_link: link,
          })
        ).error,
      );
    const pids = await Promise.all(
      connections.map(async (c) => (await c`select pg_backend_pid() as id`)[0].id),
    );
    assert.equal(new Set(pids).size, 2);
    const request = randomUUID();
    const submissions = await Promise.all(
      connections.map((c) =>
        c.begin(async (tx) => {
          await tx`set local role authenticated`;
          await tx`select set_config('request.jwt.claim.sub',${a.id},true)`;
          return (
            await tx`select public.submit_assignment(${id},${request},'https://example.test/work') as id`
          )[0].id;
        }),
      ),
    );
    assert.deepEqual(submissions, [request, request]);
    const submitted = (await a.api.from('submissions').select('*').eq('id', request).single()).data;
    assert.equal(submitted.phase_snapshot.name, 'Early');
    assert.equal(submitted.max_eligible_points, 20);
    assert.ok(submitted.submitted_at);
    assert.equal((await b.api.from('submissions').select('*').eq('id', request)).data.length, 0);
    assert.ok(
      (
        await a.api
          .from('submissions')
          .update({ submitted_at: date(-99999) })
          .eq('id', request)
      ).error,
    );
    assert.ok(
      (
        await a.api.rpc('review_assignment', {
          p_submission: request,
          p_points: 20,
          p_feedback: 'Forged',
          p_revision: 0,
        })
      ).error,
    );
    for (const points of [-1, 20.01, 1.001])
      assert.ok(
        (
          await team.rpc('review_assignment', {
            p_submission: request,
            p_points: points,
            p_feedback: 'Invalid',
            p_revision: 0,
          })
        ).error,
      );
    const reviews = await Promise.allSettled(
      connections.map((c, i) =>
        c.begin(async (tx) => {
          await tx`set local role authenticated`;
          await tx`select set_config('request.jwt.claim.sub',${teamId},true)`;
          await tx`select public.review_assignment(${request},${i ? 12 : 17.25},'Private review',0)`;
        }),
      ),
    );
    assert.equal(reviews.filter((x) => x.status === 'fulfilled').length, 1);
    assert.equal(reviews.find((x) => x.status === 'rejected').reason.code, '40001');
    assert.ifError(
      (
        await team.rpc('review_assignment', {
          p_submission: request,
          p_points: 16,
          p_feedback: 'Corrected feedback',
          p_revision: 1,
        })
      ).error,
    );
    const awarded = (
      await a.api
        .from('point_awards')
        .select('*')
        .eq('source_key', 'assignment:' + id)
    ).data;
    assert.equal(awarded.length, 1);
    assert.equal(awarded[0].points, 16);
    assert.equal(
      (await b.api.from('grades').select('*').eq('submission_id', request)).data.length,
      0,
    );
    assert.ifError(
      (
        await team.rpc('save_assignment', {
          p_id: id,
          p_data: { ...config, status: 'draft', archived: true },
          p_version: 2,
        })
      ).error,
    );
    assert.equal((await a.api.from('activities').select('*').eq('id', id)).data.length, 0);
    assert.equal(
      (
        await a.api
          .from('point_awards')
          .select('*')
          .eq('source_key', 'assignment:' + id)
      ).data[0].points,
      16,
    );
    assert.ok((await team.from('activities').delete().eq('id', id)).error);
    checks.push(
      'Real Auth, hidden visibility, immutable submissions, decimal grading, original phase, independent-connection duplicate submission/review serialization, corrections and archive preservation',
    );
    const fileId = await create({ status: 'published', submission_type: 'file' }),
      file = Buffer.from('%PDF-1.7\nLocal synthetic PDF\n%%EOF');
    const reserve = await a.api.rpc('submit_assignment', {
      p_activity: fileId,
      p_request: randomUUID(),
      p_file: { name: 'review.pdf', mime: 'application/pdf', bytes: file.length },
    });
    assert.ifError(reserve.error);
    const fileRow = (await a.api.from('submissions').select('*').eq('id', reserve.data).single())
      .data;
    paths.push(fileRow.attachment_path);
    assert.ok((await a.api.rpc('finalize_assignment', { p_submission: fileRow.id })).error);
    assert.ok(
      (
        await b.api.storage
          .from('student-submissions')
          .upload(fileRow.attachment_path, file, { contentType: 'application/pdf' })
      ).error,
    );
    assert.ok(
      (
        await a.api.storage
          .from('student-submissions')
          .upload(fileRow.attachment_path, file, { contentType: 'image/png' })
      ).error,
    );
    assert.ok(
      (
        await a.api.storage
          .from('student-submissions')
          .upload(fileRow.attachment_path, Buffer.alloc(20971521), {
            contentType: 'application/pdf',
          })
      ).error,
    );
    assert.ifError(
      (
        await a.api.storage
          .from('student-submissions')
          .upload(fileRow.attachment_path, file, { contentType: 'application/pdf', upsert: false })
      ).error,
    );
    assert.ifError((await a.api.rpc('finalize_assignment', { p_submission: fileRow.id })).error);
    const download = await a.api.storage
      .from('student-submissions')
      .download(fileRow.attachment_path);
    assert.ifError(download.error);
    assert.deepEqual(Buffer.from(await download.data.arrayBuffer()), file);
    assert.ok(
      (await b.api.storage.from('student-submissions').download(fileRow.attachment_path)).error,
    );
    assert.ifError(
      (await team.storage.from('student-submissions').download(fileRow.attachment_path)).error,
    );
    assert.equal(
      (
        await fetch(
          url + '/storage/v1/object/public/student-submissions/' + fileRow.attachment_path,
        )
      ).ok,
      false,
    );
    assert.ok(
      (
        await a.api.storage
          .from('student-submissions')
          .upload(fileRow.attachment_path, Buffer.from('overwrite'), {
            contentType: 'application/pdf',
            upsert: true,
          })
      ).error,
    );
    checks.push(
      'Real private Storage upload/download, actual 20 MiB limit, MIME rejection, metadata finalization, foreign/public read and overwrite denial',
    );
    const expired = await create({
      status: 'published',
      due_at: date(-1),
      phases: [{ ...config.phases[0], end: date(-1) }],
    });
    assert.ok(
      (
        await b.api.rpc('submit_assignment', {
          p_activity: expired,
          p_request: randomUUID(),
          p_link: 'https://example.test/work',
        })
      ).error,
    );
    const boundary = Date.now() + 1600,
      closing = await create({
        status: 'published',
        publish_at: date(-1000),
        due_at: new Date(boundary).toISOString(),
        phases: [
          { name: 'Closing', start: date(-1000), end: new Date(boundary).toISOString(), points: 8 },
        ],
      });
    await new Promise((r) => setTimeout(r, Math.max(0, boundary - Date.now() + 20)));
    assert.ok(
      (
        await b.api.rpc('submit_assignment', {
          p_activity: closing,
          p_request: randomUUID(),
          p_link: 'https://example.test/work',
        })
      ).error,
    );
    checks.push('Trusted server deadline, including the exact exclusive closing boundary');
    const dataset = {
      title: 'Synthetic dataset',
      url: 'https://www.kaggle.com/datasets/example/football',
      topic: 'Sport',
      description: 'Synthetic data',
      column1: 'team',
      column2: 'goals',
      column3: 'date',
      question: 'Who scored most?',
      status: 'submitted',
    };
    const first = await a.api.rpc('week1_save_dataset', { p_data: dataset, p_version: 0 });
    assert.ifError(first.error);
    const second = await a.api.rpc('week1_start_dataset_attempt', { p_previous_id: first.data });
    assert.ifError(second.error);
    assert.ifError(
      (
        await a.api.rpc('week1_save_dataset', {
          p_data: { ...dataset, title: 'Another attempt' },
          p_version: 1,
          p_attempt_id: second.data,
        })
      ).error,
    );
    assert.equal(
      (await a.api.from('point_awards').select('*').eq('source_key', 'dataset:week1')).data.length,
      0,
    );
    const approvals = await Promise.all([
      team.rpc('approve_dataset_participation', { p_attempt: first.data }),
      team.rpc('approve_dataset_participation', { p_attempt: second.data }),
    ]);
    approvals.forEach((r) => assert.ifError(r.error));
    assert.equal(
      (await a.api.from('point_awards').select('*').eq('source_key', 'dataset:week1')).data.length,
      1,
    );
    assert.equal(
      (await a.api.from('point_awards').select('*').eq('source_key', 'dataset:week1')).data[0]
        .points,
      5,
    );
    const beforeBingo = (await a.api.from('point_awards').select('*')).data;
    assert.ifError((await a.api.rpc('week1_start_bingo')).error);
    const board = (await a.api.from('week1_bingo_boards').select('*').single()).data;
    for (let i = 0; i < 4; i++)
      assert.ifError(
        (
          await a.api.rpc('week1_mark_bingo', {
            p_round_id: board.id,
            p_challenge: board.board_order[i],
            p_completed: true,
            p_version: i + 1,
          })
        ).error,
      );
    assert.ifError((await a.api.rpc('week1_claim_bingo', { p_round_id: board.id })).error);
    const claim = (await a.api.from('week1_bingo_claims').select('*').single()).data;
    assert.ifError(
      (await team.rpc('week1_review_bingo', { p_id: claim.id, p_status: 'verified', p_reason: '' }))
        .error,
    );
    assert.ifError((await a.api.rpc('week1_play_again', { p_round_id: board.id })).error);
    assert.deepEqual((await a.api.from('point_awards').select('*')).data, beforeBingo);
    checks.push(
      'Dataset approval exactly five once across multiple attempts; Bingo verification/replay/history never changes awards',
    );
    const tie = await create({ status: 'published' });
    const sb = await b.api.rpc('submit_assignment', {
      p_activity: tie,
      p_request: randomUUID(),
      p_link: 'https://example.test/work',
    });
    assert.ifError(sb.error);
    assert.ifError(
      (
        await team.rpc('review_assignment', {
          p_submission: sb.data,
          p_points: 16,
          p_feedback: 'Approved',
          p_revision: 0,
        })
      ).error,
    );
    assert.ifError(
      (await a.api.from('profiles').update({ leaderboard_name: 'Local Ranking A' }).eq('id', a.id))
        .error,
    );
    assert.ifError(
      (await b.api.from('profiles').update({ leaderboard_name: 'Local Ranking B' }).eq('id', b.id))
        .error,
    );
    const all = (await a.api.rpc('academy_leaderboard', { p_weekly: false })).data,
      week = (await a.api.rpc('academy_leaderboard', { p_weekly: true })).data;
    assert.equal(all.find((x) => x.alias === 'Local Ranking A').points, 21);
    assert.equal(all.find((x) => x.alias === 'Local Ranking B').points, 16);
    const expectedOrder =
      a.id < b.id ? ['Local Ranking A', 'Local Ranking B'] : ['Local Ranking B', 'Local Ranking A'];
    assert.deepEqual(
      week.filter((x) => x.alias.startsWith('Local Ranking')).map((x) => x.alias),
      expectedOrder,
    );
    const period = (await a.api.rpc('academy_rankings', { p_view: 'current' })).data;
    const awards = (await a.api.from('point_awards').select('*')).data;
    const currentPoints =
      period.period.state === 'current'
        ? awards
            .filter((x) => x.scoring_week === period.period.week)
            .reduce((sum, x) => sum + Number(x.points), 0)
        : 0;
    assert.equal(week.find((x) => x.alias === 'Local Ranking A').points, currentPoints);
    assert.ok(!JSON.stringify(all).includes(a.id));
    assert.ok(!JSON.stringify(all).includes('feedback'));
    checks.push(
      'Public ranking totals, source-period weekly filtering, deterministic ties and explicitly opted-in names without private fields',
    );
    const phaseBoundary = Date.now() + 1400;
    const timed = await create({
      status: 'published',
      phases: [
        {
          name: 'Original phase',
          start: config.publish_at,
          end: new Date(phaseBoundary).toISOString(),
          points: 20,
        },
        {
          name: 'Later phase',
          start: new Date(phaseBoundary).toISOString(),
          end: config.due_at,
          points: 10,
        },
      ],
    });
    const timedSubmission = await a.api.rpc('submit_assignment', {
      p_activity: timed,
      p_request: randomUUID(),
      p_link: 'https://example.test/timed',
    });
    assert.ifError(timedSubmission.error);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, phaseBoundary - Date.now() + 20)),
    );
    assert.ifError(
      (
        await team.rpc('review_assignment', {
          p_submission: timedSubmission.data,
          p_points: 20,
          p_feedback: 'Original phase eligibility retained',
          p_revision: 0,
        })
      ).error,
    );
    const timedSaved = (
      await a.api.from('submissions').select('*').eq('id', timedSubmission.data).single()
    ).data;
    assert.equal(timedSaved.phase_snapshot.name, 'Original phase');
    assert.equal(timedSaved.max_eligible_points, 20);
    checks.push(
      'Review after the next phase starts still accepts the original twenty-point maximum rather than the new ten-point maximum',
    );
    const topics = [
      {
        id: 'public',
        title_en: 'Public topic',
        title_ar: 'Public topic',
        description: 'Student description',
        notes: 'PRIVATE SECRET ORGANIZER NOTE',
        links: 'https://example.test',
        status: 'planned',
        visible: true,
      },
      {
        id: 'hidden',
        title_en: 'Hidden topic',
        title_ar: 'Hidden topic',
        description: 'Hidden description',
        notes: 'PRIVATE',
        links: '',
        status: 'planned',
        visible: false,
      },
    ];
    assert.ifError(
      (
        await team.rpc('save_session_content', {
          p_week: 99,
          p_topics: topics,
          p_published: false,
          p_version: 0,
        })
      ).error,
    );
    assert.equal(
      (await a.api.from('session_public_content').select('*').eq('week_number', 99)).data.length,
      0,
    );
    assert.ifError(
      (
        await team.rpc('save_session_content', {
          p_week: 99,
          p_topics: topics,
          p_published: true,
          p_version: 1,
        })
      ).error,
    );
    const projection = (
      await a.api.from('session_public_content').select('*').eq('week_number', 99)
    ).data;
    assert.equal(projection[0].topics.length, 1);
    assert.equal('notes' in projection[0].topics[0], false);
    assert.ok(!JSON.stringify(projection).includes('SECRET'));
    assert.ok(!JSON.stringify(projection).includes('Hidden'));
    assert.equal((await a.api.from('week1_session').select('*')).data.length, 0);
    assert.ok(
      (
        await a.api.rpc('save_session_content', {
          p_week: 99,
          p_topics: [],
          p_published: false,
          p_version: 2,
        })
      ).error,
    );
    assert.ifError(
      (
        await team.rpc('save_session_content', {
          p_week: 99,
          p_topics: [{ ...topics[1], visible: true }],
          p_published: false,
          p_version: 2,
        })
      ).error,
    );
    assert.equal(
      (await a.api.from('session_public_content').select('*').eq('week_number', 99)).data.length,
      0,
    );
    checks.push(
      'Dynamic session creation, save without publication, explicit visibility, unpublished topics and private notes excluded at API/RLS boundaries',
    );
    writeFileSync(
      new URL('../artifacts/week1-isolated/assignment-integration-results.json', import.meta.url),
      JSON.stringify({ passed: true, independentConnections: pids.length, checks }, null, 2),
    );
    console.log(checks.join('\n'));
  },
);
