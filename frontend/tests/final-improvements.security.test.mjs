import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDatabase, asUser, migrations } from '../scripts/database-fixture.mjs';
const A = '00000000-0000-4000-8000-000000000091',
  B = '00000000-0000-4000-8000-000000000092',
  T = '00000000-0000-4000-8000-000000000093',
  U = '00000000-0000-4000-8000-000000000094',
  H = '00000000-0000-4000-8000-000000000095';
const W = '10000000-0000-4000-8000-000000000091',
  ACT = '20000000-0000-4000-8000-000000000091',
  ANN = '30000000-0000-4000-8000-000000000091';
const ZUJ = 'Al-Zaytoonah University of Jordan';
test('additive university migration preserves historical profiles, UUIDs, permissions and roles', async (t) => {
  const all = migrations(),
    db = await createDatabase(all.slice(0, -1));
  t.after(() => db.close());
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'old@example.test',now()),($2,'other@example.test',now())",
    [H, B],
  );
  await db.query(
    "update public.profiles set full_name='Historical',whatsapp='+962790000001',major='Historical major',academic_year=4,python_experience='none',university_id='legacy-id',registered_at=now(),consent_at=now(),consent_version='registration-v1' where id=$1",
    [H],
  );
  const before = (await db.query('select * from public.profiles where id=$1', [H])).rows[0];
  const roles = (await db.query('select * from app_private.user_roles order by user_id')).rows;
  await db.exec(all.at(-1));
  const { university, ...after } = (
    await db.query('select * from public.profiles where id=$1', [H])
  ).rows[0];
  assert.equal(university, null);
  assert.deepEqual(after, before);
  assert.deepEqual(
    (await db.query('select * from app_private.user_roles order by user_id')).rows,
    roles,
  );
  await asUser(db, H, () =>
    db.query("update public.profiles set full_name='Updated historical' where id=$1", [H]),
  );
  await assert.rejects(
    asUser(db, H, () => db.query('update public.profiles set registered_at=null where id=$1', [H])),
    (e) => e.code === '42501',
  );
  await assert.rejects(
    asUser(db, H, () =>
      db.query("update app_private.user_roles set role='team' where user_id=$1", [H]),
    ),
    (e) => e.code === '42501',
  );
  assert.deepEqual(
    (
      await asUser(db, B, () =>
        db.query('select university_id from public.profiles where id=$1', [H]),
      )
    ).rows,
    [],
  );
});
test('university ID validation, uniqueness, ownership and registration enforced in PostgreSQL', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const q = (id, sql, args = []) => asUser(db, id, () => db.query(sql, args));
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'a@example.test',now()),($2,'b@example.test',now()),($3,'unverified@example.test',null)",
    [A, B, U],
  );
  for (const id of [A, B])
    await q(
      id,
      "update public.profiles set full_name='Test',whatsapp='+962790000001',major='Software Engineering',academic_year=4,python_experience='basic' where id=$1",
      [id],
    );
  await assert.rejects(
    q(A, "select public.complete_registration('registration-v1')"),
    (e) => e.code === '23514',
  );
  for (const value of [null, '', 'abc', '١٢٣', '123.4', '123456789012345678901'])
    await assert.rejects(
      q(A, 'update public.profiles set university=$1,university_id=$2 where id=$3', [
        ZUJ,
        value,
        A,
      ]),
      (e) => e.code === '23514',
    );
  await q(A, 'update public.profiles set university=$1,university_id=$2 where id=$3', [
    ZUJ,
    ' 202311432 ',
    A,
  ]);
  await q(A, "select public.complete_registration('registration-v1')");
  assert.equal(
    (await q(A, 'select university_id from public.profiles where id=$1', [A])).rows[0]
      .university_id,
    '202311432',
  );
  await assert.rejects(
    q(B, 'update public.profiles set university=$1,university_id=$2 where id=$3', [
      ZUJ,
      '202311432',
      B,
    ]),
    (e) => e.code === '23505' && e.constraint === 'profiles_zuj_university_id_unique',
  );
  await q(
    B,
    "update public.profiles set university='Another University',university_id=null where id=$1",
    [B],
  );
  await q(B, "select public.complete_registration('registration-v1')");
  await q(B, "update public.profiles set university_id='202311432' where id=$1", [B]);
  await assert.rejects(
    q(B, 'update public.profiles set university=$1 where id=$2', [ZUJ, B]),
    (e) => e.code === '23505',
  );
  await assert.rejects(
    q(A, 'update public.profiles set university=null where id=$1', [A]),
    (e) => e.code === '23514',
  );
  assert.equal(
    (await q(B, "update public.profiles set full_name='Attack' where id=$1 returning id", [A])).rows
      .length,
    0,
  );
  await assert.rejects(
    q(U, "select public.complete_registration('registration-v1')"),
    (e) => e.code === '42501',
  );
});
test('notifications release published content only; receipts are private and cannot forge events', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const q = (id, sql, args = []) => asUser(db, id, () => db.query(sql, args));
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'a@example.test',now()),($2,'b@example.test',now()),($3,'team@example.test',now()),($4,'u@example.test',null),($5,'organizer@example.test',now())",
    [A, B, T, U, H],
  );
  await db.query(
    "update app_private.user_roles set role='team',grant_reason='Test Leader and Organizer' where user_id in ($1,$2)",
    [T, H],
  );
  for (const id of [A, B, T, H]) {
    await q(
      id,
      "update public.profiles set full_name='Test',whatsapp='+962790000001',major='Other historical',university='Another University',academic_year=4,python_experience='basic' where id=$1",
      [id],
    );
    await q(id, "select public.complete_registration('registration-v1')");
  }
  await q(
    T,
    "insert into public.academy_weeks(id,week_number,kind,title_ar,title_en,status) values($1,1,'teaching','أسبوع','Week','published')",
    [W],
  );
  await q(
    T,
    "insert into public.activities(id,week_id,title_ar,title_en,max_score,status,due_at) values($1,$2,'نشاط','Activity',10,'published',now()+interval '1 day')",
    [ACT, W],
  );
  await q(
    T,
    "insert into public.announcements(id,title_ar,title_en,body_ar,body_en,status) values($1,'إعلان','Announcement','نص عام','Public body','published')",
    [ANN],
  );
  await q(
    H,
    "insert into public.announcements(title_ar,title_en,body_ar,body_en) values('خاص','Private draft','خاص','SECRET STAFF DRAFT')",
  );
  const feed = async (id) =>
    (await q(id, 'select public.academy_notifications() as items')).rows[0].items;
  let items = await feed(A);
  assert.equal(items.length, 3);
  assert.ok(items.every((x) => x.read_at === null));
  assert.ok(!JSON.stringify(items).includes('SECRET'));
  await q(A, 'select public.read_notification($1)', [`announcement:${ANN}`]);
  assert.ok((await feed(A)).find((x) => x.event_key === `announcement:${ANN}`).read_at);
  assert.ok((await feed(B)).every((x) => x.read_at === null));
  assert.deepEqual(
    (await q(B, 'select * from public.notification_receipts where user_id=$1', [A])).rows,
    [],
  );
  await q(A, "select public.read_notification('fake-event')");
  assert.equal((await q(A, 'select * from public.notification_receipts')).rows.length, 1);
  await assert.rejects(
    q(A, "insert into public.notification_receipts(user_id,event_key) values($1,'forged')", [B]),
    (e) => e.code === '42501',
  );
  await assert.rejects(
    q(
      A,
      "insert into public.announcements(title_ar,title_en,body_ar,body_en) values('هجوم','Attack','هجوم','Attack')",
    ),
    (e) => e.code === '42501',
  );
  await q(A, 'select public.read_notification()');
  assert.ok((await feed(A)).every((x) => x.read_at));
  await q(A, 'select public.read_notification()');
  assert.equal((await q(A, 'select * from public.notification_receipts')).rows.length, 3);
  // Editing keeps the event identity, publication time and each user's read state.
  const beforeEdit = (await feed(A)).find((x) => x.event_key === `announcement:${ANN}`);
  const receiptsBefore = (
    await db.query('select * from public.notification_receipts order by user_id,event_key')
  ).rows;
  await q(
    H,
    "update public.announcements set title_ar='إعلان محدث',title_en='Updated announcement',body_ar='نص محدث',body_en='Updated body' where id=$1",
    [ANN],
  );
  const afterEdit = (await feed(A)).filter((x) => x.event_key === `announcement:${ANN}`);
  assert.equal(afterEdit.length, 1);
  assert.equal(afterEdit[0].title_en, 'Updated announcement');
  assert.equal(afterEdit[0].created_at, beforeEdit.created_at);
  assert.equal(afterEdit[0].read_at, beforeEdit.read_at);
  assert.equal((await feed(B)).find((x) => x.event_key === `announcement:${ANN}`).read_at, null);
  for (const student of [A, B, U]) {
    assert.equal(
      (
        await q(
          student,
          "update public.announcements set body_en='Unauthorized' where id=$1 returning id",
          [ANN],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await q(
          student,
          "update public.announcements set status='draft' where id=$1 returning id",
          [ANN],
        )
      ).rows.length,
      0,
    );
  }
  await assert.rejects(
    asUser(db, null, () => db.query('select * from public.announcements'), 'anon'),
    (e) => e.code === '42501',
  );
  for (const field of ['title_ar', 'title_en', 'body_ar', 'body_en']) {
    await assert.rejects(
      q(T, `update public.announcements set ${field}='   ' where id=$1`, [ANN]),
      (e) => e.code === '23514',
    );
  }
  await q(T, "update public.announcements set status='draft' where id=$1", [ANN]);
  assert.equal((await feed(A)).length, 2);
  assert.equal(
    (await q(A, 'select * from public.announcements where id=$1', [ANN])).rows.length,
    0,
  );
  assert.equal(
    (await q(T, 'select * from public.announcements where id=$1', [ANN])).rows.length,
    1,
  );
  assert.deepEqual(
    (await db.query('select * from public.notification_receipts order by user_id,event_key')).rows,
    receiptsBefore,
  );
  await q(T, "update public.announcements set status='published' where id=$1", [ANN]);
  assert.equal((await feed(A)).filter((x) => x.event_key === `announcement:${ANN}`).length, 1);
  assert.equal(
    (await feed(A)).find((x) => x.event_key === `announcement:${ANN}`).read_at,
    beforeEdit.read_at,
  );
  await q(T, "update public.announcements set status='draft' where id=$1", [ANN]);
  await q(T, "update public.academy_weeks set status='draft' where id=$1", [W]);
  assert.deepEqual(await feed(A), []);
  await q(T, "update public.academy_weeks set status='published' where id=$1", [W]);
  const rubric = (
    await q(T, 'select public.create_draft_rubric($1,$2) as id', [
      ACT,
      [{ label_ar: 'معيار', label_en: 'Criterion', max_points: 10 }],
    ])
  ).rows[0].id;
  await q(T, "update public.rubrics set status='published' where id=$1", [rubric]);
  const criterion = (
    await db.query('select id from public.rubric_criteria where rubric_id=$1', [rubric])
  ).rows[0].id;
  const submission = '40000000-0000-4000-8000-000000000091';
  await db.query(
    "insert into public.submissions(id,student_id,activity_id,rubric_id,status,submitted_at) values($1,$2,$3,$4,'submitted',now())",
    [submission, A, ACT, rubric],
  );
  assert.ok((await feed(A)).some((x) => x.event_key === `submission:${submission}:submitted`));
  assert.ok(!(await feed(A)).some((x) => x.event_key.startsWith('deadline:')));
  assert.ok(!(await feed(B)).some((x) => x.event_key.startsWith('submission:')));
  await q(T, 'select public.save_grade($1,$2,$3,false,0)', [
    submission,
    { [criterion]: 9 },
    'SECRET DRAFT FEEDBACK',
  ]);
  assert.ok(!(await feed(A)).some((x) => x.event_key.startsWith('grade:')));
  assert.ok(!JSON.stringify(await feed(A)).includes('SECRET DRAFT FEEDBACK'));
  await q(T, 'select public.save_grade($1,$2,$3,true,1)', [
    submission,
    { [criterion]: 9 },
    'Published feedback',
  ]);
  assert.ok((await feed(A)).some((x) => x.event_key.startsWith('grade:')));
  assert.ok((await feed(A)).some((x) => x.event_key === `submission:${submission}:reviewed`));
  assert.ok(!(await feed(B)).some((x) => x.event_key.startsWith('grade:')));
  await assert.rejects(
    asUser(db, null, () => db.query('select public.academy_notifications()'), 'anon'),
    (e) => e.code === '42501',
  );
  assert.deepEqual(await feed(U), []);
  // A lost/revoked role must suppress even previously received notifications.
  await db.query('delete from app_private.user_roles where user_id=$1', [A]);
  assert.deepEqual(await feed(A), []);
  await db.exec(
    "create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key);insert into supabase_migrations.schema_migrations values('20261104000100')",
  );
  const readiness = readFileSync(
    new URL('../../supabase/operations/final-improvements-readiness.sql', import.meta.url),
    'utf8',
  );
  assert.ok(
    Object.values((await db.query(readiness)).rows[0]).every((x) => x === true),
    'Release schema/RLS check must pass on the tested migration',
  );
});
