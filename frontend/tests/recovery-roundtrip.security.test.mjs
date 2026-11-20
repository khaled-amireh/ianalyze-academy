import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createCipheriv, createDecipheriv, createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createDatabase, asUser } from '../scripts/database-fixture.mjs';

test('synthetic encrypted embedded recovery restores consent, audit, roles and append-only award ledger', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const admin = randomUUID(),
    student = randomUUID();
  for (const id of [admin, student]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      id,
      `${id}@example.test`,
    ]);
    await db.query(
      "update public.profiles set full_name='Recovery Fixture',whatsapp='+962790000001',major='Data',academic_year=2,python_experience='basic',locale='en',university='Other' where id=$1",
      [id],
    );
    await asUser(db, id, () => db.query("select public.complete_registration('registration-v1')"));
  }
  await db.query(
    "insert into app_private.application_admins(user_id,grant_reason) values($1,'isolated recovery fixture')",
    [admin],
  );
  await asUser(db, student, () => db.query('select public.set_public_full_name_consent(true)'));
  await asUser(db, admin, () =>
    db.query('select public.admin_award_points($1,42,$2,$3)', [
      student,
      'recovery fixture',
      randomUUID(),
    ]),
  );
  const snapshot = async (connection) => {
    const tables = (
      await connection.query(
        "select schemaname,tablename from pg_tables where schemaname in ('public','app_private','auth','storage') order by 1,2",
      )
    ).rows;
    const result = {};
    for (const table of tables) {
      const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
      const rows = (
        await connection.query(
          `select to_jsonb(t)::text row from ${quote(table.schemaname)}.${quote(table.tablename)} t order by 1`,
        )
      ).rows;
      result[table.schemaname + '.' + table.tablename] = createHash('sha256')
        .update(JSON.stringify(rows))
        .digest('hex');
    }
    return result;
  };
  const before = await snapshot(db),
    dump = Buffer.from(await (await db.dumpDataDir()).arrayBuffer());
  const key = randomBytes(32),
    iv = randomBytes(12);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(dump), cipher.final()]),
      tag = cipher.getAuthTag();
    const decrypt = (bytes) => {
      const d = createDecipheriv('aes-256-gcm', key, iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(bytes), d.final()]);
    };
    const damaged = Buffer.from(encrypted);
    damaged[0] ^= 1;
    assert.throws(() => decrypt(damaged));
    const plain = decrypt(encrypted);
    const restored = new PGlite({ loadDataDir: new Blob([plain]) });
    t.after(() => restored.close());
    assert.deepEqual(await snapshot(restored), before);
    assert.equal(
      (
        await asUser(restored, admin, () =>
          restored.query('select public.current_academy_is_admin() admin'),
        )
      ).rows[0].admin,
      true,
    );
    await assert.rejects(() =>
      restored.query("update app_private.manual_point_awards set reason='tamper'"),
    );
    plain.fill(0);
  } finally {
    key.fill(0);
    dump.fill(0);
  }
});
