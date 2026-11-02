import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { saveAcademyProfile } from '../src/lib/academy-data.ts';
import { localTestTarget } from '../scripts/local-test-target.mjs';
describe(
  'confirmed registration persistence without replacing the existing session or role',
  { skip: process.env.RUN_LOCAL_SUPABASE_TESTS !== '1' },
  () => {
    let admin, db, url, key, student, team;
    const users = [];
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const patch = {
      full_name: 'LOCAL REGISTRATION TEST',
      whatsapp: '+962790000001',
      major: 'AI',
      academic_year: 4,
      python_experience: 'basic',
      locale: 'en',
    };
    async function account(label) {
      const email = `registration-${label}-${randomUUID()}@example.test`,
        password = `Local-${randomUUID()}-Aa9!`;
      const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(result.error, null);
      users.push(result.data.user.id);
      const client = createClient(url, key, options);
      assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
      return { client, id: result.data.user.id, email, password };
    }
    before(async () => {
      url = localTestTarget(process.env.LOCAL_SUPABASE_URL);
      db = postgres(localTestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database'), { max: 1 });
      key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
      admin = createClient(url, process.env.LOCAL_SUPABASE_SECRET_KEY, options);
      student = await account('student');
      team = await account('team');
      await db`update app_private.user_roles set role='team',grant_reason='LOCAL registration role-preservation test' where user_id=${team.id}`;
    });
    it('awaits persisted consent/profile and keeps the same Student session through refresh', async () => {
      const before = (await student.client.auth.getSession()).data.session;
      const saved = await saveAcademyProfile(student.client, patch, true);
      assert.equal(saved.id, student.id);
      assert.ok(saved.registered_at && saved.consent_at);
      assert.equal(saved.consent_version, 'registration-v1');
      assert.equal(saved.full_name, patch.full_name);
      const after = (await student.client.auth.getSession()).data.session;
      assert.ok(
        after.access_token === before.access_token,
        'Registration retains the existing Auth session',
      );
      assert.equal((await student.client.rpc('current_academy_role')).data, 'student');
      assert.equal((await student.client.auth.refreshSession()).error, null);
      assert.equal((await student.client.auth.getUser()).data.user.id, student.id);
    });
    it('retries registration idempotently without duplicate profiles or replaced timestamps', async () => {
      const first = await saveAcademyProfile(student.client, patch, true);
      const again = await saveAcademyProfile(student.client, patch, true);
      assert.equal(again.registered_at, first.registered_at);
      assert.equal(again.consent_at, first.consent_at);
      assert.equal(
        Number((await db`select count(*) as n from public.profiles where id=${student.id}`)[0].n),
        1,
      );
    });
    it('Leader/Organizer Team registration keeps the existing Team assignment and session', async () => {
      const before = (await team.client.auth.getSession()).data.session;
      const profile = await saveAcademyProfile(team.client, patch, true);
      assert.ok(profile.registered_at);
      assert.equal((await team.client.rpc('current_academy_role')).data, 'team');
      assert.ok(
        (await team.client.auth.getSession()).data.session.access_token === before.access_token,
        'Team registration retains the existing Auth session',
      );
      assert.equal(
        (await team.client.from('profiles').select('id').eq('id', student.id)).data.length,
        1,
      );
    });
    it('invalid data and an ended session cannot complete registration or update roles', async () => {
      const invalid = await account('invalid');
      await assert.rejects(() =>
        saveAcademyProfile(invalid.client, { ...patch, whatsapp: 'invalid' }, true),
      );
      assert.equal(
        (await db`select registered_at from public.profiles where id=${invalid.id}`)[0]
          .registered_at,
        null,
      );
      await invalid.client.auth.signOut();
      await assert.rejects(() => saveAcademyProfile(invalid.client, patch, true));
      assert.equal(
        (await db`select role from app_private.user_roles where user_id=${invalid.id}`)[0].role,
        'student',
      );
    });
    after(async () => {
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
      await db?.end();
    });
  },
);
