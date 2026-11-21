import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { asUser, createDatabase, migrations } from '../scripts/database-fixture.mjs';

test('pending consent migration refuses an unexpected zero-argument RPC baseline without partial changes', async (t) => {
  const sql = migrations();
  const db = await createDatabase(sql.slice(0, -3));
  t.after(() => db.close());
  await db.exec(
    "create function app_private.academy_leaderboard() returns jsonb language sql set search_path='' as $$select '[]'::jsonb$$",
  );
  await assert.rejects(db.exec(sql.at(-3)), (error) => error.code === '55000');
  await db.exec('rollback');
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='public_full_name_consent'",
      )
    ).rows[0].n,
    0,
  );
});

test('production boolean RPC preserves both scoring views, consent privacy and manual-award security', async (t) => {
  const sql = migrations();
  const fixture = readFileSync(
    new URL('./fixtures/production-leaderboard-scoring.sql', import.meta.url),
    'utf8',
  );
  const db = await createDatabase([...sql.slice(0, -3), fixture]);
  t.after(() => db.close());
  const call = (uid, query, params = [], role = 'authenticated', claims = { aal: 'aal1' }) =>
    asUser(db, uid, () => db.query(query, params), role, claims);
  const adminCall = (uid, query, params = []) =>
    call(uid, query, params, 'authenticated', { aal: 'aal2' });
  const rank = async (weekly = false) =>
    (await call(null, 'select public.academy_leaderboard($1) as rows', [weekly], 'anon')).rows[0]
      .rows;
  const clock = async (time) => {
    assert.match(time, /^2026-11-\d\d \d\d:\d\d Asia\/Amman$/);
    await db.exec(
      `create or replace function app_private.scoring_now() returns timestamptz language sql set search_path='' as $$select '${time}'::timestamptz$$`,
    );
  };
  await db.exec(`
    insert into auth.users(id,email,email_confirmed_at) values
      ('${student}','synthetic-a@example.test',now()),
      ('${gateStudent}','synthetic-b@example.test',now()),
      ('${team}','synthetic-team@example.test',now()),
      ('${admin}','synthetic-admin@example.test',now());
    update app_private.user_roles set role='team' where user_id in ('${team}','${admin}');
    update public.profiles set full_name='Synthetic Saved Name', whatsapp='+962790000001',
      major='AI',university='Other University',academic_year=4,python_experience='basic',
      consent_version='registration-v1',consent_at=now(),registered_at=now();
    update public.profiles set leaderboard_name='Learner Stable A' where id='${student}';
    update public.profiles set leaderboard_name='Learner Stable B' where id='${gateStudent}';
    insert into public.point_awards(student_id,source_key,points,period_start,reviewed_by,reviewed_at,scoring_week) values
      ('${student}','synthetic-prior',11,'2026-11-19','${team}','2026-11-19 12:00 Asia/Amman',1),
      ('${student}','synthetic-current-a',7,'2026-11-20','${team}','2026-11-20 12:00 Asia/Amman',2),
      ('${gateStudent}','synthetic-current-b',8,'2026-11-20','${team}','2026-11-20 12:00 Asia/Amman',2);
    insert into app_private.scoring_membership_events(student_id,eligible,effective_at)
      values ('${student}',true,'2026-11-19 00:00 Asia/Amman'),
             ('${gateStudent}',true,'2026-11-19 00:00 Asia/Amman');
    insert into app_private.scoring_award_events(student_id,source_key,scoring_week,delta,points_after,recorded_at,kind,legacy_period_start)
      values ('${student}','synthetic-prior',1,11,11,'2026-11-19 12:00 Asia/Amman','synthetic','2026-11-19');
    create or replace function app_private.leaderboard_enabled() returns boolean language sql immutable set search_path='' as $$select true$$;
  `);
  await clock('2026-11-21 12:00 Asia/Amman');
  const beforeAll = await rank(false);
  const beforeWeekly = await rank(true);
  assert.deepEqual(
    beforeAll.map((row) => [row.points, row.activities]),
    [
      [18, 2],
      [8, 1],
    ],
  );
  assert.deepEqual(
    beforeWeekly.map((row) => [row.points, row.activities]),
    [
      [8, 1],
      [7, 1],
    ],
  );
  const archive = async () =>
    (await db.query("select app_private.academy_rankings('archive',1) as value")).rows[0].value;
  const beforeArchive = await archive();
  const oldPoints = async () =>
    (
      await db.query(
        'select md5(jsonb_agg(to_jsonb(a) order by student_id,source_key)::text) as hash from public.point_awards a',
      )
    ).rows[0].hash;
  const beforePoints = await oldPoints();

  await db.exec(sql.at(-3));
  assert.deepEqual(await rank(false), beforeAll);
  assert.deepEqual(await rank(true), beforeWeekly);
  await db.exec(sql.at(-2));
  await db.exec(sql.at(-1));
  await db.exec(`insert into app_private.application_admins(user_id,reason) values('${admin}','SYNTHETIC TEST ONLY');
    alter table app_private.manual_point_awards alter column created_at set default '2026-11-21 12:00 Asia/Amman'::timestamptz;`);

  await t.test(
    'exact optional boolean signatures, default calls and existing totals survive without overloads',
    async () => {
      const functions = (
        await db.query(`
      select n.nspname,p.pronargs,p.proargnames,p.pronargdefaults,p.prosecdef,p.proconfig
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','app_private') and p.proname='academy_leaderboard' order by n.nspname
    `)
      ).rows;
      assert.equal(functions.length, 2);
      for (const fn of functions) {
        assert.equal(fn.pronargs, 1);
        assert.deepEqual(fn.proargnames, ['p_weekly']);
        assert.equal(fn.pronargdefaults, 1);
        assert.deepEqual(fn.proconfig, ['search_path=""']);
      }
      assert.equal(functions.find((fn) => fn.nspname === 'public').prosecdef, false);
      assert.deepEqual(await rank(false), beforeAll);
      assert.deepEqual(await rank(true), beforeWeekly);
      assert.deepEqual(await rank(null), beforeAll);
      assert.deepEqual(
        (await call(null, 'select public.academy_leaderboard() as rows', [], 'anon')).rows[0].rows,
        beforeAll,
      );
      await assert.rejects(
        call(null, 'select * from app_private.leaderboard_base_rows(false,now())', [], 'anon'),
        (error) => error.code === '42501',
      );
      assert.equal(
        (
          await db.query(
            "select relrowsecurity from pg_class where oid='public.point_awards'::regclass",
          )
        ).rows[0].relrowsecurity,
        true,
      );
    },
  );

  await t.test(
    'consent and withdrawal use the live public RPC in both views and keep fallback aliases',
    async () => {
      await call(student, 'select public.set_public_full_name_consent(true)');
      for (const weekly of [false, true]) {
        const rows = await rank(weekly);
        assert.ok(rows.some((row) => row.alias === 'Synthetic Saved Name'));
        for (const row of rows)
          assert.deepEqual(Object.keys(row).sort(), ['activities', 'alias', 'points', 'rank']);
      }
      await call(student, 'select public.set_public_full_name_consent(false)');
      assert.deepEqual(await rank(false), beforeAll);
      assert.deepEqual(await rank(true), beforeWeekly);
      await call(student, 'select public.set_public_full_name_consent(true)');
      await assert.rejects(
        call(team, 'select public.correct_registered_student_name($1,$2)', [
          student,
          'Untrusted Name',
        ]),
        (error) => error.code === '42501',
      );
      await adminCall(admin, 'select public.correct_registered_student_name($1,$2)', [
        student,
        'Synthetic Corrected Name',
      ]);
      assert.deepEqual(await rank(false), beforeAll);
      assert.deepEqual(await rank(true), beforeWeekly);
    },
  );

  await t.test(
    'only Admin awards; idempotent retries change totals once without increasing activity counts',
    async () => {
      const awardSql = 'select public.admin_award_points($1,$2,$3,$4) as id';
      const args = [student, 5, 'SYNTHETIC CURRENT AWARD', awardKey];
      for (const who of [student, team])
        await assert.rejects(call(who, awardSql, args), (error) => error.code === '42501');
      for (const points of [0, -1])
        await assert.rejects(
          adminCall(admin, awardSql, [student, points, 'SYNTHETIC INVALID', awardKey]),
          (error) => error.code === '22023',
        );
      const first = (await adminCall(admin, awardSql, args)).rows[0].id;
      assert.equal((await adminCall(admin, awardSql, args)).rows[0].id, first);
      await assert.rejects(
        adminCall(admin, awardSql, [student, 6, args[2], awardKey]),
        (error) => error.code === '22023',
      );
      await assert.rejects(
        adminCall(admin, awardSql, [student, 1.5, 'SYNTHETIC FRACTION', awardKey]),
        (error) => error.code === '22P02',
      );
      assert.deepEqual(
        (await rank(false)).map((row) => [row.points, row.activities]),
        [
          [23, 2],
          [8, 1],
        ],
      );
      assert.deepEqual(
        (await rank(true)).map((row) => [row.points, row.activities]),
        [
          [12, 1],
          [8, 1],
        ],
      );
      await assert.rejects(
        call(student, 'select public.admin_award_history(null)'),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        db.query('update app_private.manual_point_awards set points=99 where id=$1', [first]),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        db.query('delete from app_private.manual_point_awards where id=$1', [first]),
        (error) => error.code === '42501',
      );
    },
  );

  await t.test(
    'Amman one-day first week, seven-day rollover and manual-award cutoffs remain exact',
    async () => {
      await db.query(
        `insert into app_private.manual_point_awards(student_id,admin_id,points,reason,idempotency_key,created_at)
      values($1,$2,20,'SYNTHETIC PRIOR AWARD','70000000-0000-4000-8000-000000000199','2026-11-19 23:59 Asia/Amman')`,
        [gateStudent, admin],
      );
      assert.deepEqual(
        (await rank(false)).map((row) => [row.points, row.activities]),
        [
          [28, 1],
          [23, 2],
        ],
      );
      await clock('2026-11-19 23:59 Asia/Amman');
      assert.deepEqual(
        (await rank(true)).map((row) => [row.points, row.activities]),
        [
          [20, 0],
          [11, 1],
        ],
      );
      await clock('2026-11-20 00:00 Asia/Amman');
      assert.deepEqual(
        (await rank(true)).map((row) => [row.points, row.activities]),
        [
          [12, 1],
          [8, 1],
        ],
      );
      await clock('2026-11-23 00:00 Asia/Amman');
      assert.deepEqual(
        (await rank(true)).map((row) => [row.points, row.activities]),
        [
          [12, 1],
          [8, 1],
        ],
      );
      await clock('2026-11-27 00:00 Asia/Amman');
      assert.deepEqual(
        (await rank(true)).map((row) => [row.points, row.activities]),
        [
          [0, 0],
          [0, 0],
        ],
      );
      assert.deepEqual(
        (await rank(false)).map((row) => [row.points, row.activities]),
        [
          [28, 1],
          [23, 2],
        ],
      );
      await clock('2026-11-21 12:00 Asia/Amman');
      assert.equal(await oldPoints(), beforePoints);
      assert.deepEqual(await archive(), beforeArchive);
    },
  );

  await t.test(
    'banned and deleted accounts cannot reappear through manual awards; gates still close both views',
    async () => {
      await db.query(
        "update auth.users set banned_until='2026-12-01 00:00 Asia/Amman' where id=$1",
        [student],
      );
      for (const weekly of [false, true]) assert.equal((await rank(weekly)).length, 1);
      await db.query('update auth.users set banned_until=null,deleted_at=now() where id=$1', [
        student,
      ]);
      for (const weekly of [false, true]) assert.equal((await rank(weekly)).length, 1);
      await db.query('update auth.users set deleted_at=null where id=$1', [student]);
      await call(student, 'select public.set_public_full_name_consent(true)');
      await db.exec(
        "create or replace function app_private.leaderboard_enabled() returns boolean language sql immutable set search_path='' as $$select false$$",
      );
      await assert.rejects(
        call(student, 'select public.set_public_full_name_consent(true)'),
        (error) => error.code === '42501',
      );
      await call(student, 'select public.set_public_full_name_consent(false)');
      assert.deepEqual(await rank(false), []);
      assert.deepEqual(await rank(true), []);
      assert.equal(await oldPoints(), beforePoints);
    },
  );
});

const student = '00000000-0000-4000-8000-000000000101';
const team = '00000000-0000-4000-8000-000000000102';
const admin = '00000000-0000-4000-8000-000000000103';
const gateStudent = '00000000-0000-4000-8000-000000000104';
const week = '10000000-0000-4000-8000-000000000101';
const activity = '20000000-0000-4000-8000-000000000101';
const rubric = '30000000-0000-4000-8000-000000000101';
const criterion = '40000000-0000-4000-8000-000000000101';
const submission = '50000000-0000-4000-8000-000000000101';
const grade = '60000000-0000-4000-8000-000000000101';
const awardKey = '70000000-0000-4000-8000-000000000101';

test('main-schema leaderboard consent and Admin awards enforce privacy and audit boundaries', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const call = (uid, sql, params = [], role = 'authenticated', claims = { aal: 'aal1' }) =>
    asUser(db, uid, () => db.query(sql, params), role, claims);
  const adminCall = (uid, sql, params = []) =>
    call(uid, sql, params, 'authenticated', { aal: 'aal2' });

  await db.exec(`
    insert into auth.users(id,email,email_confirmed_at) values
      ('${student}','student@example.test',now()),
      ('${team}','team@example.test',now()),
      ('${admin}','admin@example.test',now()),
      ('${gateStudent}','gate-student@example.test',now());
    update app_private.user_roles set role='team',grant_reason='LOCAL TEST ONLY' where user_id='${team}';
    update public.profiles set full_name='Student Before',whatsapp='+962790000001',major='AI',university='Other University',academic_year=4,
      python_experience='basic',consent_version='registration-v1',consent_at=now(),registered_at=now()
      where id='${student}';
    update public.profiles set full_name='Team Member',whatsapp='+962790000002',major='AI',university='Other University',academic_year=4,
      python_experience='basic',consent_version='registration-v1',consent_at=now(),registered_at=now()
      where id='${team}';
    update public.profiles set full_name='Admin Member',whatsapp='+962790000003',major='AI',university='Other University',academic_year=4,
      python_experience='basic',consent_version='registration-v1',consent_at=now(),registered_at=now()
      where id='${admin}';
    update public.profiles set full_name='Gate Student',whatsapp='+962790000004',major='AI',university='Other University',academic_year=4,
      python_experience='basic',consent_version='registration-v1',consent_at=now(),registered_at=now()
      where id='${gateStudent}';
    insert into app_private.application_admins(user_id,reason) values('${admin}','LOCAL TEST ONLY');
    insert into public.academy_weeks(id,week_number,kind,title_ar,title_en,status)
      values('${week}',1,'teaching','اختبار','Test week','published');
    insert into public.activities(id,week_id,title_ar,title_en,max_score,status)
      values('${activity}','${week}','اختبار','Test activity',10,'published');
    insert into public.rubrics(id,activity_id,version) values('${rubric}','${activity}',1);
    insert into public.rubric_criteria(id,rubric_id,label_ar,label_en,max_points,sort_order)
      values('${criterion}','${rubric}','معيار','Criterion',10,0);
    update public.rubrics set status='published' where id='${rubric}';
    insert into public.submissions(id,student_id,activity_id,rubric_id,status,submitted_at)
      values('${submission}','${student}','${activity}','${rubric}','submitted',now());
    insert into public.grades(id,submission_id,rubric_id,reviewer_id,revision,feedback,status,published_at)
      values('${grade}','${submission}','${rubric}','${team}',1,'LOCAL TEST ONLY','published',now());
    insert into public.grade_criterion_scores(grade_id,rubric_id,criterion_id,points)
      values('${grade}','${rubric}','${criterion}',8);
    create or replace function app_private.leaderboard_enabled() returns boolean
      language sql immutable set search_path='' as $$select true$$;
  `);

  await t.test('leaderboard starts pseudonymous and exposes no identity fields', async () => {
    const result = await call(null, 'select public.academy_leaderboard() as rows', [], 'anon');
    assert.equal(
      result.rows[0].rows[0].alias,
      `Learner ${createHash('md5').update(student).digest('hex').slice(0, 10)}`,
    );
    assert.equal(result.rows[0].rows[0].points, 8);
    assert.equal(result.rows[0].rows[0].activities, 1);
    assert.deepEqual(Object.keys(result.rows[0].rows[0]).sort(), [
      'activities',
      'alias',
      'points',
      'rank',
    ]);
  });

  await t.test('consent and public ranking respect the server-side leaderboard gate', async () => {
    await call(gateStudent, 'select public.set_public_full_name_consent(true)');
    await db.exec(
      "create or replace function app_private.leaderboard_enabled() returns boolean language sql immutable set search_path='' as $$select false$$",
    );
    await assert.rejects(
      call(gateStudent, 'select public.set_public_full_name_consent(true)'),
      (error) => error.code === '42501',
    );
    await call(gateStudent, 'select public.set_public_full_name_consent(false)');
    const closed = await call(null, 'select public.academy_leaderboard() as rows', [], 'anon');
    assert.deepEqual(closed.rows[0].rows, []);
    await db.exec(
      "create or replace function app_private.leaderboard_enabled() returns boolean language sql immutable set search_path='' as $$select true$$",
    );
  });

  await t.test(
    'only the registered verified Student can opt in or withdraw; name writes stay blocked',
    async () => {
      await assert.rejects(
        call(null, 'select public.set_public_full_name_consent(true)', [], 'anon'),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        call(team, 'select public.set_public_full_name_consent(true)'),
        (error) => error.code === '42501',
      );
      await call(student, 'select public.set_public_full_name_consent(true)');
      let row = (
        await db.query(
          'select public_full_name_consent,public_full_name_consent_at from public.profiles where id=$1',
          [student],
        )
      ).rows[0];
      assert.equal(row.public_full_name_consent, true);
      assert.ok(row.public_full_name_consent_at);
      let ranks = await db.query('select public.academy_leaderboard() as rows');
      assert.equal(ranks.rows[0].rows[0].alias, 'Student Before');
      await assert.rejects(
        call(student, "update public.profiles set full_name='Attacker Name' where id=$1", [
          student,
        ]),
        (error) => error.code === '42501',
      );
      await call(student, 'select public.set_public_full_name_consent(false)');
      row = (
        await db.query(
          'select public_full_name_consent,public_full_name_consent_at from public.profiles where id=$1',
          [student],
        )
      ).rows[0];
      assert.equal(row.public_full_name_consent, false);
      assert.equal(row.public_full_name_consent_at, null);
      ranks = await db.query('select public.academy_leaderboard() as rows');
      assert.match(ranks.rows[0].rows[0].alias, /^Learner /);
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from app_private.leaderboard_name_consent_events where subject_id=$1 and event in ('consented','withdrawn')",
            [student],
          )
        ).rows[0].n,
        2,
      );
      await assert.rejects(
        db.query(
          "update app_private.leaderboard_name_consent_events set event='consented' where subject_id=$1",
          [student],
        ),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        db.query('delete from app_private.leaderboard_name_consent_events where subject_id=$1', [
          student,
        ]),
        (error) => error.code === '42501',
      );
    },
  );

  await t.test(
    'sensitive Admin RPCs require AAL2 and reject missing, invalid, unregistered or unauthorized sessions',
    async () => {
      const awardSql = 'select public.admin_award_points($1,$2,$3,$4)';
      const awardArgs = [student, 4, 'AAL2 boundary test', awardKey];
      assert.equal(
        (await call(admin, 'select public.current_academy_is_admin() as allowed')).rows[0].allowed,
        true,
      );
      for (const claims of [{ aal: 'aal1' }, {}, { aal: 'aal3' }, { aal: ['aal2'] }, null]) {
        await assert.rejects(
          call(admin, awardSql, awardArgs, 'authenticated', claims),
          (error) => error.code === '42501',
        );
        await assert.rejects(
          call(admin, 'select public.admin_award_students()', [], 'authenticated', claims),
          (error) => error.code === '42501',
        );
        await assert.rejects(
          call(admin, 'select public.admin_award_history(null)', [], 'authenticated', claims),
          (error) => error.code === '42501',
        );
        await assert.rejects(
          call(
            admin,
            "select public.correct_registered_student_name($1,'Denied')",
            [student],
            'authenticated',
            claims,
          ),
          (error) => error.code === '42501',
        );
      }
      await assert.rejects(
        call(student, awardSql, awardArgs, 'authenticated', { aal: 'aal2' }),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        call(null, awardSql, awardArgs, 'anon', { aal: 'aal2' }),
        (error) => error.code === '42501',
      );
      await db.query('update public.profiles set registered_at=null where id=$1', [admin]);
      await assert.rejects(
        adminCall(admin, awardSql, awardArgs),
        (error) => error.code === '42501',
      );
      await db.query('update public.profiles set registered_at=now() where id=$1', [admin]);
      assert.equal(
        (await adminCall(admin, 'select public.current_academy_is_admin() as allowed')).rows[0]
          .allowed,
        true,
      );
      assert.equal(
        (
          await db.query(
            "select has_function_privilege('anon','public.admin_award_points(uuid,integer,text,uuid)','EXECUTE') as allowed",
          )
        ).rows[0].allowed,
        false,
      );
    },
  );

  await t.test(
    'Team and Student cannot award; Admin correction withdraws name consent',
    async () => {
      assert.equal(
        (await call(admin, 'select public.current_academy_role() as role')).rows[0].role,
        'team',
      );
      assert.equal(
        (await adminCall(admin, 'select public.current_academy_is_admin() as allowed')).rows[0]
          .allowed,
        true,
      );
      for (const table of ['application_admins', 'application_admin_events']) {
        await assert.rejects(
          adminCall(admin, `select * from app_private.${table}`),
          (error) => error.code === '42501',
        );
      }
      await assert.rejects(
        db.query("update app_private.application_admins set reason='tamper' where user_id=$1", [
          admin,
        ]),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        db.query(
          "update app_private.application_admin_events set event='revoked' where subject_id=$1",
          [admin],
        ),
        (error) => error.code === '42501',
      );
      assert.equal(
        (
          await db.query(
            "select has_column_privilege('authenticated','public.profiles','public_full_name_consent','UPDATE') as allowed",
          )
        ).rows[0].allowed,
        false,
      );
      const args = [student, 10, 'Approved local test award', awardKey];
      await assert.rejects(
        call(student, 'select public.admin_award_students()'),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        call(student, 'select public.admin_award_points($1,$2,$3,$4)', args),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        call(team, 'select public.admin_award_points($1,$2,$3,$4)', args),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        adminCall(admin, 'select public.admin_award_points($1,$2,$3,$4)', [
          student,
          0,
          'Invalid',
          awardKey,
        ]),
        (error) => error.code === '22023',
      );
      await call(student, 'select public.set_public_full_name_consent(true)');
      await assert.rejects(
        call(team, "select public.correct_registered_student_name($1,'Corrected Name')", [student]),
        (error) => error.code === '42501',
      );
      await adminCall(admin, "select public.correct_registered_student_name($1,'Corrected Name')", [
        student,
      ]);
      const profile = (
        await db.query(
          'select full_name,public_full_name_consent,public_full_name_consent_at from public.profiles where id=$1',
          [student],
        )
      ).rows[0];
      assert.deepEqual(profile, {
        full_name: 'Corrected Name',
        public_full_name_consent: false,
        public_full_name_consent_at: null,
      });
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from app_private.leaderboard_name_consent_events where event='trusted_name_corrected'",
          )
        ).rows[0].n,
        1,
      );
      assert.match(
        (await db.query('select public.academy_leaderboard() as rows')).rows[0].rows[0].alias,
        /^Learner /,
      );
    },
  );

  await t.test(
    'Admin awards are idempotent, append-only, and included in leaderboard totals',
    async () => {
      const args = [student, 10, 'Approved local test award', awardKey];
      const first = await adminCall(
        admin,
        'select public.admin_award_points($1,$2,$3,$4) as id',
        args,
      );
      const second = await adminCall(
        admin,
        'select public.admin_award_points($1,$2,$3,$4) as id',
        args,
      );
      assert.equal(second.rows[0].id, first.rows[0].id);
      await assert.rejects(
        adminCall(admin, 'select public.admin_award_points($1,$2,$3,$4)', [
          student,
          11,
          'Conflicting payload',
          awardKey,
        ]),
        (error) => error.code === '22023',
      );
      const result = await db.query('select public.academy_leaderboard() as rows');
      assert.equal(result.rows[0].rows[0].points, 18);
      assert.equal(result.rows[0].rows[0].activities, 1);
      const history = await adminCall(admin, 'select public.admin_award_history($1) as rows', [
        student,
      ]);
      assert.equal(history.rows[0].rows.length, 1);
      assert.equal(history.rows[0].rows[0].points, 10);
      await assert.rejects(
        call(team, 'select public.admin_award_history($1)', [student]),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        db.query('update app_private.manual_point_awards set reason=$1 where id=$2', [
          'tamper',
          first.rows[0].id,
        ]),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        db.query('delete from app_private.manual_point_awards where id=$1', [first.rows[0].id]),
        (error) => error.code === '42501',
      );
      const grant = await db.query(
        "select has_table_privilege('authenticated','app_private.manual_point_awards','SELECT,INSERT,UPDATE,DELETE') as allowed",
      );
      assert.equal(grant.rows[0].allowed, false);
    },
  );
});

test('initial Admin promotion is one-time, owner-approved, registered, verified-TOTP and AAL2 bound', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const target = '00000000-0000-4000-8000-000000000301';
  const approver = '00000000-0000-4000-8000-000000000302';
  const call = (uid, claims, role = 'authenticated') =>
    asUser(db, uid, () => db.query('select public.promote_initial_academy_admin()'), role, claims);
  const pendingFor = (uid, claims, role = 'authenticated') =>
    asUser(
      db,
      uid,
      () => db.query('select public.current_user_has_initial_admin_promotion() as pending'),
      role,
      claims,
    );
  await db.exec(`
    insert into auth.users(id,email,email_confirmed_at) values
      ('${target}','synthetic-target@example.test',now()),
      ('${approver}','synthetic-approver@example.test',now());
    update public.profiles set full_name='Synthetic Owner', whatsapp='+962790000301', major='AI',
      university='Other University', academic_year=4, python_experience='basic',
      consent_version='registration-v1', consent_at=now(), registered_at=now() where id='${target}';
    insert into app_private.initial_admin_promotion_approval(singleton,user_id,approved_by,reason)
      values(true,'${target}','${approver}','SYNTHETIC OWNER APPROVAL ONLY');
  `);
  assert.equal((await pendingFor(target, { aal: 'aal1' })).rows[0].pending, true);
  assert.equal((await pendingFor(approver, { aal: 'aal2' })).rows[0].pending, false);
  await assert.rejects(
    pendingFor(null, { aal: 'aal2' }, 'anon'),
    (error) => error.code === '42501',
  );
  await assert.rejects(call(target, { aal: 'aal1' }), (error) => error.code === '42501');
  await assert.rejects(call(target, {}), (error) => error.code === '42501');
  await assert.rejects(call(approver, { aal: 'aal2' }), (error) => error.code === '42501');
  await assert.rejects(call(target, { aal: 'aal2' }), (error) => error.code === '42501');
  await db.query(
    "insert into auth.mfa_factors(user_id,factor_type,status) values($1,'totp','verified')",
    [target],
  );
  await call(target, { aal: 'aal2' });
  assert.equal(
    (
      await db.query(
        'select count(*)::int as n from app_private.application_admins where user_id=$1',
        [target],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        'select actor_id,subject_id,event,reason from app_private.application_admin_events where subject_id=$1',
        [target],
      )
    ).rows[0].actor_id,
    approver,
  );
  assert.equal(
    (await db.query('select count(*)::int as n from app_private.initial_admin_promotion_approval'))
      .rows[0].n,
    0,
  );
  assert.equal((await pendingFor(target, { aal: 'aal2' })).rows[0].pending, false);
  await assert.rejects(call(target, { aal: 'aal2' }), (error) => error.code === '42501');
  assert.equal(
    (
      await db.query(
        "select has_table_privilege('authenticated','app_private.initial_admin_promotion_approval','SELECT,INSERT,UPDATE,DELETE') as allowed",
      )
    ).rows[0].allowed,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select has_table_privilege('service_role','app_private.initial_admin_promotion_approval','SELECT,INSERT,DELETE') as allowed",
      )
    ).rows[0].allowed,
    true,
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('service_role','public.promote_initial_academy_admin()','EXECUTE') as allowed",
      )
    ).rows[0].allowed,
    false,
  );
  await assert.rejects(
    call(null, { aal: 'aal2' }, 'service_role'),
    (error) => error.code === '42501',
  );
});
