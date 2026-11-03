import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmailExchangeDeduplicator,
  readEmailCallback,
} from '../src/features/auth/email-callback.ts';

test('StrictMode shares an in-flight exchange; a later used-link attempt goes back to Auth instead of replaying success', async () => {
  const once = createEmailExchangeDeduplicator();
  let calls = 0;
  let release!: (value: boolean) => void;
  const pending = new Promise<boolean>((resolve) => {
    release = resolve;
  });
  const exchange = () => {
    calls++;
    return pending;
  };
  const a = once('local-single-use-code', exchange);
  const b = once('local-single-use-code', exchange);
  assert.equal(a, b);
  await Promise.resolve();
  assert.equal(calls, 1);
  release(true);
  assert.equal(await a, true);
  assert.equal(
    await once('local-single-use-code', async () => {
      calls++;
      return false;
    }),
    false,
  );
  assert.equal(calls, 2);
  assert.equal(
    await once('local-retry', async () => {
      throw new Error('local unavailable');
    }),
    false,
  );
  assert.equal(await once('local-retry', async () => true), true);
});

test('email callbacks accept PKCE and generated hashes for signup/email/recovery, with fixed local destinations', () => {
  assert.deepEqual(readEmailCallback('?code=local-code', ''), {
    kind: 'code',
    code: 'local-code',
    recovery: false,
  });
  assert.deepEqual(readEmailCallback('?code=local-code&flow=recovery', ''), {
    kind: 'code',
    code: 'local-code',
    recovery: true,
  });
  for (const type of ['email', 'signup', 'recovery'])
    assert.deepEqual(
      readEmailCallback(`?token_hash=local-hash&type=${type}&next=https://evil.invalid`, ''),
      { kind: 'token', tokenHash: 'local-hash', type, recovery: type === 'recovery' },
    );
});
test('ambiguous, missing, errored or unsupported email callback credentials fail closed', () => {
  for (const query of [
    '',
    '?code=',
    '?token_hash=x',
    '?token_hash=x&type=invite',
    '?code=a&token_hash=b&type=email',
    '?code=a&code=b',
    '?token_hash=a&type=email&type=recovery',
    '?code=a&error=denied',
    '?code=a&type=recovery',
  ])
    assert.deepEqual(readEmailCallback(query, ''), { kind: 'invalid' }, query);
  assert.deepEqual(readEmailCallback('?code=a', '#error_code=otp_expired'), { kind: 'invalid' });
  assert.deepEqual(readEmailCallback('', '#access_token=untrusted&refresh_token=untrusted'), {
    kind: 'legacy',
  });
});
