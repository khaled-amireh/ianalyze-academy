import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { asUser, createDatabase } from '../scripts/database-fixture.mjs';

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
  const call = (uid, sql, params = [], role = 'authenticated') =>
    asUser(db, uid, () => db.query(sql, params), role);

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
    'Team and Student cannot award; Admin correction withdraws name consent',
    async () => {
      assert.equal(
        (await call(admin, 'select public.current_academy_role() as role')).rows[0].role,
        'team',
      );
      assert.equal(
        (await call(admin, 'select public.current_academy_is_admin() as allowed')).rows[0].allowed,
        true,
      );
      for (const table of ['application_admins', 'application_admin_events']) {
        await assert.rejects(
          call(admin, `select * from app_private.${table}`),
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
        call(admin, 'select public.admin_award_points($1,$2,$3,$4)', [
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
      await call(admin, "select public.correct_registered_student_name($1,'Corrected Name')", [
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
      const first = await call(admin, 'select public.admin_award_points($1,$2,$3,$4) as id', args);
      const second = await call(admin, 'select public.admin_award_points($1,$2,$3,$4) as id', args);
      assert.equal(second.rows[0].id, first.rows[0].id);
      await assert.rejects(
        call(admin, 'select public.admin_award_points($1,$2,$3,$4)', [
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
      const history = await call(admin, 'select public.admin_award_history($1) as rows', [student]);
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
