import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, asUser } from '../scripts/database-fixture.mjs';
const A = '00000000-0000-4000-8000-000000000091',
  B = '00000000-0000-4000-8000-000000000092',
  T = '00000000-0000-4000-8000-000000000093';
test('private form drafts enforce owner identity, credential exclusion, revision conflicts and separate encryption keys', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const q = (who, text, params = []) => asUser(db, who, () => db.query(text, params));
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'a@example.test',now()),($2,'b@example.test',now()),($3,'t@example.test',now())",
    [A, B, T],
  );
  await db.query(
    "update app_private.user_roles set role='team',grant_reason='Disposable security fixture' where user_id=$1",
    [T],
  );
  const open = (who, owner = who) =>
    q(who, "select public.open_form_draft($1,'session:3','1') as data", [owner]);
  const a = (await open(A)).rows[0].data,
    b = (await open(B)).rows[0].data;
  assert.notEqual(a.cache_key, b.cache_key);
  assert.equal(a.cache_key.length, 64);
  await assert.rejects(open(B, A), (e) => e.code === '42501');
  await assert.rejects(open(T, A), (e) => e.code === '42501');
  await assert.rejects(
    q(A, 'select * from app_private.form_cache_keys'),
    (e) => e.code === '42501',
  );
  const payload = {
    fields: { feedback: 'PRIVATE DRAFT' },
    extra: { topics: [{ notes: 'PRIVATE ORGANIZER NOTE' }] },
    fileSelected: true,
  };
  assert.equal(
    (
      await q(A, "select public.write_form_draft($1,'session:3','1',$2,0) as revision", [
        A,
        payload,
      ])
    ).rows[0].revision,
    1,
  );
  assert.equal((await q(B, 'select * from public.form_drafts')).rows.length, 1);
  assert.equal((await q(T, 'select * from public.form_drafts')).rows.length, 0);
  assert.equal(
    (await q(B, 'select * from public.form_drafts where owner_id=$1', [A])).rows.length,
    0,
  );
  await assert.rejects(
    q(B, "select public.write_form_draft($1,'session:3','1','{}',1)", [A]),
    (e) => e.code === '42501',
  );
  await assert.rejects(
    q(A, "select public.write_form_draft($1,'session:3','1','{}',0)", [A]),
    (e) => e.code === '40001',
  );
  for (const bad of [
    { password: 'secret' },
    { extra: { access_token: 'secret' } },
    { fields: { authorization: 'secret' } },
  ])
    await assert.rejects(
      q(A, "select public.write_form_draft($1,'session:3','1',$2,1)", [A, bad]),
      (e) => e.code === '22023',
    );
  await assert.rejects(
    q(A, "update public.form_drafts set payload='{}'"),
    (e) => e.code === '42501',
  );
  assert.equal(
    (await q(A, 'select payload from public.form_drafts')).rows[0].payload.fields.feedback,
    'PRIVATE DRAFT',
  );
  await q(A, "select public.write_form_draft($1,'session:3','2','{}',1)", [A]);
  const updated = (await open(A)).rows[0].data;
  assert.equal(updated.draft.base_version, '2');
  assert.deepEqual(updated.draft.payload, {});
  assert.equal(updated.cache_key, a.cache_key);
  assert.equal(
    (await db.query('select count(*)::int as n from public.session_public_content')).rows[0].n,
    0,
  );
});
test('assignment retry identifiers and organizer revisions do not create duplicate assignments', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'t@example.test',now())",
    [T],
  );
  await db.query(
    "update app_private.user_roles set role='team',grant_reason='Disposable fixture' where user_id=$1",
    [T],
  );
  const q = (text, params = []) => asUser(db, T, () => db.query(text, params));
  const now = Date.now(),
    iso = (x) => new Date(now + x).toISOString();
  const config = {
    title_en: 'Retry',
    title_ar: 'Retry',
    publish_at: iso(-1000),
    due_at: iso(3600000),
    phases: [{ name: 'Phase', start: iso(-1000), end: iso(3600000), points: 20 }],
    submission_type: 'link',
    reference_links: '',
    status: 'draft',
    accepting: true,
    archived: false,
    sort_order: 0,
  };
  const request = '00000000-0000-4000-8000-000000000099';
  const first = (await q('select public.save_assignment($1,0,null,$2) as id', [config, request]))
    .rows[0].id;
  assert.equal(
    (await q('select public.save_assignment($1,0,null,$2) as id', [config, request])).rows[0].id,
    first,
  );
  assert.equal((await q('select count(*)::int as n from public.activities')).rows[0].n, 1);
  await assert.rejects(
    q('select public.save_assignment($1,0,null,$2)', [
      { ...config, title_en: 'Different content' },
      request,
    ]),
    (e) => e.code === '40001',
  );
  await q('select public.save_assignment($1,1,$2)', [{ ...config, title_en: 'Edited' }, first]);
  await assert.rejects(
    q('select public.save_assignment($1,1,$2)', [config, first]),
    (e) => e.code === '40001',
  );
});
