import test from 'node:test';
import assert from 'node:assert/strict';
import { asUser, createDatabase } from '../scripts/database-fixture.mjs';

const studentA = '80000000-0000-4000-8000-000000000001';
const studentB = '80000000-0000-4000-8000-000000000002';
const team = '80000000-0000-4000-8000-000000000003';
const week = '81000000-0000-4000-8000-000000000001';
const activity = '82000000-0000-4000-8000-000000000001';
const draft = '82000000-0000-4000-8000-000000000002';
const publishedDraft = '82000000-0000-4000-8000-000000000003';
const rubric = '83000000-0000-4000-8000-000000000001';
const draftRubric = '83000000-0000-4000-8000-000000000002';
const publishedDraftRubric = '83000000-0000-4000-8000-000000000003';
const criterion = '84000000-0000-4000-8000-000000000001';
const draftCriterion = '84000000-0000-4000-8000-000000000002';
const publishedDraftCriterion = '84000000-0000-4000-8000-000000000003';
const request = '85000000-0000-4000-8000-000000000001';
const cancelRequest = '85000000-0000-4000-8000-000000000002';
const digest = 'a'.repeat(64);
const manifest = [{ name: 'report.pdf', type: 'application/pdf', size: 8, sha256: digest }];

test('dynamic file submissions enforce identity, reservations, private storage, and safe lifecycle', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const call = (uid, sql, params = [], role = 'authenticated') =>
    asUser(db, uid, () => db.query(sql, params), role);
  const denied = (uid, sql, params = []) =>
    assert.rejects(call(uid, sql, params), (error) => error.code === '42501');

  const serviceFunctionAcl = await db.query(`
    select
      has_function_privilege('service_role', 'app_private.finalize_activity_submission(uuid,jsonb)', 'EXECUTE') as service_finalize,
      has_function_privilege('anon', 'app_private.finalize_activity_submission(uuid,jsonb)', 'EXECUTE') as anon_finalize,
      has_function_privilege('authenticated', 'app_private.finalize_activity_submission(uuid,jsonb)', 'EXECUTE') as authenticated_finalize,
      has_function_privilege('service_role', 'app_private.cancel_activity_submission(uuid)', 'EXECUTE') as service_cancel,
      has_function_privilege('anon', 'app_private.cancel_activity_submission(uuid)', 'EXECUTE') as anon_cancel,
      has_function_privilege('authenticated', 'app_private.cancel_activity_submission(uuid)', 'EXECUTE') as authenticated_cancel
  `);
  assert.deepEqual(serviceFunctionAcl.rows[0], {
    service_finalize: true,
    anon_finalize: false,
    authenticated_finalize: false,
    service_cancel: true,
    anon_cancel: false,
    authenticated_cancel: false,
  });

  await db.exec(`
    insert into auth.users(id,email,email_confirmed_at) values
      ('${studentA}','activity-a@example.test',now()),
      ('${studentB}','activity-b@example.test',now()),
      ('${team}','activity-team@example.test',now());
    update app_private.user_roles set role='team',grant_reason='Synthetic security fixture' where user_id='${team}';
    insert into public.academy_weeks(id,week_number,kind,title_ar,title_en,status)
      values ('${week}',1,'teaching','اختبار','Test','published');
  `);
  for (const uid of [studentA, studentB])
    await asUser(db, uid, async () => {
      await db.query(
        `update public.profiles set full_name='Synthetic Student',whatsapp='+962790000001',
      major='AI',university='Other University',academic_year=4,python_experience='basic' where id=$1`,
        [uid],
      );
      await db.query("select public.complete_registration('registration-v1')");
    });
  await asUser(db, team, () =>
    db.exec(`
    insert into public.activities(id,week_id,title_ar,title_en,instructions_ar,instructions_en,
      max_score,status,opens_at,due_at,submission_mode,max_submission_files,max_submission_file_bytes,
      phase_1_ends_at,phase_2_ends_at)
    values ('${activity}','${week}','نشاط','Activity','تعليمات','Instructions',10,'draft',
      now()-interval '1 hour',now()+interval '1 day','files',2,1048576,now()+interval '1 hour',now()+interval '2 hours'),
      ('${draft}','${week}','مسودة','Draft', '', '', 5,'draft',null,null,'notebook',1,262144,null,null),
      ('${publishedDraft}','${week}','مسودة منشورة المعيار','Published rubric draft', '', '', 5,'draft',null,null,'notebook',1,262144,null,null);
    insert into public.rubrics(id,activity_id,version) values ('${rubric}','${activity}',1);
    insert into public.rubric_criteria(id,rubric_id,label_ar,label_en,max_points,sort_order)
      values ('${criterion}','${rubric}','المعيار','Criterion',10,0);
    insert into public.rubrics(id,activity_id,version) values
      ('${draftRubric}','${draft}',1),('${publishedDraftRubric}','${publishedDraft}',1);
    insert into public.rubric_criteria(id,rubric_id,label_ar,label_en,max_points,sort_order)
      values ('${draftCriterion}','${draftRubric}','المعيار','Criterion',5,0),
        ('${publishedDraftCriterion}','${publishedDraftRubric}','المعيار','Criterion',5,0);
    update public.rubrics set status='published' where id='${rubric}';
    update public.rubrics set status='published' where id='${publishedDraftRubric}';
    update public.activities set status='published' where id='${activity}';
  `),
  );
  await db.exec(
    "create or replace function app_private.submission_service_enabled() returns boolean language sql immutable set search_path='' as $$select true$$",
  );
  await asUser(db, team, () =>
    db.query(
      'update public.activities set phase_1_bonus_points=3,phase_2_bonus_points=2,phase_3_bonus_points=1 where id=$1',
      [activity],
    ),
  );
  await assert.rejects(
    asUser(db, team, () =>
      db.query('update public.activities set phase_1_bonus_points=1 where id=$1', [draft]),
    ),
    (error) => error.code === '22023',
  );
  await assert.rejects(
    asUser(db, team, () =>
      db.query('update public.activities set phase_2_bonus_points=4 where id=$1', [activity]),
    ),
    (error) => error.code === '22023',
  );

  const closedRequest = '85000000-0000-4000-8000-000000000030';
  const closedPath = `${studentA}/${activity}/${closedRequest}/closed.pdf`;
  await db.query(
    `insert into public.submissions(id,student_id,activity_id,rubric_id,attempt,submission_mode,status)
      values($1,$2,$3,$4,1,'files','uploading')`,
    [closedRequest, studentA, activity, rubric],
  );
  await db.query(
    `insert into public.activity_submission_files(submission_id,position,original_name,content_type,
      size_bytes,storage_path,expected_sha256) values($1,0,'closed.pdf','application/pdf',8,$2,$3)`,
    [closedRequest, closedPath, digest],
  );
  const closedCapabilities = await call(studentA, 'select public.academy_capabilities() as value');
  assert.equal(closedCapabilities.rows[0].value.activity_file_submissions, false);
  await assert.rejects(
    call(studentA, 'select public.reserve_activity_submission($1,$2,$3::jsonb)', [
      activity,
      '85000000-0000-4000-8000-000000000031',
      JSON.stringify(manifest),
    ]),
    (error) => error.code === '42501' && /Activity file submissions closed/.test(error.message),
  );
  await denied(
    studentA,
    "insert into storage.objects(bucket_id,name,owner_id,metadata) values('activity-submissions',$1,$2,$3::jsonb)",
    [closedPath, studentA, JSON.stringify({ size: 8, mimetype: 'application/pdf' })],
  );
  await assert.rejects(
    asUser(
      db,
      null,
      () =>
        db.query('select public.finalize_activity_submission($1,$2::jsonb)', [closedRequest, '[]']),
      'service_role',
    ),
    (error) => error.code === '42501' && /Activity file submissions closed/.test(error.message),
  );
  const closedRows = await db.query(
    "select count(*)::int as submissions,(select count(*)::int from storage.objects where bucket_id='activity-submissions' and name=$1) as objects from public.submissions where id=$2",
    [closedPath, closedRequest],
  );
  assert.deepEqual(closedRows.rows[0], { submissions: 1, objects: 0 });
  await db.query('delete from public.activity_submission_files where submission_id=$1', [
    closedRequest,
  ]);
  await db.query('delete from public.submissions where id=$1', [closedRequest]);
  await db.exec(
    "create or replace function app_private.activity_file_submissions_enabled() returns boolean language sql immutable set search_path='' as $$select true$$",
  );

  const reservation = await call(
    studentA,
    'select public.reserve_activity_submission($1,$2,$3::jsonb) as result',
    [activity, request, JSON.stringify(manifest)],
  );
  const reserved = reservation.rows[0].result;
  const path = reserved.files[0].path;
  assert.equal(reserved.id, request);
  assert.equal(reserved.status, 'uploading');
  assert.equal(reserved.files.length, 1);
  assert.equal(reserved.files[0].name, manifest[0].name);
  assert.doesNotMatch(reserved.files[0].path, /report\.pdf/);
  const row = (
    await db.query(
      'select submission_phase,status,submission_mode from public.submissions where id=$1',
      [request],
    )
  ).rows[0];
  assert.equal(
    row.submission_phase,
    null,
    'phase is not assigned from the reservation-time client request',
  );
  assert.equal(row.status, 'uploading');
  assert.equal(row.submission_mode, 'files');

  await t.test(
    'same owner can retry the exact idempotent reservation but cannot change its manifest',
    async () => {
      const again = await call(
        studentA,
        'select public.reserve_activity_submission($1,$2,$3::jsonb) as result',
        [activity, request, JSON.stringify(manifest)],
      );
      assert.deepEqual(again.rows[0].result, reserved);
      await assert.rejects(
        call(studentA, 'select public.reserve_activity_submission($1,$2,$3::jsonb)', [
          activity,
          request,
          JSON.stringify([{ ...manifest[0], size: 9 }]),
        ]),
        (error) => error.code === '22023',
      );
      await assert.rejects(
        call(studentB, 'select public.reserve_activity_submission($1,$2,$3::jsonb)', [
          activity,
          request,
          JSON.stringify(manifest),
        ]),
        (error) => error.code === '22023',
      );
    },
  );

  await t.test(
    'file limits and notebook/file mode separation are enforced server-side',
    async () => {
      for (const bad of [
        [{ ...manifest[0], name: '../report.pdf' }],
        [{ ...manifest[0], name: 'run.exe', type: 'application/octet-stream' }],
        [{ ...manifest[0], size: 1048577 }],
        [
          manifest[0],
          { ...manifest[0], name: 'second.pdf' },
          { ...manifest[0], name: 'third.pdf' },
        ],
      ]) {
        await assert.rejects(
          call(studentB, 'select public.reserve_activity_submission($1,$2,$3::jsonb)', [
            activity,
            '85000000-0000-4000-8000-000000000002',
            JSON.stringify(bad),
          ]),
        );
      }
      await assert.rejects(
        asUser(
          db,
          studentB,
          () =>
            db.query('select public.reserve_notebook($1,$2,$3,$4,$5)', [
              studentB,
              activity,
              '85000000-0000-4000-8000-000000000003',
              digest,
              100,
            ]),
          'service_role',
        ),
        (error) => error.code === '22023',
      );
    },
  );

  await t.test(
    'reservation metadata is private and verifier grants are column-scoped',
    async () => {
      const privileges = (
        await db.query(`
          select
            has_table_privilege('anon','public.activity_submission_files','select') as anon_select,
            has_table_privilege('authenticated','public.activity_submission_files','select') as student_select,
            has_table_privilege('service_role','public.activity_submission_files','select') as verifier_select,
            has_table_privilege('service_role','public.activity_submission_files','insert') as verifier_insert,
            has_table_privilege('service_role','public.activity_submission_files','update') as verifier_update,
            has_table_privilege('service_role','public.activity_submission_files','delete') as verifier_delete,
            has_table_privilege('service_role','public.submissions','select') as verifier_submission_table_select,
            has_column_privilege('service_role','public.submissions','id','select') as verifier_submission_id_select,
            has_column_privilege('service_role','public.submissions','student_id','select') as verifier_submission_student_select,
            has_column_privilege('service_role','public.submissions','submission_mode','select') as verifier_submission_mode_select,
            has_column_privilege('service_role','public.submissions','status','select') as verifier_submission_status_select,
            has_column_privilege('service_role','public.submissions','activity_snapshot','select') as verifier_submission_snapshot_select,
            has_table_privilege('service_role','public.submissions','insert') as verifier_submission_insert,
            has_table_privilege('service_role','public.submissions','update') as verifier_submission_update,
            has_table_privilege('service_role','public.submissions','delete') as verifier_submission_delete
        `)
      ).rows[0];
      assert.equal(privileges.anon_select, false);
      assert.equal(privileges.student_select, true);
      assert.equal(privileges.verifier_select, true);
      assert.equal(privileges.verifier_insert, false);
      assert.equal(privileges.verifier_update, false);
      assert.equal(privileges.verifier_delete, false);
      assert.equal(privileges.verifier_submission_table_select, false);
      assert.equal(privileges.verifier_submission_id_select, true);
      assert.equal(privileges.verifier_submission_student_select, true);
      assert.equal(privileges.verifier_submission_mode_select, true);
      assert.equal(privileges.verifier_submission_status_select, true);
      assert.equal(privileges.verifier_submission_snapshot_select, false);
      assert.equal(privileges.verifier_submission_insert, false);
      assert.equal(privileges.verifier_submission_update, false);
      assert.equal(privileges.verifier_submission_delete, false);
      assert.equal(
        (
          await call(
            studentA,
            'select * from public.activity_submission_files where submission_id=$1',
            [request],
          )
        ).rows.length,
        1,
      );
      assert.equal(
        (
          await call(
            studentB,
            'select * from public.activity_submission_files where submission_id=$1',
            [request],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await call(
            team,
            'select * from public.activity_submission_files where submission_id=$1',
            [request],
          )
        ).rows.length,
        0,
      );
      await denied(
        studentA,
        "insert into public.activity_submission_files(submission_id,position,original_name,content_type,size_bytes,storage_path,expected_sha256) values($1,1,'x.pdf','application/pdf',1,'forged',$2)",
        [request, digest],
      );
      await denied(
        studentA,
        'update public.activity_submission_files set sha256=$2 where submission_id=$1',
        [request, digest],
      );
      await denied(
        studentA,
        'delete from public.activity_submission_files where submission_id=$1',
        [request],
      );
      await denied(studentA, 'update public.submissions set submitted_at=now() where id=$1', [
        request,
      ]);
      await denied(studentA, 'select public.finalize_activity_submission($1,$2::jsonb)', [
        request,
        JSON.stringify([{ id: reserved.files[0].id, sha256: digest }]),
      ]);
    },
  );

  await t.test(
    'storage upload is reservation-bound; service finalizer verifies submitted metadata',
    async () => {
      await asUser(db, studentA, () =>
        db.query(
          "insert into storage.objects(bucket_id,name,owner_id,metadata) values('activity-submissions',$1,$2,$3::jsonb)",
          [path, studentA, JSON.stringify({ size: 8, mimetype: 'application/pdf' })],
        ),
      );
      await denied(
        studentB,
        "insert into storage.objects(bucket_id,name,owner_id,metadata) values('activity-submissions',$1,$2,$3::jsonb)",
        [path, studentB, JSON.stringify({ size: 8, mimetype: 'application/pdf' })],
      );
      await assert.rejects(
        call(
          null,
          'select public.finalize_activity_submission($1,$2::jsonb)',
          [request, JSON.stringify([{ id: reserved.files[0].id, sha256: 'b'.repeat(64) }])],
          'service_role',
        ),
        (error) => error.code === '22023',
      );
      const finalized = await call(
        null,
        'select public.finalize_activity_submission($1,$2::jsonb)',
        [request, JSON.stringify([{ id: reserved.files[0].id, sha256: digest }])],
        'service_role',
      );
      assert.equal(finalized.rows[0].finalize_activity_submission, null);
      const completed = (
        await db.query(
          'select submission_phase,status,submitted_at from public.submissions where id=$1',
          [request],
        )
      ).rows[0];
      assert.equal(completed.status, 'submitted');
      assert.ok(completed.submitted_at);
      assert.equal(completed.submission_phase, 'early');
      assert.equal(
        (
          await call(
            team,
            'select * from public.activity_submission_files where submission_id=$1',
            [request],
          )
        ).rows.length,
        1,
      );
      await call(
        studentA,
        "delete from storage.objects where bucket_id='activity-submissions' and name=$1",
        [path],
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from storage.objects where bucket_id='activity-submissions' and name=$1",
            [path],
          )
        ).rows[0].n,
        1,
      );
      await denied(studentA, 'select public.save_grade($1,$2::jsonb,$3,true,0)', [
        request,
        JSON.stringify({ [criterion]: 5 }),
        'unauthorized',
      ]);
      const gradeId = (
        await call(team, 'select public.save_grade($1,$2::jsonb,$3,true,0) as id', [
          request,
          JSON.stringify({ [criterion]: 5 }),
          'Synthetic rubric review',
        ])
      ).rows[0].id;
      const grade = (
        await db.query('select time_bonus_points,status from public.grades where id=$1', [gradeId])
      ).rows[0];
      assert.equal(Number(grade.time_bonus_points), 3);
      assert.equal(grade.status, 'published');
      const firstScore = (
        await db.query(
          'select score from app_private.scored_activity_grades(now()) where student_id=$1 and activity_id=$2',
          [studentA, activity],
        )
      ).rows[0];
      assert.equal(Number(firstScore.score), 8);
      const cappedGradeId = (
        await call(team, 'select public.save_grade($1,$2::jsonb,$3,true,1) as id', [
          request,
          JSON.stringify({ [criterion]: 9 }),
          'Synthetic capped review',
        ])
      ).rows[0].id;
      const cappedScore = (
        await db.query(
          'select score from app_private.scored_activity_grades(now()) where student_id=$1 and activity_id=$2',
          [studentA, activity],
        )
      ).rows[0];
      assert.equal(
        Number(
          (
            await db.query('select time_bonus_points from public.grades where id=$1', [
              cappedGradeId,
            ])
          ).rows[0].time_bonus_points,
        ),
        3,
      );
      assert.equal(
        Number(cappedScore.score),
        10,
        'rubric plus bonus is capped at the activity maximum',
      );
      await assert.rejects(
        call(team, 'update public.activities set phase_1_bonus_points=4 where id=$1', [activity]),
        (error) => error.code === '55000',
      );
    },
  );

  await t.test(
    'phase classification uses exact half-open boundaries and the immutable snapshot',
    async () => {
      const phaseOne = new Date(Date.now() + 60 * 60 * 1000);
      const phaseTwo = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const due = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const snapshot = JSON.stringify({
        max_score: 10,
        phase_1_ends_at: phaseOne.toISOString(),
        phase_2_ends_at: phaseTwo.toISOString(),
        phase_1_bonus_points: 3,
        phase_2_bonus_points: 2,
        phase_3_bonus_points: 1,
      });
      const cases = [
        ['85000000-0000-4000-8000-000000000010', new Date(phaseOne.getTime() - 1), 'early'],
        ['85000000-0000-4000-8000-000000000011', phaseOne, 'middle'],
        ['85000000-0000-4000-8000-000000000012', new Date(phaseTwo.getTime() - 1), 'middle'],
        ['85000000-0000-4000-8000-000000000013', phaseTwo, 'late'],
        ['85000000-0000-4000-8000-000000000014', due, 'late'],
      ];
      for (const [index, [id, instant, expected]] of cases.entries()) {
        await db.query(
          `insert into public.submissions(id,student_id,activity_id,rubric_id,attempt,submission_mode,activity_snapshot)
        values($1,$2,$3,$4,$5,'files',$6::jsonb)`,
          [id, studentB, activity, rubric, index + 1, snapshot],
        );
        await db.query(
          "update public.submissions set status='submitted',submitted_at=$2 where id=$1",
          [id, instant],
        );
        assert.equal(
          (await db.query('select submission_phase from public.submissions where id=$1', [id]))
            .rows[0].submission_phase,
          expected,
        );
      }
    },
  );

  await t.test(
    'notebook and file finalization both fail closed after the server deadline',
    async () => {
      await db.exec(`
      insert into public.activities(id,week_id,title_ar,title_en,instructions_ar,instructions_en,max_score,status,
        opens_at,due_at,submission_mode,max_submission_files,max_submission_file_bytes)
      values
        ('82000000-0000-4000-8000-000000000010','${week}','Expired file','Expired file','Instructions','Instructions',5,'draft',
          now()-interval '2 hours',now()-interval '1 hour','files',1,10485760),
        ('82000000-0000-4000-8000-000000000011','${week}','Expired notebook','Expired notebook','Instructions','Instructions',5,'draft',
          now()-interval '2 hours',now()-interval '1 hour','notebook',1,262144);
      insert into public.rubrics(id,activity_id,version) values
        ('83000000-0000-4000-8000-000000000010','82000000-0000-4000-8000-000000000010',1),
        ('83000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000011',1);
      insert into public.rubric_criteria(id,rubric_id,label_ar,label_en,max_points,sort_order) values
        ('84000000-0000-4000-8000-000000000010','83000000-0000-4000-8000-000000000010','Criterion','Criterion',5,0),
        ('84000000-0000-4000-8000-000000000011','83000000-0000-4000-8000-000000000011','Criterion','Criterion',5,0);
      update public.rubrics set status='published' where id in
        ('83000000-0000-4000-8000-000000000010','83000000-0000-4000-8000-000000000011');
      update public.activities set status='published' where id in
        ('82000000-0000-4000-8000-000000000010','82000000-0000-4000-8000-000000000011');
      insert into public.submissions(id,student_id,activity_id,rubric_id,attempt,submission_mode,notebook_sha256,
        notebook_bytes,activity_snapshot)
      values
        ('85000000-0000-4000-8000-000000000020','${studentA}','82000000-0000-4000-8000-000000000010',
          '83000000-0000-4000-8000-000000000010',1,'files',null,null,'{}'),
        ('85000000-0000-4000-8000-000000000021','${studentA}','82000000-0000-4000-8000-000000000011',
          '83000000-0000-4000-8000-000000000011',1,'notebook','${digest}',100,'{}');
      insert into public.activity_submission_files(id,submission_id,position,original_name,content_type,size_bytes,
        storage_path,expected_sha256)
      values('86000000-0000-4000-8000-000000000020','85000000-0000-4000-8000-000000000020',0,
        'late.pdf','application/pdf',8,'expired-file-path','${digest}');
    `);
      await assert.rejects(
        asUser(
          db,
          null,
          () =>
            db.query('select public.finalize_activity_submission($1,$2::jsonb)', [
              '85000000-0000-4000-8000-000000000020',
              JSON.stringify([{ id: '86000000-0000-4000-8000-000000000020', sha256: digest }]),
            ]),
          'service_role',
        ),
        (error) => error.code === '22023' && error.message.includes('deadline passed'),
      );
      await assert.rejects(
        asUser(
          db,
          null,
          () =>
            db.query('select public.finalize_notebook($1,$2)', [
              '85000000-0000-4000-8000-000000000021',
              digest,
            ]),
          'service_role',
        ),
        (error) => error.code === '22023' && error.message.includes('deadline passed'),
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.submissions where id in ('85000000-0000-4000-8000-000000000020','85000000-0000-4000-8000-000000000021') and status='uploading'",
          )
        ).rows[0].n,
        2,
      );
    },
  );

  await t.test(
    'unfinished upload cancellation is service-only and cannot leave reserved objects behind',
    async () => {
      await call(team, 'select public.request_resubmission($1)', [request]);
      const pending = (
        await call(
          studentA,
          'select public.reserve_activity_submission($1,$2,$3::jsonb) as result',
          [activity, cancelRequest, JSON.stringify(manifest)],
        )
      ).rows[0].result;
      const pendingPath = pending.files[0].path;
      await asUser(db, studentA, () =>
        db.query(
          "insert into storage.objects(bucket_id,name,owner_id,metadata) values('activity-submissions',$1,$2,$3::jsonb)",
          [pendingPath, studentA, JSON.stringify({ size: 8, mimetype: 'application/pdf' })],
        ),
      );
      await denied(studentA, 'select public.cancel_activity_submission($1)', [cancelRequest]);
      await assert.rejects(
        asUser(
          db,
          null,
          () => db.query('select public.cancel_activity_submission($1)', [cancelRequest]),
          'service_role',
        ),
        (error) => error.code === '55000',
      );
      // Simulate the authenticated service-side Storage API deletion before the RPC cleanup.
      await db.query(
        "delete from storage.objects where bucket_id='activity-submissions' and name=$1",
        [pendingPath],
      );
      await asUser(
        db,
        null,
        () => db.query('select public.cancel_activity_submission($1)', [cancelRequest]),
        'service_role',
      );
      assert.equal(
        (
          await db.query('select count(*)::int n from public.submissions where id=$1', [
            cancelRequest,
          ])
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from app_private.audit_events where target_id=$1 and action='activity_submission:cancelled'",
            [cancelRequest],
          )
        ).rows[0].n,
        1,
      );
    },
  );

  await t.test(
    'only Team can archive academic history; unused draft deletion is narrow',
    async () => {
      await denied(studentA, 'select public.archive_activity($1)', [activity]);
      await denied(studentA, 'select public.delete_activity_draft($1)', [draft]);
      await call(team, 'select public.archive_activity($1)', [activity]);
      assert.equal(
        (await db.query('select count(*)::int n from public.submissions where id=$1', [request]))
          .rows[0].n,
        1,
      );
      assert.equal(
        (
          await db.query(
            'select count(*)::int n from public.activity_submission_files where submission_id=$1',
            [request],
          )
        ).rows[0].n,
        1,
      );
      assert.ok(
        (await db.query('select archived_at from public.activities where id=$1', [activity]))
          .rows[0].archived_at,
      );
      await call(team, 'select public.delete_activity_draft($1)', [draft]);
      assert.equal(
        (await db.query('select count(*)::int n from public.activities where id=$1', [draft]))
          .rows[0].n,
        0,
      );
      assert.equal(
        (await db.query('select count(*)::int n from public.rubrics where id=$1', [draftRubric]))
          .rows[0].n,
        0,
      );
      await assert.rejects(
        call(team, 'select public.delete_activity_draft($1)', [publishedDraft]),
        (error) => error.code === '55000',
      );
      await call(team, 'select public.archive_activity($1)', [publishedDraft]);
      assert.ok(
        (await db.query('select archived_at from public.activities where id=$1', [publishedDraft]))
          .rows[0].archived_at,
      );
      assert.equal(
        (
          await db.query('select count(*)::int n from public.rubrics where id=$1', [
            publishedDraftRubric,
          ])
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from app_private.audit_events where target_id=$1 and action='activity:archived'",
            [activity],
          )
        ).rows[0].n,
        1,
      );
    },
  );
});
