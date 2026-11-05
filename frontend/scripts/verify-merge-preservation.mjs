import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
export const mergeResolution = JSON.parse(
  readFileSync(new URL('docs/merge-integration/resolution.json', root), 'utf8'),
);
export const authIntegration = JSON.parse(
  readFileSync(new URL('docs/supabase-auth-integration/approved-changes.json', root), 'utf8'),
);
// Current user-authorized refinement, pinned separately from historical approvals.
export const qualityUpdate = JSON.parse(
  readFileSync(new URL('docs/final-quality/approved-changes.json', root), 'utf8'),
);
export const finalUpdate = JSON.parse(
  readFileSync(new URL('docs/final-improvements/approved-changes.json', root), 'utf8'),
);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
function tree(commit) {
  return new Map(
    git('ls-tree', '-r', '-z', commit)
      .split('\0')
      .filter(Boolean)
      .map((line) => {
        const [, mode, type, sha, path] = line.match(/^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/s);
        assert.equal(type, 'blob', `Unexpected nested repository at ${path}`);
        assert.notEqual(mode, '160000', `Unexpected Git link at ${path}`);
        return [path, sha];
      }),
  );
}

export function verifyMergePreservation() {
  const { functionalCommit, redesignCommit, baseCommit } = mergeResolution;
  assert.equal(git('merge-base', authIntegration.baseCommit, 'HEAD'), authIntegration.baseCommit);
  const resolvedFiles = { ...mergeResolution.resolvedFiles };
  for (const [path, resolution] of Object.entries(authIntegration.files))
    resolvedFiles[path] = { ...resolvedFiles[path], ...resolution };
  assert.equal(git('merge-base', qualityUpdate.baseCommit, 'HEAD'), qualityUpdate.baseCommit);
  const qualityBaseline = tree(qualityUpdate.baseCommit);
  for (const [path, resolution] of Object.entries(qualityUpdate.files)) {
    assert.ok(resolution.reason, `Quality update reason missing: ${path}`);
    if (resolution.added) {
      assert.ok(!qualityBaseline.has(path), `Quality addition already existed: ${path}`);
    } else {
      assert.equal(
        createHash('sha256')
          .update(
            execFileSync('git', ['show', `${qualityUpdate.baseCommit}:${path}`], { cwd: root }),
          )
          .digest('hex'),
        resolution.previousSha256,
        `Quality update baseline changed: ${path}`,
      );
    }
    resolvedFiles[path] = { ...resolvedFiles[path], ...resolution };
  }
  assert.equal(git('merge-base', functionalCommit, redesignCommit), baseCommit);
  assert.equal(git('merge-base', finalUpdate.baseCommit, 'HEAD'), finalUpdate.baseCommit);
  const finalBaseline = tree(finalUpdate.baseCommit);
  for (const [path, resolution] of Object.entries(finalUpdate.files)) {
    assert.ok(resolution.reason, `Final improvement reason missing: ${path}`);
    if (resolution.added) assert.ok(!finalBaseline.has(path), `Addition already existed: ${path}`);
    else
      assert.equal(
        createHash('sha256')
          .update(execFileSync('git', ['show', `${finalUpdate.baseCommit}:${path}`], { cwd: root }))
          .digest('hex'),
        resolution.previousSha256,
        `Final improvement baseline changed: ${path}`,
      );
    resolvedFiles[path] = { ...resolvedFiles[path], ...resolution };
  }
  const base = tree(baseCommit);
  const functional = tree(functionalCommit);
  const redesign = tree(redesignCommit);
  const expected = new Map(functional);
  // The redesign owns its changed presentation files; functional delivery owns the rest.
  for (const [path, sha] of redesign) if (sha !== base.get(path)) expected.set(path, sha);
  for (const path of base.keys()) if (!redesign.has(path)) expected.delete(path);
  for (const path of Object.keys(resolvedFiles))
    assert.ok(expected.has(path) || resolvedFiles[path].added, `Unrecorded addition: ${path}`);
  for (const path of new Set([...expected.keys(), ...Object.keys(resolvedFiles)])) {
    const resolved = resolvedFiles[path];
    if (resolved?.removed) {
      assert.ok(resolved.reason, `Removal reason missing: ${path}`);
      assert.equal(existsSync(new URL(path, root)), false, `Retired asset restored: ${path}`);
      continue;
    }
    const bytes = readFileSync(new URL(path, root));
    if (resolved) {
      assert.ok(resolved.reason, `Resolution reason missing: ${path}`);
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        resolved.sha256,
        `Reviewed integration file changed: ${path}`,
      );
    } else {
      assert.equal(
        createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
        expected.get(path),
        `Inherited file changed: ${path}`,
      );
    }
  }
  console.log(
    `Merge preservation passed: ${expected.size} inherited files; ${Object.keys(resolvedFiles).length} explicit, hash-pinned integration resolutions.`,
  );
}
