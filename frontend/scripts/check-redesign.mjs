import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mergeResolution, verifyMergePreservation } from './verify-merge-preservation.mjs';
const root = new URL('../../', import.meta.url);
const json = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const hash = (content) => createHash('sha256').update(content).digest('hex');
const approved = json('docs/ui-redesign/approved-presentation-changes.json');
const baseline = json('docs/phase-03/baseline/preserved-frontend.json');
verifyMergePreservation();
for (const [path, expected] of Object.entries(baseline)) {
  if (approved.replacedFrontendFiles.includes(path) || mergeResolution.resolvedFiles[path])
    continue;
  assert.equal(
    hash(readFileSync(new URL(path, root))),
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
for (const [path, entry] of Object.entries(previous.packages)) {
  if (path) assert.deepEqual(current.packages[path], entry, `Existing dependency drift: ${path}`);
}
assert.deepEqual(current.packages[''].dependencies, {
  ...previous.packages[''].dependencies,
  ...approved.dependencies,
});
assert.deepEqual(current.packages[''].devDependencies, previous.packages[''].devDependencies);
const added = Object.keys(current.packages).filter((path) => !(path in previous.packages));
assert.deepEqual(added.sort(), Object.keys(approved.lockEntries).sort());
for (const path of added)
  assert.equal(hash(JSON.stringify(current.packages[path])), approved.lockEntries[path]);
const paths = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
for (const path of paths) {
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
    !/^(supabase\/|frontend\/src\/(features\/auth\/|lib\/(academy-data|supabase)|types\/database)|frontend\/\.env|\.github\/|.*wrangler)/.test(
      path,
    ),
    `Protected integration changed: ${path}`,
  );
console.log(
  `Redesign integrity passed: historical files outside the explicit presentation list preserved; ${added.length} pinned package additions; backend/auth boundaries and source secret scan clean.`,
);
