import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { asUser, createDatabase, migrations } from '../scripts/database-fixture.mjs';

const student = '91000000-0000-4000-8000-000000000001';
const team = '91000000-0000-4000-8000-000000000002';
const week = '92000000-0000-4000-8000-000000000001';
const currentWeek = '92000000-0000-4000-8000-000000000002';
const activity = '93000000-0000-4000-8000-000000000001';
const notebookActivity = '93000000-0000-4000-8000-000000000002';
const delayedFileActivity = '93000000-0000-4000-8000-000000000003';
const delayedNotebookActivity = '93000000-0000-4000-8000-000000000004';
const rubric = '94000000-0000-4000-8000-000000000001';
const notebookRubric = '94000000-0000-4000-8000-000000000002';
const delayedFileRubric = '94000000-0000-4000-8000-000000000003';
const delayedNotebookRubric = '94000000-0000-4000-8000-000000000004';
const criterion = '95000000-0000-4000-8000-000000000001';
const notebookCriterion = '95000000-0000-4000-8000-000000000002';
const delayedFileCriterion = '95000000-0000-4000-8000-000000000003';
const delayedNotebookCriterion = '95000000-0000-4000-8000-000000000004';
const submission = '96000000-0000-4000-8000-000000000001';
const notebookSubmission = '96000000-0000-4000-8000-000000000002';
const delayedFileSubmission = '96000000-0000-4000-8000-000000000003';
const delayedNotebookSubmission = '96000000-0000-4000-8000-000000000004';
const grade = '97000000-0000-4000-8000-000000000001';
const notebookGrade = '97000000-0000-4000-8000-000000000002';
const delayedFileGrade = '97000000-0000-4000-8000-000000000003';
const delayedNotebookGrade = '97000000-0000-4000-8000-000000000004';

test('general file activity grades enter the production leaderboard once in all-time and current-week views', async (t) => {
  const sql = migrations();
  const fixture = readFileSync(
    new URL('./fixtures/production-leaderboard-scoring.sql', import.meta.url),
    'utf8',
  );
  const consentIndex = sql.findIndex((migration) => migration.includes('public_full_name_consent'));
  assert.ok(consentIndex > 0);
  const db = await createDatabase([
    ...sql.slice(0, consentIndex),
    fixture,
    ...sql.slice(consentIndex),
  ]);
  t.after(() => db.close());
  await db.exec(`
    insert into public.academy_weeks(id,week_number,kind,title_ar,title_en,status)
      values('${currentWeek}',2,'teaching','Synthetic current week','Synthetic current week','published');
  `);
  await db.exec(`
    insert into auth.users(id,email,email_confirmed_at) values
      ('${student}','file-rank@example.test',now()),('${team}','file-team@example.test',now());
    update app_private.user_roles set role='team' where user_id='${team}';
    update public.profiles set full_name='Synthetic File Student',whatsapp='+962790000001',major='AI',
      university='Other University',academic_year=4,python_experience='basic',consent_version='registration-v1',
      consent_at=now(),registered_at=now() where id='${student}';
    insert into public.academy_weeks(id,week_number,kind,title_ar,title_en,status)
      values('${week}',1,'teaching','أسبوع الاختبار','Synthetic week','published');
    insert into public.activities(id,week_id,title_ar,title_en,instructions_ar,instructions_en,max_score,status,
      opens_at,due_at,submission_mode,max_submission_files,max_submission_file_bytes)
      values('${activity}','${currentWeek}','نشاط','File activity','تعليمات','Instructions',5,'draft',
        now()-interval '1 hour',now()+interval '1 day','files',2,1048576);
    insert into public.rubrics(id,activity_id,version) values('${rubric}','${activity}',1);
    insert into public.rubric_criteria(id,rubric_id,label_ar,label_en,max_points,sort_order)
      values('${criterion}','${rubric}','المعيار','Criterion',5,0);
    update public.rubrics set status='published' where id='${rubric}';
    update public.activities set status='published' where id='${activity}';
    insert into public.submissions(id,student_id,activity_id,rubric_id,attempt,status,submitted_at,
      submission_mode,received_at,activity_snapshot)
      values('${submission}','${student}','${activity}','${rubric}',1,'submitted',now(),
        'files',now(),jsonb_build_object('max_score',5));
    insert into public.grades(id,submission_id,rubric_id,reviewer_id,revision,feedback,status,published_at)
      values('${grade}','${submission}','${rubric}','${team}',1,'Synthetic grade','published',now());
    insert into public.grade_criterion_scores(grade_id,rubric_id,criterion_id,points)
      values('${grade}','${rubric}','${criterion}',4);
    -- The hosted grade_points trigger writes rubric points to point_awards.
    -- Model that canonical row so the migration test catches double counting.
    insert into public.point_awards(student_id,source_key,points,period_start,submission_id,
      reviewed_by,reviewed_at,scoring_week)
      values('${student}','synthetic-file-grade',4,'2026-11-20','${submission}','${team}',
        '2026-11-21 12:00 Asia/Amman',2);
    insert into public.point_awards(student_id,source_key,points,period_start,reviewed_by,reviewed_at,scoring_week)
      values('${student}','synthetic-prior-week',10,'2026-11-19','${team}','2026-11-19 12:00 Asia/Amman',1);
    insert into app_private.scoring_membership_events(student_id,eligible,effective_at)
      values('${student}',true,'2026-11-19 00:00 Asia/Amman');
    create or replace function app_private.scoring_now() returns timestamptz language sql
      set search_path='' as $$select '2026-11-21 12:00 Asia/Amman'::timestamptz$$;
    create or replace function app_private.leaderboard_enabled() returns boolean language sql immutable
      set search_path='' as $$select true$$;
  `);
  await db.exec(`
    update public.grades set time_bonus_points=2 where id='${grade}';
    insert into public.activities(id,week_id,title_ar,title_en,instructions_ar,instructions_en,max_score,status,
      opens_at,due_at,submission_mode,max_submission_files,max_submission_file_bytes)
      values('${notebookActivity}','${currentWeek}','Notebook','Notebook activity','Instructions','Instructions',8,'draft',
        now()-interval '1 hour',now()+interval '1 day','notebook',1,262144);
    insert into public.rubrics(id,activity_id,version) values('${notebookRubric}','${notebookActivity}',1);
    insert into public.rubric_criteria(id,rubric_id,label_ar,label_en,max_points,sort_order)
      values('${notebookCriterion}','${notebookRubric}','Criterion','Criterion',8,0);
    update public.rubrics set status='published' where id='${notebookRubric}';
    update public.activities set status='published' where id='${notebookActivity}';
    insert into public.submissions(id,student_id,activity_id,rubric_id,attempt,status,submitted_at,
      submission_mode,received_at,activity_snapshot,submission_phase)
      values('${notebookSubmission}','${student}','${notebookActivity}','${notebookRubric}',1,'submitted',now(),
        'notebook',now(),jsonb_build_object('max_score',8),'early');
    insert into public.grades(id,submission_id,rubric_id,reviewer_id,revision,feedback,status,published_at,time_bonus_points)
      values('${notebookGrade}','${notebookSubmission}','${notebookRubric}','${team}',1,'Synthetic notebook grade','published',now(),2);
    insert into public.grade_criterion_scores(grade_id,rubric_id,criterion_id,points)
      values('${notebookGrade}','${notebookRubric}','${notebookCriterion}',3);
    insert into public.point_awards(student_id,source_key,points,period_start,submission_id,reviewed_by,reviewed_at,scoring_week)
      values('${student}','synthetic-notebook-grade',3,'2026-11-20','${notebookSubmission}','${team}',now(),2);
  `);
  await db.exec(`
    insert into public.activities(id,week_id,title_ar,title_en,instructions_ar,instructions_en,max_score,status,
      opens_at,due_at,submission_mode,max_submission_files,max_submission_file_bytes)
      values
        ('${delayedFileActivity}','${week}','Delayed file','Delayed file activity','Instructions','Instructions',10,'draft',
          now()-interval '1 week',now()-interval '1 day','files',2,1048576),
        ('${delayedNotebookActivity}','${week}','Delayed notebook','Delayed notebook activity','Instructions','Instructions',8,'draft',
          now()-interval '1 week',now()-interval '1 day','notebook',1,262144);
    insert into public.rubrics(id,activity_id,version) values
      ('${delayedFileRubric}','${delayedFileActivity}',1),
      ('${delayedNotebookRubric}','${delayedNotebookActivity}',1);
    insert into public.rubric_criteria(id,rubric_id,label_ar,label_en,max_points,sort_order) values
      ('${delayedFileCriterion}','${delayedFileRubric}','Criterion','Criterion',10,0),
      ('${delayedNotebookCriterion}','${delayedNotebookRubric}','Criterion','Criterion',8,0);
    update public.rubrics set status='published' where id in ('${delayedFileRubric}','${delayedNotebookRubric}');
    update public.activities set status='published' where id in ('${delayedFileActivity}','${delayedNotebookActivity}');
    insert into public.submissions(id,student_id,activity_id,rubric_id,attempt,status,submitted_at,
      submission_mode,received_at,activity_snapshot,submission_phase) values
      ('${delayedFileSubmission}','${student}','${delayedFileActivity}','${delayedFileRubric}',1,'submitted',now()-interval '1 day',
        'files',now()-interval '1 day',jsonb_build_object('max_score',10),'early'),
      ('${delayedNotebookSubmission}','${student}','${delayedNotebookActivity}','${delayedNotebookRubric}',1,'submitted',now()-interval '1 day',
        'notebook',now()-interval '1 day',jsonb_build_object('max_score',8),'early');
    insert into public.grades(id,submission_id,rubric_id,reviewer_id,revision,feedback,status,published_at,time_bonus_points) values
      ('${delayedFileGrade}','${delayedFileSubmission}','${delayedFileRubric}','${team}',1,'Synthetic delayed file grade','published',now(),1),
      ('${delayedNotebookGrade}','${delayedNotebookSubmission}','${delayedNotebookRubric}','${team}',1,'Synthetic delayed notebook grade','published',now(),1);
    insert into public.grade_criterion_scores(grade_id,rubric_id,criterion_id,points) values
      ('${delayedFileGrade}','${delayedFileRubric}','${delayedFileCriterion}',5),
      ('${delayedNotebookGrade}','${delayedNotebookRubric}','${delayedNotebookCriterion}',3);
    -- Review happened in the current week, but each canonical grade award is
    -- attributed to the activity's prior scoring week.
    insert into public.point_awards(student_id,source_key,points,period_start,submission_id,reviewed_by,reviewed_at,scoring_week) values
      ('${student}','synthetic-delayed-file-grade',5,'2026-11-19','${delayedFileSubmission}','${team}',now(),1),
      ('${student}','synthetic-delayed-notebook-grade',3,'2026-11-19','${delayedNotebookSubmission}','${team}',now(),1);
  `);
  const allTime = (await db.query('select public.academy_leaderboard(false) as rows')).rows[0].rows;
  const weekly = (await db.query('select public.academy_leaderboard(true) as rows')).rows[0].rows;
  assert.deepEqual(
    allTime.map((row) => [row.points, row.activities]),
    [[30, 5]],
  );
  assert.deepEqual(
    weekly.map((row) => [row.points, row.activities]),
    [[10, 2]],
  );
  assert.equal(allTime[0].is_you, false);
});

test('performance ties share rank and the private own-row marker identifies only the caller', async (t) => {
  const sql = migrations();
  const fixture = readFileSync(
    new URL('./fixtures/production-leaderboard-scoring.sql', import.meta.url),
    'utf8',
  );
  const consentIndex = sql.findIndex((migration) => migration.includes('public_full_name_consent'));
  assert.ok(consentIndex > 0);
  const db = await createDatabase([
    ...sql.slice(0, consentIndex),
    fixture,
    ...sql.slice(consentIndex),
  ]);
  t.after(() => db.close());
  const first = '91000000-0000-4000-8000-000000000011';
  const second = '91000000-0000-4000-8000-000000000012';
  await db.exec(`
    insert into auth.users(id,email,email_confirmed_at) values
      ('${first}','tie-first@example.test',now()),
      ('${second}','tie-second@example.test',now());
    update public.profiles set full_name='Synthetic First',whatsapp='+962790000011',major='AI',
      university='Other University',academic_year=4,python_experience='basic',
      consent_version='registration-v1',consent_at=now(),registered_at=now()
      where id in ('${first}','${second}');
    create or replace function app_private.leaderboard_enabled() returns boolean
      language sql immutable set search_path='' as $$select true$$;
    create or replace function app_private.leaderboard_base_rows(p_weekly boolean, p_now timestamptz)
    returns table(student_id uuid, points numeric, activities bigint, tie_activities bigint,
      completed_at timestamptz, fallback_alias text)
    language sql stable security definer set search_path='' as $$
      select '${first}'::uuid, 10::numeric, 2::bigint, 2::bigint,
        '2026-11-22 12:00 Asia/Amman'::timestamptz, 'Learner Synthetic A'::text
      union all
      select '${second}'::uuid, 10::numeric, 2::bigint, 2::bigint,
        '2026-11-22 12:00 Asia/Amman'::timestamptz, 'Learner Synthetic B'::text
    $$;
  `);
  const publicRows = (await db.query('select public.academy_leaderboard(false) as rows')).rows[0]
    .rows;
  assert.deepEqual(
    publicRows.map((row) => row.rank),
    [1, 1],
  );
  assert.deepEqual(Object.keys(publicRows[0]).sort(), [
    'activities',
    'alias',
    'is_you',
    'points',
    'rank',
  ]);
  assert.ok(publicRows.every((row) => row.is_you === false));
  const ownRows = await asUser(db, first, () =>
    db.query('select public.academy_leaderboard(false) as rows'),
  );
  assert.deepEqual(
    ownRows.rows[0].rows.map((row) => [row.rank, row.is_you]),
    [
      [1, true],
      [1, false],
    ],
  );
  assert.deepEqual(Object.keys(ownRows.rows[0].rows[0]).sort(), [
    'activities',
    'alias',
    'is_you',
    'points',
    'rank',
  ]);
});
