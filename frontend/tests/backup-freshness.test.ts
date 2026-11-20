import test from 'node:test';
import assert from 'node:assert/strict';
import { backupFreshness } from '../scripts/backup-freshness.mjs';
test('backup freshness detects changes, additions and missing tables independently of risk policy', () => {
  const before = { users: { contentSha256: 'old' } };
  assert.equal(backupFreshness(before, before).backupDataStillCurrent, true);
  for (const after of [{ users: { contentSha256: 'new' } }, {}]) {
    assert.deepEqual(backupFreshness(before, after), {
      backupDataStillCurrent: false,
      freshBackupRequired: true,
      changedTables: ['users'],
    });
  }
  assert.equal(backupFreshness({}, before).freshBackupRequired, true);
});

test('missing recovery fingerprints never certify freshness', () => {
  assert.throws(() => backupFreshness({ users: {} }, { users: {} }), /BACKUP_FINGERPRINT_MISSING/);
  assert.throws(() => backupFreshness(null, {}), /BACKUP_FINGERPRINT_MISSING/);
});
