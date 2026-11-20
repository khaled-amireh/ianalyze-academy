import { spawnSync } from 'node:child_process';
import { createHash, createDecipheriv } from 'node:crypto';
import { readFileSync, statSync, openSync, closeSync } from 'node:fs';
import { isatty } from 'node:tty';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'C:/Users/khale/SupabaseBackups/ianalyze-academy';
const BACKUP = `${ROOT}/week1-predeploy-20261119T153809Z`;
const RECOVERY = `${ROOT}/portable-recovery-20261119T153809Z`;
const AGE = 'C:/Tools/age/age.exe';
const ERRORS = new Set(['ETIMEDOUT', 'ENOENT', 'EACCES', 'EPERM', 'ENOBUFS']);
const SIGNALS = new Set(['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGABRT']);
const safeCode = (error) => (ERRORS.has(error?.code) ? error.code : error ? 'OTHER' : null);
const requireTrue = (ok) => {
  if (!ok) throw new Error('CHECK_FAILED');
};

// Explicit Win32 device paths avoid Node's ordinary filesystem path resolution.
// Opening and isatty only: no reads, writes, console mode changes or prompts.
export function inspectConsole({
  platform = process.platform,
  streams = {
    stdin: process.stdin.isTTY === true,
    stdout: process.stdout.isTTY === true,
    stderr: process.stderr.isTTY === true,
  },
  open = openSync,
  close = closeSync,
  isTerminal = isatty,
} = {}) {
  const diagnostic = {
    ok: false,
    condition: 'platform',
    executionErrorCode: null,
    streams: {
      stdin: streams.stdin === true,
      stdout: streams.stdout === true,
      stderr: streams.stderr === true,
    },
    devices: {
      input: { opened: null, terminal: null, closed: null },
      output: { opened: null, terminal: null, closed: null },
    },
  };
  if (platform !== 'win32') return diagnostic;
  for (const stream of ['stdin', 'stdout', 'stderr']) {
    diagnostic.condition = stream + '-tty';
    if (!diagnostic.streams[stream]) return diagnostic;
  }
  for (const [label, device] of [
    ['input', '\\\\.\\CONIN$'],
    ['output', '\\\\.\\CONOUT$'],
  ]) {
    const status = diagnostic.devices[label];
    let fd;
    let operation = label + '-open';
    try {
      fd = open(device, 'r+');
      status.opened = true;
      operation = label + '-tty';
      status.terminal = isTerminal(fd) === true;
      if (!status.terminal) diagnostic.condition = operation;
    } catch (error) {
      if (fd === undefined) status.opened = false;
      diagnostic.condition = operation;
      diagnostic.executionErrorCode = safeCode(error);
    } finally {
      if (fd !== undefined) {
        try {
          close(fd);
          status.closed = true;
        } catch (error) {
          status.closed = false;
          diagnostic.condition = label + '-close';
          diagnostic.executionErrorCode = safeCode(error);
        }
      }
    }
    if (status.opened !== true || status.terminal !== true || status.closed !== true)
      return diagnostic;
  }
  diagnostic.ok = true;
  diagnostic.condition = 'complete';
  return diagnostic;
}

export function checkConsole(options = {}) {
  return inspectConsole(options).ok;
}

function loadBoundPayload() {
  const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
  const manifestFile = join(BACKUP, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const metadata = JSON.parse(readFileSync(join(RECOVERY, 'recovery-metadata.json'), 'utf8'));
  const proofHash = hash(join(BACKUP, 'restore-verification.json'));
  requireTrue(manifest.project === 'ocihwiqtgqplwgyhpwjv' && metadata.project === manifest.project);
  requireTrue(metadata.backupManifestSha256 === hash(manifestFile));
  requireTrue(
    metadata.restoreProofSha256 === proofHash && manifest.restoreVerificationSha256 === proofHash,
  );
  requireTrue(
    manifest.exportComplete === true &&
      manifest.restoreVerified === true &&
      manifest.productionWrites === false,
  );
  requireTrue(
    metadata.privateIdentityEncrypted === true && metadata.wrappedBackupKeyEncrypted === true,
  );
  requireTrue(statSync(join(RECOVERY, 'age-identity.age')).isFile());
  requireTrue(statSync(join(RECOVERY, 'wrapped-backup-key.age')).isFile());
  requireTrue(
    readFileSync(join(RECOVERY, 'age-recipient.txt'), 'utf8').trim() === metadata.publicRecipient,
  );
  const item = manifest.files
    .filter(
      (x) =>
        typeof x.file === 'string' &&
        basename(x.file) === x.file &&
        Number.isSafeInteger(x.bytes) &&
        x.bytes > 32 &&
        x.bytes <= 1048576,
    )
    .sort((a, b) => a.bytes - b.bytes)[0];
  requireTrue(item);
  const payload = readFileSync(join(BACKUP, item.file));
  try {
    requireTrue(
      payload.length === item.bytes && payload.subarray(0, 4).toString('ascii') === 'IAZ1',
    );
    requireTrue(createHash('sha256').update(payload).digest('hex') === item.sha256);
    return payload;
  } catch {
    payload.fill(0);
    throw new Error('PAYLOAD_INVALID');
  }
}

export function verifyCompatibility({
  consoleCheck = inspectConsole,
  load = loadBoundPayload,
  spawn = spawnSync,
  now = Date.now,
} = {}) {
  const started = now();
  const result = {
    stage: 'console',
    result: 'FAIL',
    elapsedMs: 0,
    childExitStatus: null,
    terminationSignal: null,
    executionErrorCode: null,
  };
  let payload, child, part, tail;
  try {
    const consoleResult = consoleCheck();
    if (typeof consoleResult === 'object' && consoleResult !== null) {
      result.console = consoleResult;
      if (consoleResult.ok !== true) return result;
    } else if (consoleResult !== true) return result;
    result.stage = 'metadata';
    payload = load();
    result.stage = 'age';
    child = spawn(
      AGE,
      [
        '-d',
        '-i',
        join(RECOVERY, 'age-identity.age'),
        '-o',
        '-',
        join(RECOVERY, 'wrapped-backup-key.age'),
      ],
      {
        // age uses CONIN$/CONOUT$ for its masked prompt; suppress raw stderr.
        stdio: ['inherit', 'pipe', 'pipe'],
        encoding: null,
        windowsHide: false,
        timeout: 300000,
        maxBuffer: 1048576,
      },
    );
    result.childExitStatus = Number.isInteger(child.status) ? child.status : null;
    result.terminationSignal = SIGNALS.has(child.signal) ? child.signal : null;
    result.executionErrorCode = safeCode(child.error);
    if (child.error || child.status !== 0) return result;
    result.stage = 'key-length';
    if (!Buffer.isBuffer(child.stdout) || child.stdout.length !== 32) return result;
    result.stage = 'aes-gcm';
    const decipher = createDecipheriv('aes-256-gcm', child.stdout, payload.subarray(4, 16));
    decipher.setAuthTag(payload.subarray(-16));
    part = decipher.update(payload.subarray(16, -16));
    tail = decipher.final();
    result.stage = 'complete';
    result.result = 'PASS';
  } catch (error) {
    result.executionErrorCode = safeCode(error);
  } finally {
    for (const b of [payload, child?.stdout, child?.stderr, part, tail])
      if (Buffer.isBuffer(b)) b.fill(0);
    result.elapsedMs = Math.max(0, now() - started);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let result;
  if (args.length === 1 && args[0] === '--check-console') {
    const started = Date.now();
    const consoleResult = inspectConsole();
    result = {
      stage: 'console',
      result: consoleResult.ok ? 'PASS' : 'FAIL',
      console: consoleResult,
      elapsedMs: Date.now() - started,
      childExitStatus: null,
      terminationSignal: null,
      executionErrorCode: null,
    };
  } else if (args.length === 1 && args[0] === '--verify') {
    result = verifyCompatibility();
  } else {
    result = { stage: 'arguments', result: 'FAIL' };
  }
  console.log(JSON.stringify(result));
  process.exitCode = result.result === 'PASS' ? 0 : 1;
}
