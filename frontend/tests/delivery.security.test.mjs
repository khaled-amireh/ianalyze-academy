import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, asUser } from '../scripts/database-fixture.mjs';
const a = '00000000-0000-4000-8000-000000000011',
  team = '00000000-0000-4000-8000-000000000012',
  week = '10000000-0000-4000-8000-000000000011',
  activity = '20000000-0000-4000-8000-000000000011';
test('functional delivery database boundaries and atomic rubric configuration', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'local-a@example.test',now()),($2,'local-team@example.test',now())",
    [a, team],
  );
  await db.query(
    "update app_private.user_roles set role='team',grant_reason='LOCAL TEST ONLY' where user_id=$1",
    [team],
  );
  await db.query(
    "insert into public.academy_weeks(id,week_number,kind,title_ar,title_en) values($1,1,'teaching','اختبار','LOCAL TEST ONLY')",
    [week],
  );
  await db.query(
    "insert into public.activities(id,week_id,title_ar,title_en,max_score) values($1,$2,'اختبار','LOCAL TEST ONLY',10)",
    [activity, week],
  );
  const criteria = [{ label_ar: 'اختبار', label_en: 'LOCAL TEST ONLY', max_points: 10 }];
  const call = (user, sql, params = []) => asUser(db, user, () => db.query(sql, params));
  await t.test(
    'gates default closed and public output contains no private profile data',
    async () => {
      const result = await asUser(
        db,
        null,
        () =>
          db.query(
            'select public.academy_capabilities() as caps,public.academy_leaderboard() as ranks',
          ),
        'anon',
      );
      assert.deepEqual(result.rows[0], {
        caps: { submissions: false, leaderboard: false },
        ranks: [],
      });
      for (const fn of [
        'reserve_notebook(uuid,uuid,uuid,text,integer)',
        'finalize_notebook(uuid,text)',
        'claim_submission_request(uuid)',
      ]) {
        const grant = await db.query(
          "select has_function_privilege('authenticated',$1,'EXECUTE') as allowed",
          [`public.${fn}`],
        );
        assert.equal(grant.rows[0].allowed, false);
      }
    },
  );
  await t.test('Student cannot create or edit rubrics', async () => {
    await assert.rejects(
      call(a, 'select public.create_draft_rubric($1,$2)', [activity, criteria]),
      (e) => e.code === '42501',
    );
  });
  let rubric;
  await t.test('invalid criteria roll back the entire new rubric', async () => {
    await assert.rejects(
      call(team, 'select public.create_draft_rubric($1,$2)', [
        activity,
        [{ ...criteria[0], max_points: 0.001 }],
      ]),
    );
    assert.equal((await db.query('select count(*)::int as n from public.rubrics')).rows[0].n, 0);
    rubric = (
      await call(team, 'select public.create_draft_rubric($1,$2) as id', [activity, criteria])
    ).rows[0].id;
    await assert.rejects(
      call(team, 'select public.save_draft_rubric($1,$2)', [
        rubric,
        [{ ...criteria[0], max_points: -1 }],
      ]),
    );
    assert.equal(
      Number(
        (
          await db.query('select max_points from public.rubric_criteria where rubric_id=$1', [
            rubric,
          ])
        ).rows[0].max_points,
      ),
      10,
    );
  });
  await t.test('Team can edit a draft atomically; publication locks further edits', async () => {
    await call(team, 'select public.save_draft_rubric($1,$2)', [
      rubric,
      [
        { label_ar: 'أول', label_en: 'First', max_points: 4 },
        { label_ar: 'ثان', label_en: 'Second', max_points: 6 },
      ],
    ]);
    await call(team, "update public.rubrics set status='published' where id=$1", [rubric]);
    await assert.rejects(call(team, 'select public.save_draft_rubric($1,$2)', [rubric, criteria]));
    assert.equal(
      (
        await db.query('select count(*)::int as n from public.rubric_criteria where rubric_id=$1', [
          rubric,
        ])
      ).rows[0].n,
      2,
    );
  });
});
