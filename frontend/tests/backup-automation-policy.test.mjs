import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  APPROVED_DRIVE_FOLDER_ID,
  assessRecoveryGate,
  assessDriveQuota,
  planDriveUpload,
  planRetention,
  validateStorageBodyCoverage,
  validateBackupAutomationConfig,
  validateIndependentReadback,
} from '../scripts/backup-automation-policy.mjs';

const sha = 'a'.repeat(64);
const config = JSON.parse(
  readFileSync(
    new URL('../artifacts/week1-isolated/backup-automation.example.json', import.meta.url),
  ),
);

test('inactive configuration validates, while activation and policy drift fail closed', () => {
  assert.deepEqual(validateBackupAutomationConfig(config), {
    valid: true,
    reason: 'INACTIVE_TEMPLATE_VALID',
  });
  assert.equal(
    validateBackupAutomationConfig({ ...config, activationApproved: true }).valid,
    false,
  );
  assert.equal(
    validateBackupAutomationConfig({ ...config, extraCredential: 'never here' }).valid,
    false,
  );
  assert.equal(
    validateBackupAutomationConfig({
      ...config,
      schedule: { ...config.schedule, intervalWeeks: 2 },
    }).valid,
    false,
  );
  assert.equal(
    validateBackupAutomationConfig({
      ...config,
      retention: { ...config.retention, minimumSuccessfulBackups: 3 },
    }).valid,
    false,
  );
  assert.equal(
    validateBackupAutomationConfig({
      ...config,
      destination: { ...config.destination, credential: 'must-not-exist' },
    }).valid,
    false,
  );
});

test('Drive upload plan is encrypted-only, fixed-folder, narrow-scope, and does not retry uncertain outcomes', () => {
  assert.deepEqual(
    planDriveUpload({
      folderId: APPROVED_DRIVE_FOLDER_ID,
      backupId: 'backup-20261120T0200Z',
      fileName: 'dump.enc',
      encrypted: true,
    }),
    {
      oauthScope: 'https://www.googleapis.com/auth/drive.file',
      method: 'files.create',
      metadata: {
        name: 'backup-20261120T0200Z-dump.enc',
        mimeType: 'application/octet-stream',
        parents: [APPROVED_DRIVE_FOLDER_ID],
        appProperties: { academyBackupId: 'backup-20261120T0200Z' },
      },
      duplicateCheck: 'appProperties-before-create',
      uncertainResult: 'stop-and-reconcile-before-retry',
      deleteOrUpdateCalls: false,
    },
  );
  for (const input of [
    {
      folderId: '1OMn59YRc44K3dqANf4LQwLtCGA_G2Sqy',
      backupId: 'backup-1',
      fileName: 'x.enc',
      encrypted: true,
    },
    {
      folderId: APPROVED_DRIVE_FOLDER_ID,
      backupId: '../escape',
      fileName: 'x.enc',
      encrypted: true,
    },
    {
      folderId: APPROVED_DRIVE_FOLDER_ID,
      backupId: 'backup-1',
      fileName: 'x.enc',
      encrypted: false,
    },
  ])
    assert.throws(() => planDriveUpload(input));
});

test('Drive quota gate includes a reserve and fails closed on full, missing, or invalid quota evidence', () => {
  assert.deepEqual(
    assessDriveQuota({ limitBytes: 1000, usageBytes: 400, packageBytes: 100, reserveBytes: 500 }),
    {
      allowed: true,
      availableBytes: '600',
      requiredBytes: '600',
      reason: 'FREE_QUOTA_WITH_RESERVE_AVAILABLE',
    },
  );
  assert.equal(
    assessDriveQuota({ limitBytes: 1000, usageBytes: 401, packageBytes: 100, reserveBytes: 500 })
      .allowed,
    false,
  );
  assert.equal(
    assessDriveQuota({ limitBytes: undefined, usageBytes: 1, packageBytes: 1, reserveBytes: 1 })
      .allowed,
    false,
  );
  assert.equal(
    assessDriveQuota({ limitBytes: 1000, usageBytes: 1001, packageBytes: 1, reserveBytes: 0 })
      .allowed,
    false,
  );
  assert.equal(
    assessDriveQuota({
      limitBytes: '15000000000',
      usageBytes: '14999999000',
      packageBytes: '500',
      reserveBytes: '501',
    }).allowed,
    false,
  );
  assert.equal(
    assessDriveQuota({ limitBytes: 1000, usageBytes: 100, packageBytes: 10, reserveBytes: 0 })
      .allowed,
    false,
  );
});

test('private Storage body proof requires an exact encrypted object manifest', () => {
  const inventory = [
    { bucketId: 'private-a', name: 'folder/object-1' },
    { bucketId: 'private-b', name: 'object-2' },
  ];
  const encryptedObjects = inventory.map((object) => ({
    objectKeySha256: createHash('sha256')
      .update(`${object.bucketId}\0${object.name}`)
      .digest('hex'),
    encrypted: true,
    ciphertextBytes: 32,
    ciphertextSha256: 'b'.repeat(64),
  }));
  const complete = validateStorageBodyCoverage({ inventory, encryptedObjects });
  assert.equal(complete.valid, true);
  assert.equal(complete.inventoryCount, 2);
  assert.equal(complete.inventoryFingerprint.length, 64);
  assert.equal(
    validateStorageBodyCoverage({ inventory, encryptedObjects: encryptedObjects.slice(1) }).valid,
    false,
  );
  assert.equal(
    validateStorageBodyCoverage({
      inventory,
      encryptedObjects: [...encryptedObjects, encryptedObjects[0]],
    }).valid,
    false,
  );
  assert.equal(
    validateStorageBodyCoverage({
      inventory,
      encryptedObjects: encryptedObjects.map((item, i) =>
        i ? item : { ...item, encrypted: false },
      ),
    }).valid,
    false,
  );
  assert.equal(
    validateStorageBodyCoverage({
      inventory,
      encryptedObjects: encryptedObjects.map((item, i) =>
        i ? item : { ...item, ciphertextSha256: 'invalid' },
      ),
    }).valid,
    false,
  );
});

test('routine releases avoid synchronous backup gates; high-risk changes require fresh complete recovery evidence', () => {
  assert.deepEqual(assessRecoveryGate({ risk: 'routine' }), {
    allowed: true,
    synchronousBackupRequired: false,
    reason: 'SCHEDULED_RECOVERY_CONTINUES',
  });
  const now = Date.parse('2026-11-20T12:00:00Z');
  const evidence = {
    status: 'verified',
    encrypted: true,
    restoreVerified: true,
    storageCoverageVerified: true,
    storageCoverageProofSha256: sha,
    offsiteReadbackVerified: true,
    manifestSha256: sha,
    target: 'supabase-project-id',
    createdAt: '2026-11-20T11:00:00Z',
  };
  const gate = {
    risk: 'high',
    evidence,
    now,
    maxAgeMs: 2 * 60 * 60 * 1000,
    expectedTarget: 'supabase-project-id',
  };
  assert.equal(assessRecoveryGate(gate).allowed, true);
  for (const bad of [
    { ...evidence, offsiteReadbackVerified: false },
    { ...evidence, restoreVerified: false },
    { ...evidence, storageCoverageVerified: false },
    { ...evidence, createdAt: '2026-11-20T13:00:00Z' },
    { ...evidence, manifestSha256: 'bad' },
  ])
    assert.equal(
      assessRecoveryGate({ risk: 'high', evidence: bad, now, maxAgeMs: 2 * 60 * 60 * 1000 })
        .allowed,
      false,
    );
  assert.equal(assessRecoveryGate({ ...gate, expectedTarget: 'another-project' }).allowed, false);
  assert.equal(
    assessRecoveryGate({ risk: 'unknown', evidence, now, maxAgeMs: 1000 }).allowed,
    false,
  );
});

test('offsite receipt must bind the package and prove a different verifier identity', () => {
  const expected = { backupId: 'backup-1', packageSha256: sha };
  const receipt = {
    recordType: 'independent-drive-readback-v1',
    ...expected,
    driveFileId: 'synthetic-drive-file-id',
    readbackVerified: true,
    checksumVerified: true,
    signatureVerified: true,
    uploaderPrincipal: 'serviceAccount:uploader',
    verifierPrincipal: 'user:owner@example.test',
  };
  assert.equal(validateIndependentReadback(receipt, expected).valid, true);
  assert.equal(
    validateIndependentReadback(
      { ...receipt, verifierPrincipal: receipt.uploaderPrincipal },
      expected,
    ).valid,
    false,
  );
  assert.equal(
    validateIndependentReadback({ ...receipt, packageSha256: 'b'.repeat(64) }, expected).valid,
    false,
  );
  assert.equal(
    validateIndependentReadback({ ...receipt, signatureVerified: false }, expected).valid,
    false,
  );
});

test('retention planning protects four complete latest recovery points and never deletes', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  const points = Array.from({ length: 6 }, (_, index) => ({
    id: `point-${index + 1}`,
    status: 'verified',
    encrypted: true,
    restoreVerified: true,
    offsiteReadbackVerified: true,
    storageCoverageVerified: true,
    manifestSha256: sha,
    createdAt: new Date(Date.parse('2026-11-20T00:00:00Z') - index * 7 * 86400000).toISOString(),
  }));
  points.push({
    id: 'incomplete',
    status: 'verified',
    encrypted: true,
    restoreVerified: true,
    offsiteReadbackVerified: false,
    storageCoverageVerified: true,
    manifestSha256: sha,
    createdAt: '2026-08-01T00:00:00Z',
  });
  const plan = planRetention(points, { now, minimumSuccessfulBackups: 4 });
  assert.equal(plan.deletionPerformed, false);
  assert.deepEqual(plan.protectedVerifiedPointIds, ['point-1', 'point-2', 'point-3', 'point-4']);
  assert.deepEqual(
    plan.deletionCandidates.map((entry) => entry.id),
    ['point-5', 'point-6'],
  );
  assert.throws(() => planRetention(points, { now, minimumSuccessfulBackups: 3 }));
});
