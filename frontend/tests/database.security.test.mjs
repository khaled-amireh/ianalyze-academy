import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, asUser } from '../scripts/database-fixture.mjs';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const T = '00000000-0000-4000-8000-000000000003';
const U = '00000000-0000-4000-8000-000000000004';
const W = '10000000-0000-4000-8000-000000000001';
const WD = '10000000-0000-4000-8000-000000000002';
const ACT = '20000000-0000-4000-8000-000000000001';
const DRAFT = '20000000-0000-4000-8000-000000000002';
const RUBRIC = '30000000-0000-4000-8000-000000000001';
const CRITERION = '40000000-0000-4000-8000-000000000001';
const SA = '50000000-0000-4000-8000-000000000001';
const SB = '50000000-0000-4000-8000-000000000002';
const path = (student, submission) => `${student}/${ACT}/${submission}/submission.ipynb`;

test('embedded PostgreSQL security (test-only Auth/Storage fixture)', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const queryAs = (uid, sql, params = []) => asUser(db, uid, () => db.query(sql, params));
  const forbidden = (uid, sql, params = [], code = '42501') =>
    assert.rejects(queryAs(uid, sql, params), (error) => error.code === code);
  await db.exec(`
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
      ('${A}','student-a@example.test',now(),'{"role":"team"}'),
      ('${B}','student-b@example.test',now(),'{}'),
      ('${T}','team@example.test',now(),'{}'),
      ('${U}','unverified@example.test',null,'{}');
    update app_private.user_roles set role='team',grant_reason='Disposable local test' where user_id='${T}';
  `);
  for (const uid of [A, B])
    await asUser(db, uid, async () => {
      await db.query(
        "update public.profiles set full_name='Test Student', whatsapp='+962790000000', major='AI', academic_year=4, python_experience='none' where id=$1",
        [uid],
      );
      await db.query("select public.complete_registration('registration-v1')");
    });
  await asUser(db, T, async () => {
    await db.exec(`
      insert into public.academy_weeks(id,week_number,kind,title_ar,title_en,status) values
        ('${W}',1,'teaching','Test','Test','published'),('${WD}',2,'teaching','Test','Test','draft');
      insert into public.activities(id,week_id,title_ar,title_en,max_score,status) values
        ('${ACT}','${W}','Test','Test',10,'published'),('${DRAFT}','${W}','Test','Test',10,'draft');
      insert into public.rubrics(id,activity_id,version) values ('${RUBRIC}','${ACT}',1);
      insert into public.rubric_criteria(id,rubric_id,label_ar,label_en,max_points,sort_order)
        values ('${CRITERION}','${RUBRIC}','Test','Test',10,0);
      update public.rubrics set status='published' where id='${RUBRIC}';
    `);
  });
  // Operator fixtures represent a future trusted finalizer; no production users/files.
  await db.exec(`
    insert into public.submissions(id,student_id,activity_id,rubric_id,status,submitted_at) values
      ('${SA}','${A}','${ACT}','${RUBRIC}','submitted',now()),
      ('${SB}','${B}','${ACT}','${RUBRIC}','submitted',now());
    insert into storage.objects(bucket_id,name,owner_id) values
      ('student-submissions','${path(A, SA)}','${A}'),
      ('student-submissions','${path(B, SB)}','${B}'),
      ('team-materials','fixture.pdf','${T}');
  `);
  await t.test(
    'all ten tables use RLS; exposed functions are invokers and definer paths are fixed',
    async () => {
      const { rows } = await db.query(
        "select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind='r'",
      );
      assert.equal(rows.length, 10);
      assert.ok(rows.every((r) => r.relrowsecurity));
      assert.deepEqual(
        (
          await db.query(
            "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef",
          )
        ).rows,
        [],
      );
      const functions = (
        await db.query(
          "select p.proname,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.prosecdef",
        )
      ).rows;
      assert.ok(functions.every((f) => f.proconfig?.includes('search_path=""')));
    },
  );
  await t.test(
    'signup ignores forged role metadata; unverified accounts have no role or private access',
    async () => {
      assert.equal(
        (await queryAs(A, 'select public.current_academy_role() as role')).rows[0].role,
        'student',
      );
      assert.equal(
        (await queryAs(U, 'select public.current_academy_role() as role')).rows[0].role,
        null,
      );
      assert.deepEqual((await queryAs(U, 'select * from public.profiles')).rows, []);
      await forbidden(U, "select public.complete_registration('registration-v1')");
      await db.query('delete from app_private.user_roles where user_id=$1', [B]);
      assert.equal(
        (await queryAs(B, 'select public.current_academy_role() as role')).rows[0].role,
        null,
      );
      assert.deepEqual((await queryAs(B, 'select * from public.activities')).rows, []);
      await forbidden(B, "select public.complete_registration('registration-v1')");
      await db.query(
        "insert into app_private.user_roles(user_id,grant_reason) values ($1,'Restore disposable fixture')",
        [B],
      );
    },
  );
  await t.test('anonymous has no application table/function access or file access', async () => {
    for (const table of [
      'profiles',
      'academy_weeks',
      'activities',
      'rubrics',
      'rubric_criteria',
      'submissions',
      'grades',
      'grade_criterion_scores',
    ])
      await assert.rejects(
        asUser(db, null, () => db.query(`select * from public.${table}`), 'anon'),
        (e) => e.code === '42501',
      );
    await assert.rejects(
      asUser(db, null, () => db.query('select public.current_academy_role()'), 'anon'),
      (e) => e.code === '42501',
    );
    assert.deepEqual(
      (await asUser(db, null, () => db.query('select * from storage.objects'), 'anon')).rows,
      [],
    );
  });
  await t.test(
    'Student A cannot read/update B; Team sees registered students and its own profile',
    async () => {
      assert.deepEqual((await queryAs(A, 'select id from public.profiles')).rows, [{ id: A }]);
      assert.deepEqual(
        (
          await queryAs(A, "update public.profiles set major='Changed' where id=$1 returning id", [
            B,
          ])
        ).rows,
        [],
      );
      assert.equal((await queryAs(T, 'select id from public.profiles')).rows.length, 3);
    },
  );
  await t.test(
    'permitted updates work; email, consent, identity and system timestamps are protected',
    async () => {
      await queryAs(A, "update public.profiles set major='Data Science' where id=$1", [A]);
      for (const expression of [
        "email='forged@example.test'",
        'registered_at=now()',
        'consent_at=now()',
        "consent_version='forged'",
        'created_at=now()',
        `id='${B}'`,
      ])
        await forbidden(A, `update public.profiles set ${expression} where id=$1`, [A]);
      await forbidden(A, "update public.profiles set whatsapp='invalid' where id=$1", [A], '23514');
      await forbidden(A, "select public.complete_registration('unapproved-policy')", [], '22023');
    },
  );
  await t.test('Student and Team cannot read/write roles or audit tables', async () => {
    for (const uid of [A, T]) {
      await forbidden(uid, "update app_private.user_roles set role='team' where user_id=$1", [uid]);
      await forbidden(uid, 'select * from app_private.user_roles');
      await forbidden(uid, 'select * from app_private.audit_events');
    }
  });
  await t.test('students see only released learning records and cannot manage them', async () => {
    assert.equal((await queryAs(A, 'select * from public.academy_weeks')).rows.length, 1);
    assert.equal((await queryAs(A, 'select * from public.activities')).rows.length, 1);
    assert.equal((await queryAs(A, 'select * from public.rubric_criteria')).rows.length, 1);
    assert.deepEqual(
      (
        await queryAs(
          A,
          "update public.activities set status='published' where id=$1 returning id",
          [DRAFT],
        )
      ).rows,
      [],
    );
    await forbidden(
      A,
      "insert into public.academy_weeks(week_number,kind,title_ar,title_en) values (3,'teaching','Test','Test')",
    );
  });
  await t.test('published rubrics/criteria lock; invalid score maxima are rejected', async () => {
    await assert.rejects(
      queryAs(T, 'update public.rubric_criteria set max_points=11 where id=$1', [CRITERION]),
      /immutable/,
    );
    await assert.rejects(
      queryAs(T, "update public.rubrics set status='draft' where id=$1", [RUBRIC]),
      /immutable/,
    );
    await assert.rejects(
      queryAs(T, 'update public.activities set max_score=11 where id=$1', [ACT]),
      /locks/,
    );
    await assert.rejects(
      queryAs(
        T,
        "insert into public.rubrics(activity_id,version,status) values ($1,2,'published')",
        [ACT],
      ),
      /draft first/,
    );
    await assert.rejects(
      queryAs(
        T,
        "insert into public.activities(week_id,title_ar,title_en,max_score) values ($1,'Test','Test','NaN')",
        [W],
      ),
      (e) => e.code === '23514',
    );
  });
  await t.test('submission ownership and Team-document isolation are enforced', async () => {
    assert.deepEqual((await queryAs(A, 'select id from public.submissions')).rows, [{ id: SA }]);
    assert.equal((await queryAs(T, 'select * from public.submissions')).rows.length, 2);
    assert.equal((await queryAs(A, 'select * from storage.objects')).rows.length, 1);
    assert.equal((await queryAs(T, 'select * from storage.objects')).rows.length, 3);
    await forbidden(A, "update public.submissions set status='reviewed' where id=$1", [SA]);
  });
  await t.test(
    'grade drafts stay private; Team publishes immutable revisions; students never write scores',
    async () => {
      await forbidden(A, "select public.save_grade($1,$2,'forged',true,0)", [
        SA,
        { [CRITERION]: 10 },
      ]);
      await queryAs(T, "select public.save_grade($1,$2,'Draft',false,0)", [SA, { [CRITERION]: 8 }]);
      assert.deepEqual((await queryAs(A, 'select * from public.grades')).rows, []);
      assert.deepEqual((await queryAs(A, 'select * from public.grade_criterion_scores')).rows, []);
      await queryAs(T, "select public.save_grade($1,$2,'Published',true,1)", [
        SA,
        { [CRITERION]: 9 },
      ]);
      assert.equal((await queryAs(A, 'select * from public.grades')).rows.length, 1);
      assert.equal(
        Number(
          (await queryAs(A, 'select points from public.grade_criterion_scores')).rows[0].points,
        ),
        9,
      );
      assert.deepEqual((await queryAs(B, 'select * from public.grades')).rows, []);
      await forbidden(A, "update public.grades set feedback='Forged'");
      await forbidden(T, "update public.grades set feedback='Overwrite'");
      await forbidden(A, 'delete from public.grade_criterion_scores');
    },
  );
  await t.test('bad, foreign, incomplete and stale grades fail atomically', async () => {
    for (const scores of [
      { [CRITERION]: 11 },
      { [CRITERION]: -1 },
      { [CRITERION]: 0.001 },
      { [CRITERION]: '9' },
      { [B]: 9 },
      {},
    ])
      await forbidden(T, "select public.save_grade($1,$2,'Invalid',true,2)", [SA, scores], '22023');
    await forbidden(
      T,
      "select public.save_grade($1,$2,'Stale',true,0)",
      [SA, { [CRITERION]: 9 }],
      '40001',
    );
    assert.equal((await queryAs(T, 'select * from public.grades')).rows.length, 2);
  });
  await t.test(
    'private bucket limits match approval and upload reservations are blocked by default',
    async () => {
      const buckets = (await db.query('select * from storage.buckets order by id')).rows;
      assert.ok(buckets.every((b) => b.public === false));
      assert.equal(Number(buckets[0].file_size_limit), 262144);
      assert.deepEqual(buckets[0].allowed_mime_types, [
        'application/x-ipynb+json',
        'application/json',
      ]);
      await forbidden(
        A,
        'insert into public.submissions(student_id,activity_id,rubric_id,attempt) values ($1,$2,$3,2)',
        [A, ACT, RUBRIC],
      );
      await forbidden(
        A,
        "insert into storage.objects(bucket_id,name,owner_id) values ('student-submissions','forged.ipynb',$1)",
        [A],
      );
    },
  );
  await t.test(
    'future upload policies require exact reservations and deny spoofing, overwrite and delete',
    async () => {
      // Disposable-database override only; never included in a migration or application runtime.
      await db.exec(
        'create or replace function app_private.uploads_enabled() returns boolean language sql immutable as $$ select true; $$',
      );
      try {
        const reservation = (
          await queryAs(
            A,
            'insert into public.submissions(student_id,activity_id,rubric_id,attempt) values ($1,$2,$3,2) returning object_path',
            [A, ACT, RUBRIC],
          )
        ).rows[0].object_path;
        await forbidden(
          A,
          'insert into public.submissions(student_id,activity_id,rubric_id,attempt) values ($1,$2,$3,2)',
          [B, ACT, RUBRIC],
        );
        await forbidden(
          A,
          "insert into storage.objects(bucket_id,name,owner_id) values ('student-submissions',$1,$2)",
          [reservation, B],
        );
        await forbidden(
          B,
          "insert into storage.objects(bucket_id,name,owner_id) values ('student-submissions',$1,$2)",
          [reservation, B],
        );
        await forbidden(
          A,
          "insert into storage.objects(bucket_id,name,owner_id) values ('student-submissions',$1,$2)",
          [reservation.replace('submission.ipynb', 'payload.html'), A],
        );
        await queryAs(
          A,
          "insert into storage.objects(bucket_id,name,owner_id) values ('student-submissions',$1,$2)",
          [reservation, A],
        );
        await forbidden(
          A,
          "insert into storage.objects(bucket_id,name,owner_id) values ('student-submissions',$1,$2) on conflict (bucket_id,name) do update set owner_id=excluded.owner_id",
          [reservation, A],
        );
        assert.deepEqual(
          (
            await queryAs(A, 'delete from storage.objects where name=$1 returning id', [
              reservation,
            ])
          ).rows,
          [],
        );
        assert.deepEqual(
          (
            await queryAs(
              A,
              "update storage.objects set name='changed' where name=$1 returning id",
              [reservation],
            )
          ).rows,
          [],
        );
        await forbidden(
          A,
          "insert into storage.objects(bucket_id,name,owner_id) values ('team-materials','new.pdf',$1)",
          [A],
        );
      } finally {
        await db.exec(
          'create or replace function app_private.uploads_enabled() returns boolean language sql immutable as $$ select false; $$',
        );
      }
    },
  );
  await t.test('revoked Team loses access with the same authenticated identity', async () => {
    await db.query(
      "update app_private.user_roles set role='student', grant_reason='Disposable revocation test' where user_id=$1",
      [T],
    );
    assert.equal(
      (await queryAs(T, 'select public.current_academy_role() as role')).rows[0].role,
      'student',
    );
    assert.equal((await queryAs(T, 'select * from public.profiles')).rows.length, 1);
    assert.deepEqual((await queryAs(T, 'select * from storage.objects')).rows, []);
    await forbidden(T, "select public.save_grade($1,$2,'Revoked',true,2)", [
      SA,
      { [CRITERION]: 10 },
    ]);
  });
});
