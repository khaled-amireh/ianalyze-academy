import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  CANDIDATE_ROOT,
  MIGRATIONS,
  verifyCandidateBundle,
} from '../scripts/verify-candidate-bundle.mjs';
const review = 'docs/audits/leaderboard-admin-release/candidate-manifest.json';
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
function fixture() {
  const files = new Map<string, Buffer>();
  for (const p of Object.keys(MIGRATIONS))
    files.set(resolve(CANDIDATE_ROOT, p), readFileSync(resolve(CANDIDATE_ROOT, p)));
  const manifest = {
    branch: 'release/academy-admin-consent-20261119',
    head: 'b57a26d7eac32004110b0d5aef4a18f6b94281bf',
    productionWrites: false,
    releaseAuthorizationRequired: true,
    newMigrations: Object.keys(MIGRATIONS),
    excludedCompetingMigration: '20261119024031_leaderboard_registered_full_name.sql',
    files: { ...MIGRATIONS },
  };
  return {
    manifest,
    files,
    options: {
      root: CANDIDATE_ROOT,
      git: (args: string[]) => (args[0] === 'branch' ? manifest.branch : manifest.head),
      exists: (p: string) => files.has(p),
      read: (p: string) => {
        if (p === resolve(CANDIDATE_ROOT, review)) return JSON.stringify(manifest);
        const b = files.get(p);
        if (!b) throw Error('MISSING');
        return b;
      },
    },
  };
}
test('reviewed consolidated candidate verifies exactly three migration hashes without legacy artifacts', () => {
  const f = fixture();
  const r = verifyCandidateBundle(f.options);
  assert.equal(r.candidateBundleIntegrityVerified, true);
  assert.equal(r.migrationCount, 3);
  assert.equal(r.productionWrites, false);
});
test('missing manifest and changed candidate file fail closed', () => {
  assert.throws(() =>
    verifyCandidateBundle({
      ...fixture().options,
      read: () => {
        throw Error('MISSING');
      },
    }),
  );
  const f = fixture();
  f.files.set(resolve(CANDIDATE_ROOT, Object.keys(MIGRATIONS)[0]), Buffer.from('tampered'));
  assert.throws(() => verifyCandidateBundle(f.options));
});
test('rewriting both migration bytes and editable manifest cannot replace reviewed migration pin', () => {
  const f = fixture(),
    p = Object.keys(MIGRATIONS)[0];
  f.files.set(resolve(CANDIDATE_ROOT, p), Buffer.from('tampered'));
  f.manifest.files[p] = sha('tampered');
  assert.throws(() => verifyCandidateBundle(f.options));
});
test('missing, reordered or additional migrations and competing migration are rejected', () => {
  for (const change of [
    (xs: string[]) => xs.slice(1),
    (xs: string[]) => xs.toReversed(),
    (xs: string[]) => [...xs, 'supabase/migrations/unreviewed.sql'],
  ]) {
    const f = fixture();
    f.manifest.newMigrations = change(f.manifest.newMigrations);
    assert.throws(() => verifyCandidateBundle(f.options));
  }
  const f = fixture();
  f.files.set(
    resolve(
      CANDIDATE_ROOT,
      'supabase/migrations/20261119024031_leaderboard_registered_full_name.sql',
    ),
    Buffer.from('competing'),
  );
  assert.throws(() => verifyCandidateBundle(f.options));
});
test('wrong working root, actual branch or HEAD cannot pass', () => {
  assert.throws(() =>
    verifyCandidateBundle({ ...fixture().options, root: resolve(CANDIDATE_ROOT, '..') }),
  );
  for (const value of ['other-branch', 'other-head'])
    assert.throws(() => verifyCandidateBundle({ ...fixture().options, git: () => value }));
});
test('both entry guards use consolidated verification while preserving freshness/storage/security gates', () => {
  for (const path of [
    '../scripts/verify-current-release-prerequisites.mjs',
    '../artifacts/week1-isolated/verify-current-release-prerequisites.mjs',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /verifyCandidateBundle\(/);
    assert.doesNotMatch(source, /production-week1-atomic/);
    for (const text of [
      'backupDataStillCurrent',
      'schemaAndSecurityCatalogExact',
      'featureGatesPreserved',
      'manifest.storageObjects',
    ])
      assert.ok(source.includes(text));
  }
});
