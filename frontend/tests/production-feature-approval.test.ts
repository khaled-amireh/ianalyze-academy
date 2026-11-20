import test from 'node:test';
import assert from 'node:assert/strict';
import { productionFeatures } from '../scripts/production-feature-approval.mjs';
import { createDatabase, asUser } from '../scripts/database-fixture.mjs';
import { randomUUID } from 'node:crypto';

test('student feature approvals default closed and ignore direct Vite/server flags', () => {
  assert.deepEqual(productionFeatures({}, true), { submissions: false, leaderboard: false });
  assert.deepEqual(
    productionFeatures(
      {
        VITE_ENABLE_SUBMISSIONS: 'true',
        VITE_ENABLE_LEADERBOARD: 'true',
        ACADEMY_UPLOADS_ENABLED: 'true',
      },
      true,
    ),
    { submissions: false, leaderboard: false },
  );
});

test('independent explicit approvals produce the exact intended configuration', () => {
  for (const submissions of [false, true])
    for (const leaderboard of [false, true])
      assert.deepEqual(
        productionFeatures(
          {
            ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED: String(submissions),
            ACADEMY_LEADERBOARD_APPROVED: String(leaderboard),
          },
          true,
        ),
        { submissions, leaderboard },
      );
});

test('enabling either feature requires the existing approved registration prerequisite', () => {
  for (const key of ['ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED', 'ACADEMY_LEADERBOARD_APPROVED'])
    for (const registration of [false, undefined, 'true'])
      assert.throws(() => productionFeatures({ [key]: 'true' }, registration));
  assert.deepEqual(productionFeatures({}, false), { submissions: false, leaderboard: false });
});

test('malformed approval input fails closed rather than being treated as authorization', () => {
  for (const key of ['ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED', 'ACADEMY_LEADERBOARD_APPROVED'])
    for (const value of ['', 'TRUE', '1', ' true', 'true ', true, false, null])
      assert.throws(() => productionFeatures({ [key]: value }, true));
});

test('rankings include every eligible zero-point student and exclude incomplete, unverified and Team profiles', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  // This database is in-memory only. No production connection or award is used.
  const eligible: { id: string; alias: string }[] = [];
  for (let i = 0; i < 29; i++) {
    const id = randomUUID();
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      id,
      `launch-fixture-${i}@example.test`,
    ]);
    await db.query(
      "update public.profiles set full_name='PRIVATE CONTACT',whatsapp='+962790000001',university='Other',major='AI',academic_year=2,python_experience='none',leaderboard_alias=$2 where id=$1",
      [id, `Launch learner ${i}`],
    );
    if (i !== 26)
      await asUser(db, id, () =>
        db.query("select public.complete_registration('registration-v1')"),
      );
    if (i === 27) await db.query('update auth.users set email_confirmed_at=null where id=$1', [id]);
    if (i === 28)
      await db.query(
        "update app_private.user_roles set role='team',grant_reason='ISOLATED TEST ONLY' where user_id=$1",
        [id],
      );
    if (i < 26) eligible.push({ id, alias: `Launch learner ${i}` });
  }
  for (const view of ['all', 'current']) {
    const packet = (await db.query('select public.academy_rankings($1,null) packet', [view]))
      .rows[0].packet;
    assert.equal(packet.rows.length, 26);
    assert.ok(packet.rows.every((row) => Number(row.points) === 0 && Number(row.activities) === 0));
    assert.deepEqual(
      packet.rows.map((row) => row.alias),
      [...eligible].sort((a, b) => a.id.localeCompare(b.id)).map((row) => row.alias),
    );
    assert.deepEqual(
      packet.rows.map((row) => Number(row.rank)),
      Array.from({ length: 26 }, (_, i) => i + 1),
    );
    const publicData = JSON.stringify(packet.rows);
    for (const privateValue of [
      'PRIVATE CONTACT',
      '+962790000001',
      '@example.test',
      ...eligible.map((row) => row.id),
    ])
      assert.ok(!publicData.includes(privateValue));
  }
  assert.equal(Number((await db.query('select count(*) n from public.point_awards')).rows[0].n), 0);
  assert.equal(
    (await db.query('select app_private.uploads_enabled() enabled')).rows[0].enabled,
    false,
  );
});
