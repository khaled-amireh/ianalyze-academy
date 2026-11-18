import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { week1TestTarget } from '../scripts/week1-test-target.mjs';

test(
  'eligible zero-point students, registration, source-week awards and public privacy on isolated Supabase',
  { skip: process.env.RUN_LOCAL_SUPABASE_TESTS !== '1' },
  async (t) => {
    const url = week1TestTarget(process.env.LOCAL_SUPABASE_URL),
      db = postgres(week1TestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database'), { max: 1 }),
      options = { auth: { persistSession: false, autoRefreshToken: false } },
      admin = createClient(url, process.env.LOCAL_SUPABASE_SECRET_KEY, options),
      anonymous = createClient(url, process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY, options),
      users = [],
      assignments = [];
    const baseline = (await anonymous.rpc('academy_leaderboard')).data;
    t.after(async () => {
      for (const id of assignments) {
        await db`delete from public.point_awards where source_key=${'assignment:' + id}`;
        await db`delete from public.grades where submission_id in(select id from public.submissions where activity_id=${id})`;
        await db`delete from public.submissions where activity_id=${id}`;
        await db`update public.activities set status='draft' where id=${id}`;
        await db`delete from public.activities where id=${id}`;
      }
      for (const user of users) {
        await user.api.auth.signOut();
        assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);
      }
      assert.deepEqual((await anonymous.rpc('academy_leaderboard')).data, baseline);
      await db.end();
    });
    async function account(registered = true) {
      const credentials = {
        email: `full-qa-${randomUUID()}@example.test`,
        password: `Local-${randomUUID()}-Aa9!`,
      };
      const made = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
      assert.ifError(made.error);
      const api = createClient(url, process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY, options);
      assert.ifError((await api.auth.signInWithPassword(credentials)).error);
      const user = { id: made.data.user.id, api };
      users.push(user);
      if (registered) await register(user);
      return user;
    }
    async function register(user) {
      assert.ifError(
        (
          await user.api
            .from('profiles')
            .update({
              full_name: 'PRIVATE QA NAME',
              whatsapp: '+962790000001',
              university: 'Local QA University',
              major: 'Data Science',
              academic_year: 2,
              python_experience: 'none',
            })
            .eq('id', user.id)
        ).error,
      );
      assert.ifError(
        (await user.api.rpc('complete_registration', { p_consent_version: 'registration-v1' }))
          .error,
      );
    }
    const zero = await account(),
      earned = await account(),
      fresh = await account(false),
      unconfirmed = await account(),
      team = await account();
    await db`update app_private.user_roles set role='team',grant_reason='Isolated full QA' where user_id=${team.id}`;
    await db`update auth.users set email_confirmed_at=null where id=${unconfirmed.id}`;
    const alias = (id) => 'Learner ' + createHash('md5').update(id).digest('hex').slice(0, 10);
    for (const weekly of [false, true]) {
      const rows = (await anonymous.rpc('academy_leaderboard', { p_weekly: weekly })).data;
      assert.equal(rows.length, baseline.length + 2);
      for (const student of [zero, earned])
        assert.equal(rows.find((x) => x.alias === alias(student.id)).points, 0);
      for (const user of [fresh, team, unconfirmed])
        assert.ok(!rows.some((x) => x.alias === alias(user.id)));
    }
    await register(fresh);
    assert.ifError(
      (
        await earned.api
          .from('profiles')
          .update({ leaderboard_name: 'Explicit QA Alias' })
          .eq('id', earned.id)
      ).error,
    );
    const now = Date.now(),
      date = (n) => new Date(now + n).toISOString();
    async function assignment(publish, points) {
      const data = {
        title_en: 'QA assignment',
        title_ar: 'اختبار',
        instructions_en: 'QA',
        instructions_ar: 'اختبار',
        reference_links: '',
        submission_type: 'link',
        publish_at: publish,
        due_at: date(3600000),
        phases: [{ name: 'QA phase', start: publish, end: date(3600000), points: 12.5 }],
        status: 'published',
        accepting: true,
        archived: false,
        sort_order: 0,
      };
      const saved = await team.api.rpc('save_assignment', {
        p_data: data,
        p_version: 0,
        p_request: randomUUID(),
      });
      assert.ifError(saved.error);
      assignments.push(saved.data);
      const submitted = await earned.api.rpc('submit_assignment', {
        p_activity: saved.data,
        p_request: randomUUID(),
        p_link: 'https://example.test/qa',
      });
      assert.ifError(submitted.error);
      if (points !== null)
        assert.ifError(
          (
            await team.api.rpc('review_assignment', {
              p_submission: submitted.data,
              p_points: points,
              p_feedback: 'PRIVATE QA FEEDBACK',
              p_revision: 0,
            })
          ).error,
        );
      return submitted.data;
    }
    await assignment(date(-8 * 86400000), 7.25);
    const current = await assignment(date(-3600000), 3);
    await assignment(date(-3600000), null);
    for (const weekly of [false, true]) {
      const rows = (await anonymous.rpc('academy_leaderboard', { p_weekly: weekly })).data;
      assert.equal(rows.length, baseline.length + 3);
      const packet = (await anonymous.rpc('academy_rankings', { p_view: 'current' })).data;
      const awards = (await earned.api.from('point_awards').select('*')).data;
      const currentPoints =
        packet.period.state === 'current'
          ? awards
              .filter((x) => x.scoring_week === packet.period.week)
              .reduce((sum, x) => sum + Number(x.points), 0)
          : 0;
      assert.equal(
        rows.find((x) => x.alias === 'Explicit QA Alias').points,
        weekly ? currentPoints : 10.25,
      );
      const zeros = rows.filter((x) => [zero, fresh].some((u) => x.alias === alias(u.id)));
      assert.deepEqual(
        zeros.map((x) => x.alias),
        [zero, fresh].sort((a, b) => a.id.localeCompare(b.id)).map((x) => alias(x.id)),
      );
      assert.ok(zeros.every((x) => x.points === 0));
      for (const row of rows)
        assert.deepEqual(Object.keys(row).sort(), ['activities', 'alias', 'points', 'rank']);
      const text = JSON.stringify(rows);
      for (const privateValue of ['PRIVATE QA', '@example.test', '+962', earned.id, zero.id])
        assert.ok(!text.includes(privateValue));
    }
    assert.ifError(
      (
        await team.api.rpc('review_assignment', {
          p_submission: current,
          p_points: 0,
          p_feedback: 'Correction',
          p_revision: 1,
        })
      ).error,
    );
    assert.equal(
      (await anonymous.rpc('academy_leaderboard', { p_weekly: true })).data.find(
        (x) => x.alias === 'Explicit QA Alias',
      ).points,
      0,
    );
    assert.equal(
      Number(
        (await db`select count(*) as n from public.point_awards where submission_id=${current}`)[0]
          .n,
      ),
      1,
    );
    assert.ok((await anonymous.from('profiles').select('*')).error);
    assert.ok((await anonymous.from('point_awards').select('*')).error);
    console.log(
      'Zero-point inclusion: 2 original + 3 disposable eligible students; Team/unregistered/unconfirmed excluded; private columns denied; correction retains one award.',
    );
  },
);
