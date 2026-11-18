import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase, asUser } from '../scripts/database-fixture.mjs';

test('Friday calendar, permanent cutoff history, late adjustments and private clock in PostgreSQL', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const clock = async (value) =>
    db.exec(
      `create or replace function app_private.scoring_now() returns timestamptz language sql volatile set search_path='' as $$ select '${value}'::timestamptz $$`,
    );
  const q = (who, sql, params = []) => asUser(db, who, () => db.query(sql, params));
  const packet = async (view, week = null) =>
    (await db.query('select public.academy_rankings($1,$2) r', [view, week])).rows[0].r;
  await clock('2026-11-27T00:00+03');
  for (const view of ['all', 'current', 'archive'])
    assert.deepEqual(
      (await packet(view, view === 'archive' ? 1 : null)).rows,
      [],
      'Empty weeks do not fabricate participants',
    );
  for (const [at, expected] of [
    ['2026-11-18T23:59:59.999999+03', null],
    ['2026-11-19T00:00+03', 1],
    ['2026-11-19T23:59:59.999999+03', 1],
    ['2026-11-20T00:00+03', 2],
    ['2026-11-26T23:59:59.999999+03', 2],
    ['2026-11-27T00:00+03', 3],
    ['2026-12-31T23:59:59.999999+03', 7],
    ['2027-01-01T00:00+03', 8],
  ])
    assert.equal(
      (await db.query('select app_private.scoring_week($1) w', [at])).rows[0].w,
      expected,
    );
  await clock('2026-11-19T12:00+03');
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()],
    names = ['Sarah', 'Khaled', 'Ahmad', 'Organizer'];
  for (let i = 0; i < ids.length; i++) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      ids[i],
      `fixture-${i}@example.test`,
    ]);
    if (i === 3)
      await db.query(
        "update app_private.user_roles set role='team',grant_reason='Embedded scoring test' where user_id=$1",
        [ids[i]],
      );
    await q(
      ids[i],
      "update public.profiles set full_name='PRIVATE NAME',whatsapp='+962790000001',university='Other',major='AI',academic_year=2,python_experience='none',leaderboard_name=$2 where id=$1",
      [ids[i], names[i]],
    );
    await q(ids[i], "select public.complete_registration('registration-v1')");
    if (i < 2)
      assert.equal(
        (await packet('current')).rows.length,
        i + 1,
        'Fewer than three eligible students remain a partial podium',
      );
  }
  const [sarah, khaled, ahmad, team] = ids;
  async function assignment(start) {
    const end = '2026-12-01T00:00+03';
    return (
      await q(team, 'select public.save_assignment($1,0,null) id', [
        {
          title_en: 'Scoring fixture',
          title_ar: 'Scoring fixture',
          instructions_en: 'Instructions',
          instructions_ar: 'Instructions',
          reference_links: '',
          submission_type: 'link',
          publish_at: start,
          due_at: end,
          phases: [{ name: 'Phase', start, end, points: 50 }],
          status: 'published',
          accepting: true,
          archived: false,
          sort_order: 0,
        },
      ])
    ).rows[0].id;
  }
  async function submission(student, activity) {
    const id = randomUUID();
    await db.query(
      "insert into public.submissions(id,student_id,activity_id,assignment_submission,status,link_url,phase_snapshot,max_eligible_points,submitted_at) values($1,$2,$3,true,'submitted','https://example.test/work',$4,50,'2026-11-19T12:00+03')",
      [id, student, activity, { name: 'Original phase', points: 50 }],
    );
    return id;
  }
  const review = async (id, points, revision = 0) =>
    q(team, 'select public.review_assignment($1,$2,$3,$4)', [
      id,
      points,
      'PRIVATE FEEDBACK',
      revision,
    ]);
  const w1 = await assignment('2026-11-19T00:00+03'),
    first = [];
  for (const [i, points] of [40, 30, 10].entries()) {
    const id = await submission(ids[i], w1);
    first.push(id);
    await review(id, points);
  }
  await clock('2026-11-20T00:00+03');
  assert.ok((await packet('current')).rows.every((r) => r.points === 0));
  assert.deepEqual(
    (await packet('archive', 1)).rows.map((r) => [r.alias, r.points, r.original_points]),
    [
      ['Sarah', 40, 40],
      ['Khaled', 30, 30],
      ['Ahmad', 10, 10],
    ],
  );
  const w2 = await assignment('2026-11-20T00:00+03');
  for (const [student, points] of [
    [ahmad, 50],
    [khaled, 20],
    [sarah, 0],
  ])
    await review(await submission(student, w2), points);
  assert.deepEqual(
    (await packet('all')).rows.map((r) => [r.alias, r.points]),
    [
      ['Ahmad', 60],
      ['Khaled', 50],
      ['Sarah', 40],
    ],
  );
  assert.deepEqual(
    (await packet('current')).rows.map((r) => r.points),
    [50, 20, 0],
  );
  await clock('2026-11-27T00:00+03');
  assert.ok((await packet('current')).rows.every((r) => r.points === 0));
  assert.equal((await packet('archive', 2)).rows[0].points, 50);
  assert.equal((await packet('archive', 1)).revision, 1);
  const late = await assignment('2026-11-19T15:00+03');
  await review(await submission(sarah, late), 5);
  await review(first[0], 38, 1);
  const archive = await packet('archive', 1);
  assert.equal(archive.revision, 3);
  assert.equal(archive.rows[0].original_points, 40);
  assert.equal(archive.rows[0].points, 43);
  assert.deepEqual(
    archive.adjustments.map((r) => r.delta),
    [5, -2],
  );
  await assert.rejects(review(first[0], 38, 1), (e) => e.code === '40001');
  assert.equal((await packet('archive', 1)).revision, 3);
  assert.equal(
    Number(
      (
        await db.query('select count(*) n from public.point_awards where submission_id=$1', [
          first[0],
        ])
      ).rows[0].n,
    ),
    1,
  );
  await assert.rejects(
    q(sarah, "select app_private.rankings_at('current',null,now())"),
    (e) => e.code === '42501',
  );
  await assert.rejects(
    q(sarah, 'select * from app_private.scoring_award_events'),
    (e) => e.code === '42501',
  );
  await assert.rejects(q(sarah, 'select app_private.scoring_now()'), (e) => e.code === '42501');
  const text = JSON.stringify(archive);
  for (const secret of [...ids, 'PRIVATE NAME', 'PRIVATE FEEDBACK', '@example.test', '+962'])
    assert.ok(!text.includes(secret));
  assert.equal(
    (await db.query('select app_private.uploads_enabled() enabled')).rows[0].enabled,
    false,
  );
  await clock('2026-11-18T23:59:59+03');
  assert.ok((await packet('current')).rows.every((r) => r.points === 0));
  assert.equal((await packet('current')).period.state, 'upcoming');
  await assert.rejects(packet('archive', 1), (e) => e.code === '22023');
  await clock('2026-11-27T12:00+03');
  await db.query(
    "update app_private.user_roles set role='team',grant_reason='Promotion after close' where user_id=$1",
    [sarah],
  );
  const redacted = await packet('archive', 1);
  assert.ok(!redacted.rows.some((row) => row.alias === 'Sarah'));
  assert.equal(
    redacted.rows.find((row) => row.alias === 'Khaled').original_rank,
    2,
    'Historical original rank must not be renumbered by a later role change',
  );
  assert.equal(redacted.privacy_updates, 1);
  await db.exec(
    "create or replace function app_private.leaderboard_enabled() returns boolean language sql stable set search_path='' as $$ select false $$",
  );
  const closed = await packet('archive', 1);
  assert.deepEqual(closed.rows, []);
  assert.deepEqual(closed.adjustments, []);
  assert.equal(closed.privacy_updates, 0);
  assert.equal(closed.revision, 1);
});
