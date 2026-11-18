import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  authIntegration,
  mergeResolution,
  qualityUpdate,
  finalUpdate,
  prePresentationUpdate,
  readinessBaseline,
  verifyMergePreservation,
} from './verify-merge-preservation.mjs';
const root = new URL('../../', import.meta.url);
const json = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const hash = (content) => createHash('sha256').update(content).digest('hex');

// Check the complete Git inventory, including untracked workflows, before text filtering.
// Workflow approvals remain exact paths and SHA-256 pins in the existing approval record.
export function verifyWorkflowInventory(paths, read = (path) => readFileSync(new URL(path, root))) {
  for (const path of paths) {
    if (!/^\.github\/workflows\/.*\.ya?ml$/i.test(path)) continue;
    const approval = finalUpdate.files[path];
    assert.ok(
      Object.hasOwn(finalUpdate.files, path) &&
        !approval.removed &&
        /^[a-f0-9]{64}$/.test(approval.sha256 ?? ''),
      `Unapproved workflow: ${path}`,
    );
    assert.equal(hash(read(path)), approval.sha256, `Reviewed workflow changed: ${path}`);
  }
}
const approved = json('docs/ui-redesign/approved-presentation-changes.json');
const baseline = json('docs/phase-03/baseline/preserved-frontend.json');
verifyMergePreservation();
const existingMigrations = new Set(
  execFileSync(
    'git',
    ['ls-tree', '-r', '--name-only', readinessBaseline.baseCommit, '--', 'supabase/migrations/'],
    { cwd: root, encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean),
);
const reviewedMigrations = new Map(Object.entries(readinessBaseline.addedMigrations));
for (const [path, expected] of reviewedMigrations) {
  assert.match(path, /^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/);
  assert.ok(
    !existingMigrations.has(path),
    `Reviewed migration is already in the baseline: ${path}`,
  );
  assert.equal(
    hash(readFileSync(new URL(path, root))),
    expected,
    `Reviewed migration changed: ${path}`,
  );
}
for (const [path, expected] of Object.entries(baseline)) {
  if (approved.replacedFrontendFiles.includes(path) || mergeResolution.resolvedFiles[path])
    continue;
  assert.equal(
    hash(readFileSync(new URL(path, root))),
    readinessBaseline.files[path]?.sha256 ??
      prePresentationUpdate.files[path]?.sha256 ??
      finalUpdate.files[path]?.sha256 ??
      qualityUpdate.files[path]?.sha256 ??
      authIntegration.files[path]?.sha256 ??
      expected,
    `Preserved historical file changed: ${path}`,
  );
}
const previous = JSON.parse(
  execFileSync('git', ['show', `${approved.baseCommit}:frontend/package-lock.json`], {
    cwd: root,
    encoding: 'utf8',
  }),
);
const current = json('frontend/package-lock.json');
// Preserve the original lock freeze except for individually reviewed release/security deltas.
for (const path of new Set([
  ...Object.keys(previous.packages),
  ...Object.keys(current.packages),
  ...Object.keys(authIntegration.dependencyChanges ?? {}),
])) {
  if (!path) continue;
  const reviewed = Object.hasOwn(authIntegration.dependencyChanges ?? {}, path)
    ? authIntegration.dependencyChanges[path]
    : (approved.lockEntries[path] ??
      (previous.packages[path] ? hash(JSON.stringify(previous.packages[path])) : undefined));
  assert.notEqual(reviewed, undefined, `Unreviewed dependency addition: ${path}`);
  if (reviewed === null)
    assert.equal(current.packages[path], undefined, `Reviewed dependency removal changed: ${path}`);
  else
    assert.equal(
      hash(JSON.stringify(current.packages[path])),
      reviewed,
      `Dependency drift: ${path}`,
    );
}
assert.deepEqual(current.packages[''].dependencies, {
  ...previous.packages[''].dependencies,
  ...approved.dependencies,
});
assert.deepEqual(
  current.packages[''].devDependencies,
  authIntegration.releaseDevDependencies ?? previous.packages[''].devDependencies,
);
const added = Object.keys(current.packages).filter((path) => !(path in previous.packages));
const paths = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
verifyWorkflowInventory(paths);
for (const path of paths) {
  if (path.startsWith('supabase/migrations/') && !existingMigrations.has(path)) {
    assert.ok(reviewedMigrations.has(path), `Protected integration changed: ${path}`);
  }
  assert.ok(
    !/(?:^|\/)\.env(?:\.|$)/.test(path) || path.endsWith('.example'),
    `Real environment tracked: ${path}`,
  );
  if (!/\.(?:md|json|ts|tsx|mjs|sql|toml|example)$/.test(path)) continue;
  const content = readFileSync(new URL(path, root), 'utf8');
  for (const pattern of [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /sb_secret_[A-Za-z0-9_-]{24,}/,
    /gh[pousr]_[A-Za-z0-9]{30,}/,
    /(?:AKIA|ASIA)[A-Z0-9]{16}/,
  ])
    assert.ok(!pattern.test(content), `Possible secret in ${path}`);
}
const changed = execFileSync('git', ['diff', mergeResolution.functionalCommit, '--name-only'], {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);
for (const path of changed)
  assert.ok(
    reviewedMigrations.has(path) ||
      readinessBaseline.files[path] ||
      authIntegration.files[path] ||
      prePresentationUpdate.files[path] ||
      finalUpdate.files[path] ||
      qualityUpdate.files[path] ||
      !/^(supabase\/|frontend\/src\/(features\/auth\/|lib\/(academy-data|supabase)|types\/database)|frontend\/\.env|\.github\/|.*wrangler)/.test(
        path,
      ),
    `Protected integration changed: ${path}`,
  );
console.log(
  `Redesign integrity passed: historical files outside the explicit presentation list preserved; ${added.length} pinned package additions; backend/auth boundaries and source secret scan clean.`,
);
