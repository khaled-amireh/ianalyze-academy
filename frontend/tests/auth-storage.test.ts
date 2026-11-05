import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createAuthStorage, AUTH_KEY } from '../src/lib/auth-storage.ts';
const store = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
};
test('Remember Me survives a fresh browser session only when checked; migration and restricted storage are safe', () => {
  const local = store(),
    session = store();
  let adapter = createAuthStorage(local, session);
  adapter.setRememberMe(false);
  adapter.storage.setItem(AUTH_KEY, 'session-token');
  assert.equal(local.getItem(AUTH_KEY), null);
  assert.equal(session.getItem(AUTH_KEY), 'session-token');
  assert.equal(createAuthStorage(local, session).storage.getItem(AUTH_KEY), 'session-token');
  assert.equal(createAuthStorage(local, store()).storage.getItem(AUTH_KEY), null);
  adapter.setRememberMe(true);
  assert.equal(session.getItem(AUTH_KEY), null);
  adapter = createAuthStorage(local, store());
  assert.equal(adapter.storage.getItem(AUTH_KEY), 'session-token');
  adapter.setRememberMe(false);
  assert.equal(local.getItem(AUTH_KEY), null);
  adapter.storage.removeItem(AUTH_KEY);
  assert.equal(adapter.storage.getItem(AUTH_KEY), null);
  const blocked = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  const memory = createAuthStorage(blocked, blocked);
  memory.setRememberMe(false);
  memory.storage.setItem(AUTH_KEY, 'memory');
  assert.equal(memory.storage.getItem(AUTH_KEY), 'memory');
  memory.storage.removeItem(AUTH_KEY);
  assert.equal(memory.storage.getItem(AUTH_KEY), null);
  const legacy = store();
  legacy.setItem(AUTH_KEY, 'existing-session');
  assert.equal(createAuthStorage(legacy, store()).storage.getItem(AUTH_KEY), 'existing-session');
});
test('actual Supabase SDK signs in, restores and signs out using the selected storage without storing passwords', async () => {
  for (const remember of [false, true]) {
    const local = store(),
      session = store(),
      persistence = createAuthStorage(local, session);
    persistence.setRememberMe(remember);
    const user = {
      id: '00000000-0000-4000-8000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'local@example.test',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: new Date().toISOString(),
    };
    const token = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      user,
    };
    const requests: string[] = [];
    const fetcher: typeof fetch = async (url, init) => {
      requests.push(String(url));
      if (String(url).includes('/token?grant_type=password')) {
        assert.equal(JSON.parse(String(init?.body)).password, 'Only-sent-to-auth');
        return new Response(JSON.stringify(token), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(url).endsWith('/user'))
        return new Response(JSON.stringify(user), {
          headers: { 'Content-Type': 'application/json' },
        });
      if (String(url).includes('/logout')) return new Response(null, { status: 204 });
      throw Error('Unexpected SDK request');
    };
    const make = (storage: ReturnType<typeof createAuthStorage>) =>
      createClient('http://localhost:54321', 'local-test-key', {
        auth: {
          storageKey: AUTH_KEY,
          storage: storage.storage,
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { fetch: fetcher },
      });
    const first = make(persistence);
    assert.equal(
      (await first.auth.signInWithPassword({ email: user.email, password: 'Only-sent-to-auth' }))
        .error,
      null,
    );
    assert.ok(!(persistence.storage.getItem(AUTH_KEY) ?? '').includes('Only-sent-to-auth'));
    const restored = make(createAuthStorage(local, session));
    assert.equal((await restored.auth.getSession()).data.session?.user.id, user.id);
    const restarted = make(createAuthStorage(local, store()));
    assert.equal(Boolean((await restarted.auth.getSession()).data.session), remember);
    await restored.auth.signOut({ scope: 'local' });
    assert.equal((await restored.auth.getSession()).data.session, null);
    assert.equal(local.getItem(AUTH_KEY), null);
    assert.equal(session.getItem(AUTH_KEY), null);
    assert.equal(
      persistence.storage.getItem(AUTH_KEY),
      null,
      'Another client logout cannot revive a cached token',
    );
    assert.ok(requests.some((x) => x.includes('/logout')));
    for (const c of [first, restored, restarted]) await c.auth.stopAutoRefresh();
  }
});
