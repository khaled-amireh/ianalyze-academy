import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { localTestTarget } from '../scripts/local-test-target.mjs';

test(
  'local captured-email token hashes work across clients, remain single-use, expire and respect resend limits',
  { skip: process.env.RUN_LOCAL_SUPABASE_TESTS !== '1' },
  async (t) => {
    const url = localTestTarget(process.env.LOCAL_SUPABASE_URL);
    const db = postgres(localTestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database'), { max: 1 });
    const key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
    const options = {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        flowType: 'pkce',
        detectSessionInUrl: false,
      },
    };
    const client = () => createClient(url, key, options);
    const admin = createClient(url, process.env.LOCAL_SUPABASE_SECRET_KEY, options);
    const users = [];
    const password = `Local-${randomUUID()}-Aa9!`;
    async function signup(label) {
      const email = `verification-${label}-${randomUUID()}@example.test`;
      const source = client();
      const result = await source.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: 'http://localhost:5173/auth/callback' },
      });
      assert.equal(result.error, null);
      assert.equal(result.data.session, null);
      users.push(result.data.user.id);
      return { email, source, id: result.data.user.id };
    }
    async function tokenLink(email, type, excluded = new Set()) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const messages = await (
          await fetch(
            `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent('to:' + email)}`,
          )
        ).json();
        for (const message of messages.messages ?? []) {
          const id = message.ID ?? message.id;
          if (excluded.has(id)) continue;
          const body = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${id}`)).json();
          const links =
            String(body.HTML ?? '')
              .replaceAll('&amp;', '&')
              .match(/https?:\/\/[^\s"<>]+/g) ?? [];
          for (const href of links) {
            const link = new URL(href);
            if (
              link.origin === 'http://localhost:5173' &&
              link.pathname === '/auth/callback' &&
              link.searchParams.get('type') === type &&
              link.searchParams.has('token_hash')
            )
              return { id, hash: link.searchParams.get('token_hash') };
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error('Expected local bilingual template email was not captured');
    }
    let account;
    try {
      await t.test(
        'confirmation in a fresh client without the original PKCE verifier authenticates a confirmed Student',
        async () => {
          account = await signup('fresh');
          const { hash } = await tokenLink(account.email, 'email');
          const fresh = client();
          assert.equal((await fresh.auth.getSession()).data.session, null);
          const verified = await fresh.auth.verifyOtp({ token_hash: hash, type: 'email' });
          assert.equal(verified.error, null);
          assert.ok(verified.data.session && verified.data.user.email_confirmed_at);
          assert.equal((await fresh.rpc('current_academy_role')).data, 'student');
          const reused = await client().auth.verifyOtp({ token_hash: hash, type: 'email' });
          assert.ok(reused.error);
          assert.equal(reused.data.session, null);
          await fresh.auth.signOut();
        },
      );
      await t.test(
        'expired and invalid hashes cannot authenticate; resending supplies a fresh link with a server-enforced cooldown',
        async () => {
          const expired = await signup('expired');
          const old = await tokenLink(expired.email, 'email');
          await db`update auth.users set confirmation_sent_at=now()-interval '2 hours' where id=${expired.id}`;
          const denied = await client().auth.verifyOtp({ token_hash: old.hash, type: 'email' });
          assert.ok(denied.error);
          assert.equal(denied.data.session, null);
          const invalid = await client().auth.verifyOtp({
            token_hash: 'invalid-local-test-hash',
            type: 'email',
          });
          assert.ok(invalid.error);
          assert.equal(
            (await admin.auth.admin.getUserById(expired.id)).data.user.email_confirmed_at,
            undefined,
          );
          assert.equal(
            (await expired.source.auth.resend({ type: 'signup', email: expired.email })).error,
            null,
          );
          const throttled = await expired.source.auth.resend({
            type: 'signup',
            email: expired.email,
          });
          assert.equal(throttled.error?.status, 429);
          const current = await tokenLink(expired.email, 'email', new Set([old.id]));
          assert.equal(
            (await client().auth.verifyOtp({ token_hash: current.hash, type: 'email' })).error,
            null,
          );
        },
      );
      await t.test(
        'recovery email hash works without the request browser and retains Supabase password rules',
        async () => {
          assert.equal(
            (
              await client().auth.resetPasswordForEmail(account.email, {
                redirectTo: 'http://localhost:5173/auth/callback?flow=recovery',
              })
            ).error,
            null,
          );
          const { hash } = await tokenLink(account.email, 'recovery');
          const fresh = client();
          assert.equal(
            (await fresh.auth.verifyOtp({ token_hash: hash, type: 'recovery' })).error,
            null,
          );
          assert.ok((await fresh.auth.updateUser({ password: 'short' })).error);
          const replacement = `Changed-${randomUUID()}-Aa9!`;
          assert.equal((await fresh.auth.updateUser({ password: replacement })).error, null);
          await fresh.auth.signOut();
          assert.equal(
            (
              await client().auth.signInWithPassword({
                email: account.email,
                password: replacement,
              })
            ).error,
            null,
          );
        },
      );
    } finally {
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
      await db.end();
    }
  },
);
