import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { week1TestTarget } from '../scripts/week1-test-target.mjs';
test(
  'real isolated draft ownership, durable restoration and independent-connection conflicts',
  { skip: process.env.RUN_LOCAL_SUPABASE_TESTS !== '1' },
  async (t) => {
    const url = week1TestTarget(process.env.LOCAL_SUPABASE_URL),
      dbUrl = week1TestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database'),
      opts = { auth: { persistSession: false, autoRefreshToken: false } },
      admin = createClient(url, process.env.LOCAL_SUPABASE_SECRET_KEY, opts),
      users = [],
      conns = [postgres(dbUrl, { max: 1 }), postgres(dbUrl, { max: 1 })];
    t.after(async () => {
      for (const u of users) {
        await u.api.auth.signOut();
        assert.ifError((await admin.auth.admin.deleteUser(u.id)).error);
      }
      await Promise.all(conns.map((c) => c.end()));
    });
    for (let i = 0; i < 2; i++) {
      const credentials = {
        email: `draft-${randomUUID()}@example.test`,
        password: `Local-${randomUUID()}-Aa9!`,
      };
      const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
      assert.ifError(created.error);
      const api = createClient(url, process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY, opts);
      assert.ifError((await api.auth.signInWithPassword(credentials)).error);
      users.push({ id: created.data.user.id, api });
    }
    const [a, b] = users;
    const opened = await a.api.rpc('open_form_draft', {
      p_owner: a.id,
      p_form: 'feedback:test',
      p_base: '0',
    });
    assert.ifError(opened.error);
    assert.equal(opened.data.cache_key.length, 64);
    assert.ok(
      (await b.api.rpc('open_form_draft', { p_owner: a.id, p_form: 'feedback:test', p_base: '0' }))
        .error,
    );
    const pids = await Promise.all(
      conns.map(async (c) => (await c`select pg_backend_pid() as id`)[0].id),
    );
    assert.equal(new Set(pids).size, 2);
    const results = await Promise.allSettled(
      conns.map((c, i) =>
        c.begin(async (tx) => {
          await tx`set local role authenticated`;
          await tx`select set_config('request.jwt.claim.sub',${a.id},true)`;
          await tx`select public.write_form_draft(${a.id},'feedback:test','0',${tx.json({ fields: { feedback: 'Private ' + i }, extra: null, fileSelected: false })},0)`;
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.code, '40001');
    assert.equal((await b.api.from('form_drafts').select('*').eq('owner_id', a.id)).data.length, 0);
    assert.ok(
      (
        await b.api.rpc('write_form_draft', {
          p_owner: a.id,
          p_form: 'feedback:test',
          p_base: '0',
          p_payload: {},
          p_revision: 1,
        })
      ).error,
    );
    const restored = await a.api.rpc('open_form_draft', {
      p_owner: a.id,
      p_form: 'feedback:test',
      p_base: '1',
    });
    assert.ifError(restored.error);
    assert.equal(restored.data.draft.base_version, '0');
    assert.ok(restored.data.draft.payload.fields.feedback.startsWith('Private '));
    assert.ok(
      (
        await a.api.rpc('write_form_draft', {
          p_owner: a.id,
          p_form: 'feedback:test',
          p_base: '0',
          p_payload: { password: 'NEVER SAVE' },
          p_revision: 1,
        })
      ).error,
    );
    assert.ifError(
      (
        await a.api.rpc('write_form_draft', {
          p_owner: a.id,
          p_form: 'feedback:test',
          p_base: '1',
          p_payload: {},
          p_revision: 1,
        })
      ).error,
    );
    assert.deepEqual(
      (await a.api.rpc('open_form_draft', { p_owner: a.id, p_form: 'feedback:test', p_base: '1' }))
        .data.draft.payload,
      {},
    );
  },
);
