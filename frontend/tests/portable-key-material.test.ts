import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  createHash,
  createCipheriv,
  generateKeyPairSync,
  publicEncrypt,
  privateDecrypt,
} from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { execFileSync } from 'node:child_process';
import {
  identityForRecovery,
  referenceIdentity,
  wrapBackupKey,
  recoverBackupKey,
  openPayload,
  safeFailure,
} from '../artifacts/week1-isolated/portable-key-material.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const root = new URL('../artifacts/week1-isolated/', import.meta.url);
function identityFixture() {
  const directory = resolve('synthetic-vault');
  const encrypted = Buffer.from('-----BEGIN AGE ENCRYPTED FILE-----\nsynthetic identity only');
  const recipient = Buffer.from('age1syntheticrecipient\n');
  const metadata = {
    privateIdentityEncrypted: true,
    identitySha256: sha(encrypted),
    recipientFileSha256: sha(recipient),
    publicRecipient: recipient.toString().trim(),
  };
  const files = new Map([
    [join(directory, 'age-identity.age'), encrypted],
    [join(directory, 'age-recipient.txt'), recipient],
    [join(directory, 'recovery-metadata.json'), Buffer.from(JSON.stringify(metadata))],
  ]);
  const read = (p, encoding) => {
    assert.ok(files.has(p));
    const b = Buffer.from(files.get(p));
    return encoding ? b.toString(encoding) : b;
  };
  return { directory, files, read };
}

test('existing identity is validated and referenced in place without write/copy/generation', () => {
  const f = identityFixture();
  const before = [...f.files].map(([p, b]) => [p, Buffer.from(b)]);
  const result = referenceIdentity(f.directory, { read: f.read });
  assert.equal(result.identityPath, join(f.directory, 'age-identity.age'));
  assert.equal(result.recipient, 'age1syntheticrecipient');
  assert.deepEqual([...f.files], before);
  assert.throws(() => referenceIdentity('', { read: () => assert.fail() }));
});
test('wrong identity or recipient metadata fails closed', () => {
  for (const name of ['age-identity.age', 'age-recipient.txt']) {
    const f = identityFixture();
    f.files.set(join(f.directory, name), Buffer.from('wrong synthetic material'));
    assert.throws(() => referenceIdentity(f.directory, { read: f.read }));
  }
});
test('new synthetic AES key is wrapped, recovered and authenticates a payload; historical key is not reused', () => {
  // RSA is only the synthetic subprocess adapter; no claim of testing the age format/CLI.
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = Buffer.alloc(32, 19),
    expected = Buffer.from(key),
    historical = Buffer.alloc(32, 11);
  let wrapped;
  wrapBackupKey('mock-age', 'age1syntheticrecipient', 'fresh-wrapped.age', key, {
    exists: () => false,
    exec: (_exe, args, opts) => {
      assert.deepEqual(args, ['-r', 'age1syntheticrecipient', '-a', '-o', 'fresh-wrapped.age']);
      assert.deepEqual(opts.input, expected);
      assert.notDeepEqual(opts.input, historical);
      wrapped = publicEncrypt(publicKey, opts.input);
      return Buffer.alloc(0);
    },
  });
  assert.ok(key.every((b) => b === 0));
  const recovered = recoverBackupKey('mock-age', 'external-identity.age', 'fresh-wrapped.age', {
    exec: (_exe, args, opts) => {
      assert.deepEqual(args, ['-d', '-i', 'external-identity.age', '-o', '-', 'fresh-wrapped.age']);
      assert.deepEqual(opts.stdio, ['inherit', 'pipe', 'pipe']);
      return privateDecrypt(privateKey, wrapped);
    },
  });
  assert.deepEqual(recovered, expected);
  const plaintext = Buffer.from('synthetic database recovery payload');
  const nonce = Buffer.alloc(12, 5),
    cipher = createCipheriv('aes-256-gcm', expected, nonce);
  const bytes = Buffer.concat([
    Buffer.from('IAZ1'),
    nonce,
    cipher.update(plaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const meta = { sha256: sha(bytes), plaintextSha256: sha(plaintext) };
  const opened = openPayload(recovered, bytes, meta);
  assert.deepEqual(opened, plaintext);
  assert.throws(() => openPayload(historical, bytes, meta), /PAYLOAD_AUTHENTICATION_FAILED/);
  opened.fill(0);
  recovered.fill(0);
  expected.fill(0);
  plaintext.fill(0);
  historical.fill(0);
});
test('incorrect identity authentication and malformed recovered key fail with no raw diagnostics', () => {
  const stderr = Buffer.from('PRIVATE_ERROR_DATA'),
    stdout = Buffer.from('PRIVATE_KEY_DATA');
  assert.throws(
    () =>
      recoverBackupKey('mock', 'wrong', 'wrapped', {
        exec: () => {
          throw Object.assign(Error('PRIVATE_EXCEPTION'), { stderr, stdout, code: 'PRIVATE_CODE' });
        },
      }),
    /KEY_RECOVERY_FAILED/,
  );
  assert.ok(stderr.every((x) => x === 0));
  assert.ok(stdout.every((x) => x === 0));
  const short = Buffer.alloc(31, 5);
  assert.throws(() => recoverBackupKey('mock', 'identity', 'wrapped', { exec: () => short }));
  assert.ok(short.every((x) => x === 0));
});
test('wrapping refuses old output files and wipes keys even when wrapping fails', () => {
  const key = Buffer.alloc(32, 4);
  assert.throws(() =>
    wrapBackupKey('mock', 'age1synthetic', 'existing.age', key, {
      exists: () => true,
      exec: () => assert.fail(),
    }),
  );
  assert.ok(key.every((x) => x === 0));
});
test('historical co-located identity path remains supported and external override is explicit', () => {
  assert.equal(identityForRecovery('historical'), join('historical', 'age-identity.age'));
  assert.equal(identityForRecovery('fresh', 'external.age'), resolve('external.age'));
});
test('sanitizer never copies arbitrary exception codes/messages/stderr', () => {
  const e = Object.assign(Error('PRIVATE_EXCEPTION'), {
    code: 'PRIVATE_CODE',
    stderr: Buffer.from('PRIVATE_STDERR'),
    output: { not: 'iterable' },
  });
  const r = safeFailure(e, 'restore');
  assert.equal(r.failureCode, 'RECOVERY_CHECK_FAILED');
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE/);
  assert.ok(e.stderr.every((x) => x === 0));
  assert.equal(safeFailure({ code: 'ETIMEDOUT' }, 'restore').failureCode, 'ETIMEDOUT');
});
test('preparation normal path has no identity generation/copy and wires external reference into verifier/package', () => {
  const source = readFileSync(new URL('prepare-portable-recovery.mjs', root), 'utf8');
  const main = source.slice(source.indexOf('  const checkRetryStateOnly'));
  assert.match(main, /referenceIdentity\(source\)/);
  assert.match(main, /wrapBackupKey\(age, recipient, wrappedKeyPath, rawBackupKey\)/);
  assert.match(main, /\[portableVerifier, inputDir, recoveryDir, identityPath\]/);
  assert.doesNotMatch(
    main,
    /spawnSync\(ageKeygen|writeFileSync\(identityPath|copyFileSync\([^\n]*identity/i,
  );
  assert.match(main, /identityMode: 'external'/);
  assert.match(main, /portable-key-material\.mjs/);
  assert.match(main, /key\\\.dpapi\|age-identity\\\.age/);
});
test('isolated verifier catches even initialization errors without printing raw exception data', async () => {
  const source = readFileSync(new URL('verify-fresh-production-backup.mjs', root), 'utf8');
  const stripped = source.replace(/import\s*[^;]+;/g, '');
  const logs = [];
  runInNewContext(stripped, {
    readFileSync: () => {
      throw Object.assign(Error('PRIVATE_EXCEPTION'), {
        stderr: Buffer.from('PRIVATE_STDERR'),
        code: 'PRIVATE_CODE',
      });
    },
    safeFailure,
    console: { log: (x) => logs.push(x) },
    process: { exitCode: 0 },
    Date,
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(logs.length, 1);
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE/);
  assert.match(JSON.stringify(logs), /RECOVERY_CHECK_FAILED/);
  assert.doesNotMatch(
    source,
    /console\.log\(\{bootstrapDiagnostic|safeSummary:.*e\.message|failureSummary=.*e\.message/,
  );
});

test('timeout diagnostics survive sanitized rethrow and outer proof serialization', () => {
  let ticks = 0,
    calls = 0;
  const privateOutput = Buffer.from('SYNTHETIC_PRIVATE_OUTPUT');
  let captured;
  try {
    recoverBackupKey('mock-age', 'synthetic-identity', 'synthetic-wrapped', {
      now: () => {
        const value = ticks;
        ticks += 180009;
        return value;
      },
      exec: () => {
        calls++;
        throw Object.assign(Error('SYNTHETIC_PRIVATE_EXCEPTION'), {
          code: 'ETIMEDOUT',
          status: null,
          signal: 'SIGTERM',
          stdout: privateOutput,
          stderr: Buffer.from('SYNTHETIC_PRIVATE_STDERR'),
        });
      },
      onDiagnostics: (d) => {
        captured = d;
      },
    });
    assert.fail('Expected failure');
  } catch (error) {
    const proof = safeFailure(error, 'portable-key-recovery');
    assert.equal(proof.keyRecoveryDiagnostics, captured);
    assert.deepEqual(proof.keyRecoveryDiagnostics, {
      stage: 'age-exec',
      result: 'FAIL',
      elapsedMs: 180009,
      childExitStatus: null,
      terminationSignal: 'SIGTERM',
      executionErrorCode: 'ETIMEDOUT',
    });
    assert.doesNotMatch(JSON.stringify(proof), /SYNTHETIC_PRIVATE/);
    assert.equal(error.cause, undefined);
  }
  assert.equal(calls, 1);
  assert.ok(privateOutput.every((x) => x === 0));
});

test('harmless Node subprocess timeout reproduces real execFileSync timeout without age or credential IO', () => {
  let calls = 0;
  try {
    recoverBackupKey('mock-age', 'synthetic-identity', 'synthetic-wrapped', {
      exec: () => {
        calls++;
        return execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
          timeout: 50,
          encoding: null,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      },
    });
    assert.fail('Expected timeout');
  } catch (error) {
    const d = safeFailure(error, 'portable-key-recovery').keyRecoveryDiagnostics;
    assert.equal(d.executionErrorCode, 'ETIMEDOUT');
    assert.equal(d.childExitStatus, null);
    assert.equal(d.result, 'FAIL');
    assert.ok(d.elapsedMs >= 20);
  }
  assert.equal(calls, 1);
});

test('ordinary nonzero exit is not mislabeled as timeout or incorrect passphrase', () => {
  try {
    recoverBackupKey('mock', 'synthetic', 'synthetic', {
      exec: () => {
        throw Object.assign(Error('PRIVATE_MESSAGE'), {
          status: 1,
          signal: null,
          stdout: Buffer.alloc(0),
          stderr: Buffer.from('PRIVATE_STDERR'),
        });
      },
    });
    assert.fail('Expected failure');
  } catch (error) {
    const d = safeFailure(error, 'portable-key-recovery').keyRecoveryDiagnostics;
    assert.equal(d.childExitStatus, 1);
    assert.equal(d.executionErrorCode, null);
    assert.equal(d.terminationSignal, null);
    assert.doesNotMatch(JSON.stringify(d), /PRIVATE|passphrase/);
  }
});

test('spawn failure and untrusted code/signal fields are sanitized', () => {
  for (const code of ['ENOENT', 'PRIVATE_CODE']) {
    try {
      recoverBackupKey('mock', 'synthetic', 'synthetic', {
        exec: () => {
          throw {
            code,
            signal: 'PRIVATE_SIGNAL',
            status: 'PRIVATE_STATUS',
            message: 'PRIVATE_MESSAGE',
          };
        },
      });
      assert.fail('Expected failure');
    } catch (error) {
      const d = safeFailure(error, 'portable-key-recovery').keyRecoveryDiagnostics;
      assert.equal(d.executionErrorCode, code === 'ENOENT' ? 'ENOENT' : 'OTHER');
      assert.equal(d.terminationSignal, null);
      assert.equal(d.childExitStatus, null);
      assert.doesNotMatch(JSON.stringify(d), /PRIVATE/);
    }
  }
  const forged = safeFailure({ keyRecoveryDiagnostics: { message: 'PRIVATE_MESSAGE' } }, 'restore');
  assert.equal(forged.keyRecoveryDiagnostics, undefined);
});

test('successful key return and bad length have distinct diagnostics without retaining key bytes', () => {
  for (const bytes of [32, 31]) {
    const key = Buffer.alloc(bytes, 9);
    let d;
    if (bytes === 32) {
      assert.equal(
        recoverBackupKey('mock', 'synthetic', 'synthetic', {
          exec: () => key,
          onDiagnostics: (x) => {
            d = x;
          },
        }),
        key,
      );
      key.fill(0);
    } else
      assert.throws(() =>
        recoverBackupKey('mock', 'synthetic', 'synthetic', {
          exec: () => key,
          onDiagnostics: (x) => {
            d = x;
          },
        }),
      );
    assert.equal(d.childExitStatus, 0);
    assert.equal(d.result, bytes === 32 ? 'PASS' : 'FAIL');
    assert.equal(d.stage, bytes === 32 ? 'complete' : 'key-length');
    assert.equal(d.executionErrorCode, null);
    assert.ok(Object.isFrozen(d));
    assert.ok(key.every((x) => x === 0));
    assert.ok(Object.values(d).every((x) => !Buffer.isBuffer(x)));
  }
});

test('diagnostics consumer cannot cause key cleanup or return to leak raw consumer exceptions', () => {
  const key = Buffer.alloc(32, 3);
  const recovered = recoverBackupKey('mock', 'synthetic', 'synthetic', {
    exec: () => key,
    onDiagnostics: () => {
      throw Error('PRIVATE_CONSUMER');
    },
  });
  assert.equal(recovered, key);
  key.fill(0);
  const source = readFileSync(new URL('portable-recovery.mjs', root), 'utf8');
  assert.match(source, /result\.keyRecoveryDiagnostics = diagnostics/);
  assert.match(source, /keyRecoveryDiagnostics: result\.keyRecoveryDiagnostics/);
});
