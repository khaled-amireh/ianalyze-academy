import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createDatabase, asUser } from '../scripts/database-fixture.mjs';

test('full-name consent is opt-in, withdrawable, and cannot be impersonated by profile writes', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const student = randomUUID();
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
    student,
    'student@example.test',
  ]);
  await db.query(
    "update public.profiles set full_name='Lina Example',whatsapp='+962790000001',major='Data',academic_year=2,python_experience='basic',locale='en',university='Other',leaderboard_alias='Learner 1234567890' where id=$1",
    [student],
  );
  const asStudent = (sql, params = []) => asUser(db, student, () => db.query(sql, params));
  await asStudent("select public.complete_registration('registration-v1')");
  const packet = async () =>
    (await db.query("select public.academy_rankings('all',null) as payload")).rows[0].payload;
  assert.equal((await packet()).rows[0].alias, 'Learner 1234567890');
  await assert.rejects(() =>
    asStudent("update public.profiles set leaderboard_name='Someone Else' where id=$1", [student]),
  );
  await assert.rejects(() =>
    asStudent("update public.profiles set leaderboard_alias='Someone Else' where id=$1", [student]),
  );
  await asStudent('select public.set_public_full_name_consent(true)');
  assert.equal((await packet()).rows[0].alias, 'Lina Example');
  await assert.rejects(() =>
    asStudent("update public.profiles set full_name='Impersonated Name' where id=$1", [student]),
  );
  await assert.rejects(() =>
    asStudent('update public.profiles set public_full_name_consent=false where id=$1', [student]),
  );
  await db.query("update public.profiles set full_name='Corrected Name' where id=$1", [student]);
  assert.equal((await packet()).rows[0].alias, 'Learner 1234567890');
  await asStudent('select public.set_public_full_name_consent(true)');
  assert.equal((await packet()).rows[0].alias, 'Corrected Name');
  await asStudent('select public.set_public_full_name_consent(false)');
  assert.equal((await packet()).rows[0].alias, 'Learner 1234567890');
});

test('only verified application Admins can atomically award append-only idempotent points', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const admin = randomUUID(),
    leader = randomUUID(),
    student = randomUUID(),
    zero = randomUUID();
  for (const [id, name, role] of [
    [admin, 'Admin Fixture', 'student'],
    [leader, 'Leader Fixture', 'team'],
    [student, 'Student Fixture', 'student'],
    [zero, 'Zero Fixture', 'student'],
  ]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      id,
      `${id}@example.test`,
    ]);
    await db.query(
      "update public.profiles set full_name=$2,whatsapp='+962790000001',major='Data',academic_year=2,python_experience='basic',locale='en',university='Other' where id=$1",
      [id, name],
    );
    if (role === 'team')
      await db.query(
        "update app_private.user_roles set role='team',grant_reason='fixture leader' where user_id=$1",
        [id],
      );
    if (id !== zero)
      await asUser(db, id, () =>
        db.query("select public.complete_registration('registration-v1')"),
      );
    else
      await asUser(db, id, () =>
        db.query("select public.complete_registration('registration-v1')"),
      );
  }
  await db.query(
    "insert into app_private.application_admins(user_id,grant_reason) values($1,'isolated security fixture')",
    [admin],
  );
  const asAdmin = (sql, params = []) => asUser(db, admin, () => db.query(sql, params));
  const asLeader = (sql, params = []) => asUser(db, leader, () => db.query(sql, params));
  const asStudent = (sql, params = []) => asUser(db, student, () => db.query(sql, params));
  assert.equal((await asAdmin('select public.current_academy_role() r')).rows[0].r, 'team');
  assert.equal((await asAdmin('select public.current_academy_is_admin() a')).rows[0].a, true);
  assert.equal((await asLeader('select public.current_academy_is_admin() a')).rows[0].a, false);
  const key = randomUUID();
  await assert.rejects(() =>
    asLeader('select public.admin_award_points($1,10,$2,$3)', [student, 'unauthorized', key]),
  );
  await assert.rejects(() =>
    asStudent('select public.admin_award_points($1,10,$2,$3)', [
      student,
      'self award',
      randomUUID(),
    ]),
  );
  for (const amount of ['0', '-1', '1.5', '1000000000000000'])
    await assert.rejects(() =>
      asAdmin('select public.admin_award_points($1,$2::numeric,$3,$4)', [
        student,
        amount,
        'invalid fixture',
        randomUUID(),
      ]),
    );
  await assert.rejects(() =>
    asAdmin('select public.admin_award_points($1,1,$2,$3)', [student, ' ', randomUUID()]),
  );
  const first = (
    await asAdmin('select public.admin_award_points($1,42,$2,$3) id', [
      student,
      'verified manual award',
      key,
    ])
  ).rows[0].id;
  const retry = (
    await asAdmin('select public.admin_award_points($1,42,$2,$3) id', [
      student,
      'verified manual award',
      key,
    ])
  ).rows[0].id;
  assert.equal(retry, first);
  await assert.rejects(() =>
    asAdmin('select public.admin_award_points($1,43,$2,$3)', [student, 'different payload', key]),
  );
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from app_private.manual_point_awards where idempotency_key=$1',
        [key],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(() =>
    db.query("update app_private.manual_point_awards set reason='changed' where id=$1", [first]),
  );
  await assert.rejects(() =>
    db.query('delete from app_private.manual_point_awards where id=$1', [first]),
  );
  const packet = (await db.query("select public.academy_rankings('all',null) as payload")).rows[0]
    .payload;
  const alias = (id) => `Learner ${createHash('md5').update(id).digest('hex').slice(0, 10)}`;
  assert.equal(packet.rows.find((row) => row.alias === alias(student)).points, 42);
  assert.equal(packet.rows.find((row) => row.alias === alias(zero)).points, 0);
  const archived = (
    await db.query(`select app_private.rankings_at('archive',
    app_private.scoring_week(now()), app_private.scoring_start(app_private.scoring_week(now())+1)+interval '1 second') payload`)
  ).rows[0].payload;
  assert.equal(archived.rows.find((row) => row.alias === alias(student)).original_points, 42);
  await assert.rejects(() => asLeader('select * from public.admin_search_students()'));
  await assert.rejects(() => asStudent('select * from public.admin_point_award_history(null)'));
  await db.query('delete from app_private.application_admins where user_id=$1', [admin]);
  await assert.rejects(() =>
    asAdmin('select public.admin_award_points($1,1,$2,$3)', [student, 'revoked', randomUUID()]),
  );
  await db.query(
    "insert into app_private.application_admins(user_id,grant_reason) values($1,'fixture regrant')",
    [admin],
  );
  const privateSearch = await asAdmin(
    "select to_jsonb(s) data from public.admin_search_students('Fixture') s",
  );
  assert.equal(privateSearch.rows.length, 3);
  assert.ok(!JSON.stringify(privateSearch.rows).includes('@example.test'));
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from app_private.application_admin_events where user_id=$1 and action='grant'",
        [admin],
      )
    ).rows[0].n,
    2,
  );
});
