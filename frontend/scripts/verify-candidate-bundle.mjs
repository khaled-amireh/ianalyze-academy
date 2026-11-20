import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, sep, isAbsolute } from 'node:path';

export const CANDIDATE_ROOT = resolve(
  'C:/Users/khale/Desktop/ianalyze-academy/.worktrees/academy-admin-consent-release-20261119',
);
const BRANCH = 'release/academy-admin-consent-20261119';
const HEAD = 'b57a26d7eac32004110b0d5aef4a18f6b94281bf';
const REVIEW = 'docs/audits/leaderboard-admin-release/candidate-manifest.json';
const EXCLUDED = 'supabase/migrations/20261119024031_leaderboard_registered_full_name.sql';
// Reviewed consolidated migration bytes, independent of editable manifest entries.
export const MIGRATIONS = Object.freeze({
  'supabase/migrations/20261119170000_leaderboard_name_consent.sql':
    '0b8e466fa8e086775320c39862810294bad12de312638fcad16e561d3c909dd9',
  'supabase/migrations/20261119170100_application_admins.sql':
    '5b81565bdcdc46131a6498d962e5cc51790e919713b0a6c0baca2bcb7acfbbb0',
  'supabase/migrations/20261119170200_admin_manual_point_awards.sql':
    'd7c1030367d193411bfb83eeefa8514b5310607ad79c8302a4a41876176d9da0',
});
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function verifyCandidateBundle({
  root = process.cwd(),
  read = readFileSync,
  exists = existsSync,
  git = (args) =>
    execFileSync('git', ['-c', `safe.directory=${CANDIDATE_ROOT}`, ...args], {
      cwd: CANDIDATE_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim(),
} = {}) {
  assert.equal(resolve(root), CANDIDATE_ROOT, 'CANDIDATE_ROOT_MISMATCH');
  assert.equal(git(['branch', '--show-current']), BRANCH, 'CANDIDATE_BRANCH_MISMATCH');
  assert.equal(git(['rev-parse', 'HEAD']), HEAD, 'CANDIDATE_HEAD_MISMATCH');
  const manifest = JSON.parse(read(resolve(root, REVIEW), 'utf8'));
  assert.equal(manifest.branch, BRANCH);
  assert.equal(manifest.head, HEAD);
  assert.equal(manifest.productionWrites, false);
  assert.equal(manifest.releaseAuthorizationRequired, true);
  assert.deepEqual(
    manifest.newMigrations,
    Object.keys(MIGRATIONS),
    'CANDIDATE_MIGRATION_SET_MISMATCH',
  );
  assert.equal(
    manifest.excludedCompetingMigration,
    '20261119024031_leaderboard_registered_full_name.sql',
  );
  assert.equal(exists(resolve(root, EXCLUDED)), false, 'COMPETING_MIGRATION_PRESENT');
  assert.ok(manifest.files && Object.keys(manifest.files).length >= Object.keys(MIGRATIONS).length);
  for (const [path, hash] of Object.entries(manifest.files)) {
    assert.equal(isAbsolute(path), false);
    assert.ok(resolve(root, path).startsWith(resolve(root) + sep), 'CANDIDATE_PATH_ESCAPE');
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(sha(read(resolve(root, path))), hash, 'CANDIDATE_FILE_HASH_MISMATCH');
  }
  for (const [path, expected] of Object.entries(MIGRATIONS)) {
    assert.equal(manifest.files[path], expected, 'REVIEWED_MIGRATION_HASH_MISMATCH');
    assert.equal(sha(read(resolve(root, path))), expected, 'REVIEWED_MIGRATION_BYTES_MISMATCH');
  }
  return {
    candidateBundleIntegrityVerified: true,
    candidateFileCount: Object.keys(manifest.files).length,
    migrationCount: Object.keys(MIGRATIONS).length,
    productionWrites: false,
  };
}
