import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv } from 'node:crypto';
import {
  checkConsole,
  inspectConsole,
  verifyCompatibility,
} from '../scripts/check-recovery-compatibility.mjs';

function fixture(overrides = {}) {
  const key = Buffer.alloc(32, 7),
    nonce = Buffer.alloc(12, 8);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const payload = Buffer.concat([
    Buffer.from('IAZ1'),
    nonce,
    cipher.update('synthetic only'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const child = {
    status: 0,
    signal: null,
    stdout: key,
    stderr: Buffer.from('DO_NOT_REPORT_RAW_OUTPUT'),
    ...overrides,
  };
  let calls = 0;
  return {
    payload,
    child,
    calls: () => calls,
    options: {
      consoleCheck: () => true,
      load: () => payload,
      spawn: (_exe, _args, options) => {
        calls++;
        assert.equal(options.timeout, 300000);
        assert.deepEqual(options.stdio, ['inherit', 'pipe', 'pipe']);
        return child;
      },
    },
  };
}

test('inaccessible console stops before loading credentials or spawning age', () => {
  const result = verifyCompatibility({
    consoleCheck: () => false,
    load: () => assert.fail(),
    spawn: () => assert.fail(),
  });
  assert.equal(result.stage, 'console');
  assert.equal(result.result, 'FAIL');
  assert.equal(
    checkConsole({
      platform: 'win32',
      streams: { stdin: false, stdout: true, stderr: true },
      open: () => assert.fail(),
    }),
    false,
  );
});
test('console probe checks both Windows console devices without reading input', () => {
  const opened = [],
    closed = [];
  assert.equal(
    checkConsole({
      platform: 'win32',
      streams: { stdin: true, stdout: true, stderr: true },
      open: (name, mode) => {
        assert.equal(mode, 'r+');
        opened.push(name);
        return opened.length;
      },
      close: (fd) => closed.push(fd),
      isTerminal: () => true,
    }),
    true,
  );
  assert.deepEqual(opened, ['\\\\.\\CONIN$', '\\\\.\\CONOUT$']);
  assert.deepEqual(closed, [1, 2]);
});
test('failed console access stops and closes opened handles', () => {
  const closed = [];
  assert.equal(
    checkConsole({
      platform: 'win32',
      streams: { stdin: true, stdout: true, stderr: true },
      open: () => 1,
      close: (fd) => closed.push(fd),
      isTerminal: () => false,
    }),
    false,
  );
  assert.deepEqual(closed, [1]);
  assert.equal(
    checkConsole({
      platform: 'win32',
      streams: { stdin: true, stdout: true, stderr: true },
      open: () => {
        throw Error('private');
      },
    }),
    false,
  );
});

test('metadata rejection stops before decryption and hides exception details', () => {
  const r = verifyCompatibility({
    consoleCheck: () => true,
    load: () => {
      throw new Error('PRIVATE_EXCEPTION');
    },
    spawn: () => assert.fail(),
  });
  assert.equal(r.stage, 'metadata');
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_EXCEPTION/);
});
test('timeout preserves sanitized status with no retry and clears buffers', () => {
  const f = fixture({
    status: null,
    signal: 'SIGTERM',
    error: Object.assign(new Error('PRIVATE_EXCEPTION'), { code: 'ETIMEDOUT' }),
  });
  const r = verifyCompatibility(f.options);
  assert.equal(f.calls(), 1);
  assert.equal(r.executionErrorCode, 'ETIMEDOUT');
  assert.equal(r.terminationSignal, 'SIGTERM');
  assert.equal(r.result, 'FAIL');
  assert.ok(f.child.stdout.every((x) => x === 0));
  assert.ok(f.child.stderr.every((x) => x === 0));
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_EXCEPTION|DO_NOT_REPORT/);
});
test('nonzero age exit is distinguished from execution failure', () => {
  const f = fixture({ status: 1 });
  const r = verifyCompatibility(f.options);
  assert.equal(r.stage, 'age');
  assert.equal(r.childExitStatus, 1);
  assert.equal(r.executionErrorCode, null);
  assert.equal(f.calls(), 1);
});
test('unknown execution codes are redacted', () => {
  const f = fixture({ status: null, error: { code: 'PRIVATE_VALUE', message: 'PRIVATE_VALUE' } });
  const r = verifyCompatibility(f.options);
  assert.equal(r.executionErrorCode, 'OTHER');
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_VALUE/);
});
test('wrong key length and failed authentication are distinct', () => {
  const f = fixture({ stdout: Buffer.alloc(31) });
  assert.equal(verifyCompatibility(f.options).stage, 'key-length');
  const g = fixture();
  g.payload[g.payload.length - 1] ^= 1;
  const r = verifyCompatibility(g.options);
  assert.equal(r.stage, 'aes-gcm');
  assert.equal(r.result, 'FAIL');
});
test('successful mocked recovery authenticates payload and clears held buffers', () => {
  const f = fixture();
  let ticks = 100;
  const r = verifyCompatibility({ ...f.options, now: () => (ticks += 25) });
  assert.equal(r.result, 'PASS');
  assert.equal(r.stage, 'complete');
  assert.equal(r.elapsedMs, 25);
  assert.equal(f.calls(), 1);
  for (const b of [f.payload, f.child.stdout, f.child.stderr]) assert.ok(b.every((x) => x === 0));
});

test('console diagnostics distinguish platform and each redirected stream', () => {
  assert.equal(inspectConsole({ platform: 'linux' }).condition, 'platform');
  for (const name of ['stdin', 'stdout', 'stderr']) {
    const streams = { stdin: true, stdout: true, stderr: true };
    streams[name] = false;
    const r = inspectConsole({ platform: 'win32', streams, open: () => assert.fail() });
    assert.equal(r.ok, false);
    assert.equal(r.condition, name + '-tty');
  }
});
test('console diagnostics identify each open and tty failure with redacted errors', () => {
  for (const label of ['input', 'output'])
    for (const operation of ['open', 'tty']) {
      const closed = [];
      let count = 0;
      const r = inspectConsole({
        platform: 'win32',
        streams: { stdin: true, stdout: true, stderr: true },
        open: () => {
          const current = count++ === 0 ? 'input' : 'output';
          if (current === label && operation === 'open')
            throw Object.assign(Error('DO_NOT_PRINT'), { code: 'ENOENT' });
          return count;
        },
        isTerminal: (fd) => !(operation === 'tty' && fd === (label === 'input' ? 1 : 2)),
        close: (fd) => closed.push(fd),
      });
      assert.equal(r.ok, false);
      assert.equal(r.condition, label + '-' + operation);
      assert.equal(r.executionErrorCode, operation === 'open' ? 'ENOENT' : null);
      assert.doesNotMatch(JSON.stringify(r), /DO_NOT_PRINT/);
      assert.equal(
        closed.length,
        operation === 'open' ? (label === 'input' ? 0 : 1) : label === 'input' ? 1 : 2,
      );
    }
});
test('failed handle cleanup cannot pass and never reveals an unknown error', () => {
  const r = inspectConsole({
    platform: 'win32',
    streams: { stdin: true, stdout: true, stderr: true },
    open: () => 1,
    isTerminal: () => true,
    close: () => {
      throw Object.assign(Error('DO_NOT_PRINT'), { code: 'PRIVATE_CODE' });
    },
  });
  assert.equal(r.ok, false);
  assert.equal(r.condition, 'input-close');
  assert.equal(r.executionErrorCode, 'OTHER');
  assert.doesNotMatch(JSON.stringify(r), /DO_NOT_PRINT|PRIVATE_CODE/);
});
test('verification preserves console diagnostics and stops before credential access', () => {
  const r = verifyCompatibility({
    consoleCheck: () => ({ ok: false, condition: 'input-open', executionErrorCode: 'ENOENT' }),
    load: () => assert.fail(),
    spawn: () => assert.fail(),
  });
  assert.equal(r.result, 'FAIL');
  assert.equal(r.console.condition, 'input-open');
});
