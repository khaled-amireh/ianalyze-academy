import test from 'node:test';
import assert from 'node:assert/strict';
import { readSupabaseConfiguration } from '../src/lib/supabase-config.ts';
import {
  createAuthStore,
  permitsRole,
  type AuthPort,
  type SessionIdentity,
} from '../src/features/auth/auth-store.ts';
import { localTestTarget } from '../scripts/local-test-target.mjs';

test('integration harness refuses hosted URLs, alternative ports and URL injection before networking', () => {
  assert.equal(localTestTarget('http://127.0.0.1:54321'), 'http://127.0.0.1:54321');
  assert.doesNotThrow(() =>
    localTestTarget('postgresql://local:fixture@localhost:54322/postgres', 'database'),
  );
  for (const value of [
    'https://example.supabase.co',
    'http://localhost:54322',
    'http://localhost:54321@remote.example',
    'http://localhost:54321/?host=remote',
    'http://localhost:54321/auth',
  ])
    assert.throws(() => localTestTarget(value));
  assert.throws(() =>
    localTestTarget('postgresql://local:fixture@db.example:54322/postgres', 'database'),
  );
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
test('subscription initialization errors deny access without crashing the public application', () => {
  const store = createAuthStore(
    port({
      onSession: () => {
        throw new Error('Unavailable');
      },
    }),
  );
  let stop = () => {};
  assert.doesNotThrow(() => {
    stop = store.start();
  });
  assert.equal(store.getSnapshot().status, 'error');
  assert.equal(permitsRole(store.getSnapshot(), ['team']), false);
  stop();
});
function port(overrides: Partial<AuthPort> = {}): AuthPort {
  return {
    getSession: async () => ({ userId: 'a' }),
    getVerifiedUser: async () => ({ id: 'a', email: 'student@example.test', confirmed: true }),
    getRole: async () => 'student',
    onSession: () => () => {},
    signOut: async () => {},
    ...overrides,
  };
}
test('configuration allows public/local URLs and publishable keys; rejects privileged/partial/unsafe configuration', () => {
  const key = 'sb_publishable_TEST_ONLY';
  assert.equal(readSupabaseConfiguration({}).status, 'unconfigured');
  for (const url of ['https://example.supabase.co', 'http://127.0.0.1:54321'])
    assert.equal(
      readSupabaseConfiguration({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key })
        .status,
      'configured',
    );
  for (const url of [
    'http://remote.example',
    'https://user:password@example.supabase.co',
    'https://example.supabase.co/?key=value',
    'not-a-url',
  ])
    assert.equal(
      readSupabaseConfiguration({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key })
        .status,
      'invalid',
    );
  assert.equal(
    readSupabaseConfiguration({ VITE_SUPABASE_URL: 'https://example.supabase.co' }).status,
    'invalid',
  );
  for (const key of ['sb_secret_TEST_ONLY', 'service_role', 'eyJ_TEST_ONLY'])
    assert.equal(
      readSupabaseConfiguration({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: key,
      }).status,
      'invalid',
    );
});
test('unconfigured authentication remains inert and denies protected presentation', async () => {
  const store = createAuthStore(null);
  const stop = store.start();
  await store.refresh();
  assert.equal(store.getSnapshot().status, 'unconfigured');
  assert.equal(permitsRole(store.getSnapshot(), ['student', 'team']), false);
  stop();
});
test('restoration requires verified identity and authoritative supported role', async () => {
  const store = createAuthStore(port());
  const stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().status, 'signed-in');
  assert.equal(permitsRole(store.getSnapshot(), ['student']), true);
  assert.equal(permitsRole(store.getSnapshot(), ['team']), false);
  stop();
  for (const overrides of [
    { getRole: async () => 'admin' },
    { getRole: async () => null },
    { getVerifiedUser: async () => ({ id: 'a', email: null, confirmed: false }) },
    { getVerifiedUser: async () => ({ id: 'b', email: null, confirmed: true }) },
    {
      getVerifiedUser: async () => {
        throw new Error('Network unavailable');
      },
    },
  ]) {
    const store = createAuthStore(port(overrides));
    const stop = store.start();
    await tick();
    assert.equal(store.getSnapshot().status, 'error');
    assert.equal(store.getSnapshot().role, null);
    stop();
  }
});
test('stale role resolution cannot restore access after logout', async () => {
  let release: (role: string) => void = () => {};
  const pending = new Promise<string>((resolve) => {
    release = resolve;
  });
  const store = createAuthStore(port({ getRole: () => pending }));
  const stop = store.start();
  await tick();
  await store.signOut();
  release('team');
  await tick();
  assert.equal(store.getSnapshot().status, 'signed-out');
  assert.equal(store.getSnapshot().role, null);
  stop();
});
test('auth events clear old privileges before verification and refresh reflects revocation', async () => {
  let listener: (session: SessionIdentity | null) => void = () => {};
  let role = 'team';
  let unsubscribed = false;
  const store = createAuthStore(
    port({
      getRole: async () => role,
      onSession: (fn) => {
        listener = fn;
        return () => {
          unsubscribed = true;
        };
      },
    }),
  );
  const stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().role, 'team');
  role = 'student';
  listener({ userId: 'a' });
  assert.equal(store.getSnapshot().role, null);
  await tick();
  assert.equal(store.getSnapshot().role, 'student');
  listener(null);
  assert.equal(store.getSnapshot().status, 'signed-out');
  stop();
  assert.equal(unsubscribed, true);
});
test('session and logout errors fail closed without leaking transport details', async () => {
  const store = createAuthStore(
    port({
      getSession: async () => {
        throw new Error('Sensitive transport details');
      },
      signOut: async () => {
        throw new Error('Sensitive transport details');
      },
    }),
  );
  const stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().error, 'session_unavailable');
  await store.signOut();
  assert.equal(store.getSnapshot().error, 'signout_failed');
  assert.equal(permitsRole(store.getSnapshot(), ['team']), false);
  stop();
});
