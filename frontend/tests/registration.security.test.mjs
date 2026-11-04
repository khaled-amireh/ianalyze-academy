import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDatabase, asUser, migrations } from '../scripts/database-fixture.mjs';
import { normalizeJordanianMobile } from '../src/lib/jordanian-phone.ts';
import { phoneCases } from './fixtures/jordanian-phones.ts';

const A = '00000000-0000-4000-8000-000000000011';
const B = '00000000-0000-4000-8000-000000000012';
const L = '00000000-0000-4000-8000-000000000013';
const O = '00000000-0000-4000-8000-000000000014';
const U = '00000000-0000-4000-8000-000000000015';
const H = '00000000-0000-4000-8000-000000000016';

test('registration migration, normalized data and private participant access in embedded PostgreSQL', async (t) => {
  const all = migrations().slice(0, 5);
  const db = await createDatabase(all.slice(0, -1));
  t.after(() => db.close());
  const queryAs = (uid, sql, args = []) => asUser(db, uid, () => db.query(sql, args));
  await db.exec(`
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
      ('${A}','a@example.test',now(),'{}'), ('${B}','b@example.test',now(),'{}'),
      ('${L}','leader@example.test',now(),'{}'), ('${O}','organizer@example.test',now(),'{}'),
      ('${U}','unverified@example.test',null,'{}'), ('${H}','historical@example.test',now(),'{}');
    update app_private.user_roles set role='team',grant_reason='Disposable Leader/Organizer test' where user_id in ('${L}','${O}');
    update public.profiles set full_name='Historical participant',whatsapp='+447700900123',major='AI',academic_year=7,python_experience='none',consent_at=now(),consent_version='registration-v1',registered_at=now() where id='${H}';
  `);
  const historical = (await db.query('select * from public.profiles where id=$1', [H])).rows[0];
  await db.exec(all.at(-1));
  await t.test(
    'forward migration does not rewrite existing phone, year or historical timestamps',
    async () => {
      assert.deepEqual(
        (await db.query('select * from public.profiles where id=$1', [H])).rows[0],
        historical,
      );
      await queryAs(
        H,
        'update public.profiles set major=$1,whatsapp=$2,academic_year=$3 where id=$4',
        ['Data Science', historical.whatsapp, historical.academic_year, H],
      );
      const after = (await db.query('select * from public.profiles where id=$1', [H])).rows[0];
      for (const field of ['whatsapp', 'academic_year', 'registered_at', 'consent_at'])
        assert.deepEqual(after[field], historical[field]);
    },
  );
  await t.test('client and server normalize the same valid and invalid phone corpus', async () => {
    for (const [input, expected] of phoneCases) {
      const { rows } = await queryAs(
        A,
        'select app_private.normalize_jordanian_mobile($1) as phone',
        [input],
      );
      assert.equal(rows[0].phone, expected, input);
      assert.equal(rows[0].phone, normalizeJordanianMobile(input), input);
      if (expected) {
        const saved = await queryAs(
          A,
          'update public.profiles set whatsapp=$1 where id=$2 returning whatsapp',
          [input, A],
        );
        assert.equal(saved.rows[0].whatsapp, expected);
      } else
        await assert.rejects(
          queryAs(A, 'update public.profiles set whatsapp=$1 where id=$2', [input, A]),
          (e) => e.code === '23514',
        );
    }
  });
  await t.test('server denies new out-of-range years while allowing every year 1–5', async () => {
    for (const year of [1, 2, 3, 4, 5])
      await queryAs(A, 'update public.profiles set academic_year=$1 where id=$2', [year, A]);
    for (const year of [0, 6, 7, 8, 9])
      await assert.rejects(
        queryAs(A, 'update public.profiles set academic_year=$1 where id=$2', [year, A]),
        (e) => e.code === '23514',
      );
  });
  await t.test(
    'registration is verified, idempotent and automatically Student without metadata escalation',
    async () => {
      await queryAs(
        A,
        "update public.profiles set full_name='Local Student',whatsapp='0797232936',major='AI',academic_year=4,python_experience='basic',university_id='LOCAL-ID' where id=$1",
        [A],
      );
      await queryAs(A, "select public.complete_registration('registration-v1')");
      const before = (
        await queryAs(A, 'select registered_at,consent_at from public.profiles where id=$1', [A])
      ).rows[0];
      await queryAs(A, "select public.complete_registration('registration-v1')");
      assert.deepEqual(
        (await queryAs(A, 'select registered_at,consent_at from public.profiles where id=$1', [A]))
          .rows[0],
        before,
      );
      assert.equal(
        (await queryAs(A, 'select public.current_academy_role() as role')).rows[0].role,
        'student',
      );
    },
  );
  await t.test(
    'Leader and Organizer Team assignments read all registration columns and missing optional data safely',
    async () => {
      for (const uid of [L, O]) {
        const result = await queryAs(
          uid,
          'select full_name,email,whatsapp,major,academic_year,python_experience,university_id,locale,registered_at from public.profiles where id=$1',
          [A],
        );
        assert.equal(result.rows.length, 1);
        assert.equal(result.rows[0].whatsapp, '+962797232936');
        assert.equal(result.rows[0].university_id, 'LOCAL-ID');
        assert.equal(
          (await queryAs(uid, 'select university_id from public.profiles where id=$1', [H])).rows[0]
            .university_id,
          null,
        );
        assert.deepEqual(
          (await queryAs(uid, 'select id from public.profiles where id=$1', [B])).rows,
          [],
        );
      }
    },
  );
  await t.test(
    'anonymous, unverified, unrelated Students and revoked Team cannot read private registration fields',
    async () => {
      await assert.rejects(
        asUser(db, null, () => db.query('select * from public.profiles'), 'anon'),
        (e) => e.code === '42501',
      );
      for (const uid of [U, B])
        assert.deepEqual(
          (await queryAs(uid, 'select * from public.profiles where id=$1', [A])).rows,
          [],
        );
      await assert.rejects(
        queryAs(U, "select public.complete_registration('registration-v1')"),
        (e) => e.code === '42501',
      );
      await assert.rejects(
        queryAs(A, "update app_private.user_roles set role='team' where user_id=$1", [A]),
        (e) => e.code === '42501',
      );
      await db.query(
        "update app_private.user_roles set role='student',grant_reason='Disposable revocation test' where user_id=$1",
        [O],
      );
      assert.deepEqual(
        (await queryAs(O, 'select * from public.profiles where id=$1', [A])).rows,
        [],
      );
    },
  );
});

test('email templates contain bilingual actions, generated URLs and mobile-friendly layout without fixed tokens', () => {
  for (const name of ['confirmation', 'recovery']) {
    const html = readFileSync(
      new URL(`../../supabase/templates/${name}.html`, import.meta.url),
      'utf8',
    );
    assert.match(html, /{{ \.TokenHash }}/);
    assert.match(html, /href="{{ \.ConfirmationURL }}"/);
    assert.match(html, /name="viewport"/);
    assert.match(html, /lang="ar" dir="rtl"/);
    assert.ok(!/token_hash=[a-f0-9]{20}/i.test(html));
    if (name === 'confirmation') {
      assert.match(html, /Verify Email Address<br/);
      assert.match(html, /تأكيد البريد الإلكتروني/);
    }
  }
});
