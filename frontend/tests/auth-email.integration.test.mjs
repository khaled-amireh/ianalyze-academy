import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localTestTarget } from '../scripts/local-test-target.mjs';

test(
  'real local captured email: signup confirmation, PKCE login, recovery and logout',
  { skip: process.env.RUN_LOCAL_SUPABASE_TESTS !== '1' },
  async () => {
    const url = localTestTarget(process.env.LOCAL_SUPABASE_URL);
    localTestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database');
    const key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY,
      secret = process.env.LOCAL_SUPABASE_SECRET_KEY;
    assert.ok(key && secret);
    const options = {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        flowType: 'pkce',
        detectSessionInUrl: false,
      },
    };
    const client = createClient(url, key, options),
      admin = createClient(url, secret, options);
    const email = `email-journey-${randomUUID()}@example.test`,
      password = `Local-${randomUUID()}-Aa9!`;
    let userId;
    async function emailLink(type) {
      for (let i = 0; i < 40; i++) {
        const result = await (
          await fetch(
            `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
          )
        ).json();
        for (const message of result.messages ?? []) {
          const body = await (
            await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID ?? message.id}`)
          ).json();
          const text = String(body.HTML ?? body.Text ?? '').replaceAll('&amp;', '&');
          const links = text.match(/https?:\/\/[^\s"<>]+/g) ?? [];
          const link = links.find((link) => {
            try {
              const p = new URL(link);
              return (
                p.origin === url &&
                p.pathname === '/auth/v1/verify' &&
                p.searchParams.get('type') === type
              );
            } catch {
              return false;
            }
          });
          if (link) return link;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`No captured ${type} email arrived`);
    }
    async function exchange(link, recovery = false) {
      const response = await fetch(link, { redirect: 'manual' });
      assert.equal(response.status, 303);
      const location = new URL(response.headers.get('location'));
      assert.equal(location.origin, 'http://localhost:5173');
      assert.equal(location.pathname, '/auth/callback');
      if (recovery) assert.equal(location.searchParams.get('flow'), 'recovery');
      const code = location.searchParams.get('code');
      assert.ok(code, 'Expected PKCE code');
      assert.equal((await client.auth.exchangeCodeForSession(code)).error, null);
    }
    try {
      const signup = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: 'http://localhost:5173/auth/callback' },
      });
      assert.equal(signup.error, null);
      assert.ok(signup.data.user);
      userId = signup.data.user.id;
      assert.equal(signup.data.session, null);
      assert.ok((await client.auth.signInWithPassword({ email, password })).error);
      await exchange(await emailLink('signup'));
      assert.ok((await client.auth.getUser()).data.user.email_confirmed_at);
      assert.equal((await client.rpc('current_academy_role')).data, 'student');
      await client.auth.signOut({ scope: 'local' });
      await new Promise((resolve) => setTimeout(resolve, 1100));
      assert.equal(
        (
          await client.auth.resetPasswordForEmail(email, {
            redirectTo: 'http://localhost:5173/auth/callback?flow=recovery',
          })
        ).error,
        null,
      );
      await exchange(await emailLink('recovery'), true);
      const replacement = `Changed-${randomUUID()}-Aa9!`;
      assert.equal((await client.auth.updateUser({ password: replacement })).error, null);
      assert.equal((await client.auth.signOut({ scope: 'local' })).error, null);
      assert.ok((await client.auth.signInWithPassword({ email, password })).error);
      assert.equal(
        (await client.auth.signInWithPassword({ email, password: replacement })).error,
        null,
      );
      assert.equal((await client.auth.signOut({ scope: 'local' })).error, null);
      assert.equal((await client.auth.getSession()).data.session, null);
    } finally {
      if (userId) assert.equal((await admin.auth.admin.deleteUser(userId)).error, null);
    }
  },
);
