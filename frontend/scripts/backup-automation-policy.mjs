import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const SHA256 = /^[a-f0-9]{64}$/;
const BACKUP_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,95}$/;
const OBJECT_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const APPROVED_DRIVE_FOLDER_ID = '1eVSquuPOKGMvmjisNXE7Znr9DdcQmJI3';
export const OWNER_VERIFIER_ACCOUNT = 'khaledamireh55@gmail.com';

export function validateStorageBodyCoverage({ inventory, encryptedObjects }) {
  if (!Array.isArray(inventory) || !Array.isArray(encryptedObjects))
    return { valid: false, reason: 'STORAGE_BODY_EVIDENCE_MISSING' };
  const keyFor = (object) => {
    if (
      typeof object?.bucketId !== 'string' ||
      !object.bucketId ||
      typeof object?.name !== 'string' ||
      !object.name
    )
      return null;
    return createHash('sha256').update(`${object.bucketId}\0${object.name}`).digest('hex');
  };
  const expected = inventory.map(keyFor);
  const actual = encryptedObjects.map((object) => object?.objectKeySha256);
  if (
    expected.some((key) => key === null) ||
    expected.some((key, index) => expected.indexOf(key) !== index) ||
    actual.some((key) => !SHA256.test(key ?? '')) ||
    actual.some((key, index) => actual.indexOf(key) !== index)
  )
    return { valid: false, reason: 'STORAGE_BODY_MANIFEST_INVALID' };
  const valid =
    expected.length === actual.length &&
    expected.every((key) => actual.includes(key)) &&
    encryptedObjects.every(
      (object) =>
        object.encrypted === true &&
        Number.isSafeInteger(object.ciphertextBytes) &&
        object.ciphertextBytes > 0 &&
        SHA256.test(object.ciphertextSha256 ?? ''),
    );
  const inventoryFingerprint = createHash('sha256')
    .update([...expected].sort().join('\n'))
    .digest('hex');
  return {
    valid,
    reason: valid ? 'STORAGE_BODY_COVERAGE_VERIFIED' : 'STORAGE_BODY_COVERAGE_INCOMPLETE',
    inventoryCount: expected.length,
    encryptedObjectCount: actual.length,
    inventoryFingerprint,
  };
}

export function planDriveUpload({ folderId, backupId, fileName, encrypted }) {
  if (
    folderId !== APPROVED_DRIVE_FOLDER_ID ||
    !BACKUP_ID.test(backupId ?? '') ||
    !OBJECT_FILE.test(fileName ?? '') ||
    encrypted !== true
  )
    throw new Error('INVALID_DRIVE_BACKUP_UPLOAD');
  return {
    oauthScope: DRIVE_FILE_SCOPE,
    method: 'files.create',
    metadata: {
      name: `${backupId}-${fileName}`,
      mimeType: 'application/octet-stream',
      parents: [folderId],
      appProperties: { academyBackupId: backupId },
    },
    duplicateCheck: 'appProperties-before-create',
    uncertainResult: 'stop-and-reconcile-before-retry',
    deleteOrUpdateCalls: false,
  };
}

export function assessDriveQuota({ limitBytes, usageBytes, packageBytes, reserveBytes }) {
  const parseBytes = (value) => {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
      return BigInt(value);
    if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
    return null;
  };
  const limit = parseBytes(limitBytes);
  const usage = parseBytes(usageBytes);
  const packageSize = parseBytes(packageBytes);
  const reserve = parseBytes(reserveBytes);
  if (
    limit === null ||
    usage === null ||
    packageSize === null ||
    reserve === null ||
    limit <= 0n ||
    packageSize <= 0n ||
    reserve <= 0n
  )
    return { allowed: false, reason: 'DRIVE_QUOTA_EVIDENCE_INVALID' };
  const available = usage < limit ? limit - usage : 0n;
  const required = packageSize + reserve;
  const allowed = required <= available;
  return {
    allowed,
    availableBytes: available.toString(),
    requiredBytes: required.toString(),
    reason: allowed ? 'FREE_QUOTA_WITH_RESERVE_AVAILABLE' : 'FREE_QUOTA_HARD_STOP',
  };
}

export function assessRecoveryGate({ risk, evidence, now = Date.now(), maxAgeMs, expectedTarget }) {
  if (risk === 'routine')
    return {
      allowed: true,
      synchronousBackupRequired: false,
      reason: 'SCHEDULED_RECOVERY_CONTINUES',
    };
  if (risk !== 'high')
    return { allowed: false, synchronousBackupRequired: true, reason: 'UNKNOWN_RISK_CLASS' };
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0)
    return { allowed: false, synchronousBackupRequired: true, reason: 'INVALID_FRESHNESS_POLICY' };
  const createdAt = Date.parse(evidence?.createdAt ?? '');
  const valid =
    evidence?.status === 'verified' &&
    evidence?.encrypted === true &&
    evidence?.restoreVerified === true &&
    evidence?.storageCoverageVerified === true &&
    SHA256.test(evidence?.storageCoverageProofSha256 ?? '') &&
    evidence?.offsiteReadbackVerified === true &&
    SHA256.test(evidence?.manifestSha256 ?? '') &&
    typeof expectedTarget === 'string' &&
    expectedTarget.length > 0 &&
    evidence?.target === expectedTarget &&
    Number.isFinite(createdAt) &&
    createdAt <= now &&
    now - createdAt <= maxAgeMs;
  return {
    allowed: valid,
    synchronousBackupRequired: true,
    reason: valid ? 'FRESH_VERIFIED_RECOVERY_POINT' : 'FRESH_VERIFIED_RECOVERY_POINT_REQUIRED',
  };
}

export function validateIndependentReadback(receipt, expected) {
  const valid =
    receipt?.recordType === 'independent-drive-readback-v1' &&
    receipt?.backupId === expected?.backupId &&
    receipt?.packageSha256 === expected?.packageSha256 &&
    SHA256.test(receipt?.packageSha256 ?? '') &&
    typeof receipt?.driveFileId === 'string' &&
    receipt.driveFileId.length > 0 &&
    receipt?.readbackVerified === true &&
    receipt?.checksumVerified === true &&
    receipt?.signatureVerified === true &&
    typeof receipt?.uploaderPrincipal === 'string' &&
    typeof receipt?.verifierPrincipal === 'string' &&
    receipt.uploaderPrincipal !== receipt.verifierPrincipal;
  return {
    valid,
    reason: valid ? 'INDEPENDENT_READBACK_VERIFIED' : 'INDEPENDENT_READBACK_REQUIRED',
  };
}

export function planRetention(points, { now = Date.now(), minimumSuccessfulBackups }) {
  if (!Number.isSafeInteger(minimumSuccessfulBackups) || minimumSuccessfulBackups < 4)
    throw new Error('INVALID_RETENTION_POLICY');
  const verified = points
    .filter(
      (point) =>
        point?.status === 'verified' &&
        point?.encrypted === true &&
        point?.restoreVerified === true &&
        point?.offsiteReadbackVerified === true &&
        point?.storageCoverageVerified === true &&
        SHA256.test(point?.manifestSha256 ?? ''),
    )
    .map((point) => ({ ...point, createdAtMs: Date.parse(point.createdAt ?? '') }))
    .filter((point) => Number.isFinite(point.createdAtMs) && point.createdAtMs <= now)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  const protectedIds = new Set(
    verified.slice(0, minimumSuccessfulBackups).map((point) => point.id),
  );
  const candidates = verified
    .filter((point) => !protectedIds.has(point.id))
    .map(({ id, createdAt }) => ({ id, createdAt }));
  return {
    action: 'review-required-dry-run',
    deletionPerformed: false,
    protectedVerifiedPointIds: [...protectedIds],
    deletionCandidates: candidates,
  };
}

export function validateBackupAutomationConfig(config) {
  const exactKeys = ['activationApproved', 'destination', 'retention', 'schedule', 'version'];
  if (!config || !isDeepStrictEqual(Object.keys(config).sort(), exactKeys))
    return { valid: false, reason: 'CONFIG_SCHEMA_MISMATCH' };
  const hasKeys = (value, keys) =>
    value && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
  const valid =
    config.version === 1 &&
    config.activationApproved === false &&
    hasKeys(config.destination, [
      'folderId',
      'hardStopOnQuotaUnknown',
      'oauthScope',
      'ownerVerifierAccount',
      'provider',
      'quotaField',
      'uploaderPrincipal',
      'writerCanDelete',
    ]) &&
    config.destination?.provider === 'google-drive-personal-oauth' &&
    config.destination?.folderId === APPROVED_DRIVE_FOLDER_ID &&
    config.destination?.oauthScope === DRIVE_FILE_SCOPE &&
    config.destination?.quotaField === 'storageQuota(limit,usage)' &&
    config.destination?.hardStopOnQuotaUnknown === true &&
    config.destination?.writerCanDelete === true &&
    config.destination?.ownerVerifierAccount === OWNER_VERIFIER_ACCOUNT &&
    config.destination?.uploaderPrincipal === null &&
    hasKeys(config.schedule, [
      'dayOfWeek',
      'intervalWeeks',
      'localHour',
      'machineMustBeAvailable',
      'provider',
      'timezone',
    ]) &&
    config.schedule?.provider === 'windows-task-scheduler' &&
    config.schedule?.intervalWeeks === 1 &&
    config.schedule?.dayOfWeek === 'Sunday' &&
    config.schedule?.localHour === 2 &&
    config.schedule?.timezone === 'Asia/Amman' &&
    config.schedule?.machineMustBeAvailable === true &&
    hasKeys(config.retention, ['minimumSuccessfulBackups', 'reserveBytes']) &&
    config.retention?.minimumSuccessfulBackups === 4 &&
    config.retention?.reserveBytes === null;
  return { valid, reason: valid ? 'INACTIVE_TEMPLATE_VALID' : 'CONFIG_POLICY_MISMATCH' };
}
