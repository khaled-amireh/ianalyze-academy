// Read-only execution-time guard: exact catalog/history, integrity-preserving risk policy.
import assert from 'node:assert/strict';
import { verifyCandidateBundle } from './verify-candidate-bundle.mjs';
import { backupFreshness } from './backup-freshness.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createDecipheriv } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, sha } from '../artifacts/final-release/common.mjs';
import {
  assessReleaseDrift,
  captureRiskSnapshot,
  RISK_TABLE_RULES,
} from '../artifacts/week1-isolated/risk-based-drift.mjs';

process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const location = JSON.parse(
  readFileSync('frontend/artifacts/week1-isolated/deployment-backup-location.json', 'utf8'),
);
const manifestPath = location.directory + '/manifest.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const d = db(),
  out = { checkedAt: new Date().toISOString(), productionWrites: false };
let key,
  stage = 'backup-evidence';
const canon = (x) =>
  Array.isArray(x)
    ? x.map(canon)
    : x && typeof x === 'object'
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, canon(x[k])]),
        )
      : x;
const tableName = (t) => t.schema + '.' + t.table;
try {
  assert.equal(sha(readFileSync(manifestPath)), location.manifestSha256);
  assert.ok(manifest.restoreVerified);
  assert.equal(
    sha(readFileSync(location.directory + '/restore-verification.json')),
    manifest.restoreVerificationSha256,
  );
  for (const f of manifest.files)
    assert.equal(sha(readFileSync(location.directory + '/' + f.file)), f.sha256);
  assert.equal(sha(readFileSync(location.directory + '/key.dpapi')), manifest.keyFile.sha256);
  assert.ok(
    typeof manifest.riskPolicySha256 === 'string' && manifest.riskPolicySha256.length === 64,
  );
  out.backupChecksumsVerified = true;
  const historyBaseline = JSON.parse(
    readFileSync(
      'frontend/artifacts/week1-isolated/migration-history-17-current-state-baseline.json',
      'utf8',
    ),
  );
  assert.equal(historyBaseline.baselineType, 'OWNER_ACCEPTED_CURRENT_STATE_RECOVERY_BASELINE');
  assert.equal(historyBaseline.historicalApproval, false);
  assert.equal(manifest.migrationHistoryEntries, 17);
  assert.equal(
    manifest.migrationHistoryBaselineSha256,
    sha(
      readFileSync(
        'frontend/artifacts/week1-isolated/migration-history-17-current-state-baseline.json',
      ),
    ),
  );
  assert.equal(
    sha(readFileSync(historyBaseline.reviewAttestation)),
    historyBaseline.reviewAttestationSha256,
  );
  for (const e of historyBaseline.entries)
    if (e.localSourceFile) assert.equal(sha(readFileSync(e.localSourceFile)), e.localSourceSha256);

  const unprotect =
    'Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Console]::Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))';
  key = Buffer.from(
    requirePowerShell(
      unprotect,
      readFileSync(location.directory + '/key.dpapi').toString('base64'),
    ),
    'base64',
  );
  const meta = manifest.files.find((f) => f.file === 'baseline.json.enc');
  assert.ok(meta);
  const encrypted = readFileSync(location.directory + '/' + meta.file),
    dec = createDecipheriv('aes-256-gcm', key, encrypted.subarray(4, 16));
  dec.setAuthTag(encrypted.subarray(-16));
  const plain = Buffer.concat([dec.update(encrypted.subarray(16, -16)), dec.final()]);
  assert.equal(sha(plain), meta.plaintextSha256);
  const baseline = JSON.parse(plain.toString('utf8'));
  out.localKeyRecoveryVerified = true;
  assert.ok(baseline.riskSnapshot?.tables, 'Risk-aware backup baseline required');
  assert.equal(
    baseline.riskSnapshot.policySha256,
    manifest.riskPolicySha256,
    'Risk policy fingerprint mismatch',
  );
  assert.ok(baseline.featureGates, 'Captured production feature-gate baseline required');
  const queries = JSON.parse(
    readFileSync('frontend/artifacts/supabase-auth-integration/catalog-queries.json', 'utf8'),
  );
  const canonCatalog = {};
  stage = 'read-only-production-snapshot';
  await d.begin('isolation level repeatable read read only', async (tx) => {
    const identity = (
      await tx`select current_database() database,current_user role,current_setting('transaction_read_only') read_only`
    )[0];
    assert.equal(identity.database, 'postgres');
    assert.equal(identity.role, 'postgres');
    assert.equal(identity.read_only, 'on');
    const history =
      await tx`select version,name,statements from supabase_migrations.schema_migrations order by version`;
    assert.deepEqual(canon(history), canon(baseline.history), 'Migration history/ledger changed');
    out.migrationHistoryUnchanged = true;
    await tx`set local search_path=pg_catalog`;
    for (const [name, q] of Object.entries(queries)) {
      let rows = await tx.unsafe(q);
      if (name === 'functions')
        rows = rows.map(({ definition, ...f }) => ({ ...f, definitionSha256: sha(definition) }));
      canonCatalog[name] = rows;
      assert.deepEqual(
        canon(rows),
        canon(baseline.catalog[name]),
        'Schema/security catalog changed: ' + name,
      );
    }
    out.schemaAndSecurityCatalogExact = true;
    const currentGates = (
      await tx`select app_private.leaderboard_enabled() leaderboard,app_private.submission_service_enabled() submissions,app_private.uploads_enabled() legacy_direct_uploads`
    )[0];
    assert.deepEqual(
      canon(currentGates),
      canon(baseline.featureGates),
      'Feature gates changed since recovery point',
    );
    assert.equal(currentGates.leaderboard, true);
    assert.equal(currentGates.submissions, true);
    assert.equal(currentGates.legacy_direct_uploads, false);
    out.featureGatesPreserved = true;
    stage = 'capture-risk-snapshot';
    const currentRisk = await captureRiskSnapshot(tx, baseline.catalog.relations, RISK_TABLE_RULES);
    const oldPolicyRules = Object.fromEntries(
      Object.entries(RISK_TABLE_RULES).filter(([name]) => name !== 'auth.mfa_amr_claims'),
    );
    const oldPolicySha256 = sha(JSON.stringify(canon(oldPolicyRules)));
    if (baseline.riskSnapshot.tables['auth.mfa_amr_claims']?.mode === 'ephemeral')
      assert.equal(
        currentRisk.policySha256,
        baseline.riskSnapshot.policySha256,
        'Risk policy version changed',
      );
    else
      assert.equal(
        oldPolicySha256,
        baseline.riskSnapshot.policySha256,
        'Legacy risk policy baseline changed beyond the reviewed Auth AMR exception',
      );
    stage = 'compare-risk-based-record-integrity';
    const currentTables = {};
    for (const t of baseline.tables) {
      const qid = (x) => '"' + x.replaceAll('"', '""') + '"';
      const digests = await tx.unsafe(
        `select md5(to_jsonb(t)::text) digest from ${qid(t.schema)}.${qid(t.table)} t order by 1`,
      );
      const name = tableName(t),
        risk = currentRisk.tables[name];
      currentTables[name] = {
        contentSha256: sha(digests.map((x) => x.digest).join('\n')),
        ...(risk ?? {}),
      };
    }
    const baselineTables = {};
    for (const t of baseline.tables) {
      const name = tableName(t);
      baselineTables[name] = {
        contentSha256: t.sha256,
        ...(baseline.riskSnapshot.tables[name] ?? {}),
      };
    }
    out.unclassifiedChangedRelations = Object.keys(baselineTables).filter(
      (name) =>
        !Object.hasOwn(RISK_TABLE_RULES, name) &&
        baselineTables[name].contentSha256 !== currentTables[name]?.contentSha256,
    );
    out.reviewedRuleSnapshotMismatches = Object.keys(baselineTables).filter(
      (name) =>
        (RISK_TABLE_RULES[name] &&
          (baselineTables[name].mode ?? 'exact') !== RISK_TABLE_RULES[name].mode) ||
        (RISK_TABLE_RULES[name]?.mode === 'appendOnly' &&
          currentTables[name]?.mode !== RISK_TABLE_RULES[name].mode),
    );
    const catalogSha = sha(JSON.stringify(canon(canonCatalog)));
    const securitySha = sha(
      JSON.stringify(
        canon({
          roles: canonCatalog.roles,
          memberships: canonCatalog.memberships,
          policies: canonCatalog.policies,
          triggers: canonCatalog.triggers,
          eventTriggers: canonCatalog.eventTriggers,
          functions: canonCatalog.functions,
          schemaGrants: canonCatalog.schemaGrants,
        }),
      ),
    );
    const baselineHistory = baseline.history.map((x) => ({
      version: x.version,
      name: x.name,
      statementsSha256: sha(JSON.stringify(x.statements ?? [])),
    }));
    const currentHistory = history.map((x) => ({
      version: x.version,
      name: x.name,
      statementsSha256: sha(JSON.stringify(x.statements ?? [])),
    }));
    const result = assessReleaseDrift({
      baseline: {
        migrationHistory: baselineHistory,
        schemaSha256: catalogSha,
        securitySha256: securitySha,
        tables: baselineTables,
      },
      current: {
        migrationHistory: currentHistory,
        schemaSha256: catalogSha,
        securitySha256: securitySha,
        tables: currentTables,
      },
    });
    Object.assign(out, backupFreshness(baselineTables, currentTables));
    out.riskBasedDrift = result;
    out.preservedBaselineTableCount = baseline.tables.length;
    out.authUsers = Number((await tx`select count(*) n from auth.users`)[0].n);
    out.storageObjects = Number((await tx`select count(*) n from storage.objects`)[0].n);
    assert.equal(
      out.storageObjects,
      manifest.storageObjects,
      'Storage inventory changed since the encrypted backup',
    );
    out.databaseCredentialVerifiedReadOnly = true;
  });
  stage = 'verify-backup-freshness';
  assert.equal(out.backupDataStillCurrent, true, 'FRESH_BACKUP_REQUIRED');
  stage = 'verify-reviewed-release-bundle';
  Object.assign(out, verifyCandidateBundle());
  console.log(
    JSON.stringify({
      backupChecksumsVerified: out.backupChecksumsVerified,
      localKeyRecoveryVerified: out.localKeyRecoveryVerified,
      migrationHistoryUnchanged: out.migrationHistoryUnchanged,
      schemaAndSecurityCatalogExact: out.schemaAndSecurityCatalogExact,
      riskBasedDrift: out.riskBasedDrift,
      authUsers: out.authUsers,
      storageObjects: out.storageObjects,
      featureGatesPreserved: out.featureGatesPreserved,
      productionWrites: false,
    }),
  );
} catch (e) {
  const safeMessages = new Set([
    'RISK_POLICY_COLUMN_MISSING',
    'TABLE_PRIMARY_KEY_REQUIRED',
    'RISK_PRIMARY_KEY_DUPLICATE',
    'ROW_KEY_INVALID',
    'MIGRATION_HISTORY_DRIFT',
    'SCHEMA_DRIFT',
    'SECURITY_CATALOG_DRIFT',
    'TABLE_MISSING',
    'UNEXPECTED_TABLE',
    'TABLE_POLICY_MISSING',
    'IMMUTABLE_TABLE_CHANGED',
    'PRESERVED_ROW_MISSING',
    'APPEND_ONLY_ROW_CHANGED',
    'PROTECTED_FIELDS_CHANGED',
    'RISK_SNAPSHOT_POLICY_MISMATCH',
    'DRIFT_INPUT_MISSING',
  ]);
  out.criticalVerificationFailed = true;
  out.safeFailureCode = safeMessages.has(e.message)
    ? e.message
    : /^[A-Z0-9_]+$/.test(e.code ?? '')
      ? e.code
      : 'PREREQUISITE_VERIFICATION_FAILED';
  out.failedStage = stage;
  console.log({
    criticalVerificationFailed: true,
    stage,
    code: out.safeFailureCode,
    ...(e.message === 'TABLE_POLICY_MISSING'
      ? {
          unclassifiedChangedRelations: out.unclassifiedChangedRelations,
          reviewedRuleSnapshotMismatches: out.reviewedRuleSnapshotMismatches,
        }
      : {}),
    productionWrites: false,
  });
  process.exitCode = 1;
} finally {
  key?.fill(0);
  await d.end({ timeout: 2 });
  writeFileSync(
    'frontend/artifacts/week1-isolated/final-prerequisite-verification.json',
    JSON.stringify(out, null, 2) + '\n',
  );
}

function requirePowerShell(script, input) {
  return execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
