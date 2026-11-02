import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { authIntegration } from './verify-merge-preservation.mjs';
const root = new URL('../../', import.meta.url);
const hash = (path) =>
  createHash('sha256')
    .update(readFileSync(new URL(path, root)))
    .digest('hex');
const baseline = JSON.parse(
  readFileSync(new URL('docs/phase-02/preserved-files.json', root), 'utf8'),
);
for (const [path, expected] of Object.entries(baseline))
  assert.equal(hash(path), expected, `Preserved file changed: ${path}`);
const portraits = JSON.parse(
  readFileSync(new URL('docs/phase-02/asset-provenance.json', root), 'utf8'),
);
for (const portrait of portraits)
  assert.equal(
    hash(`frontend/src/assets/team/${portrait.name}`),
    portrait.sourceSha256,
    `Original portrait changed: ${portrait.name}`,
  );
const frontendBefore = JSON.parse(
  readFileSync(new URL('docs/phase-02/frontend-before.json', root), 'utf8'),
);
assert.equal(
  hash('docs/phase-03/baseline/frontend-package-lock.json'),
  frontendBefore['frontend/package-lock.json'],
  'Historical dependency lock changed',
);
const oldLock = JSON.parse(
  readFileSync(new URL('docs/phase-03/baseline/frontend-package-lock.json', root), 'utf8'),
);
const currentLock = JSON.parse(readFileSync(new URL('frontend/package-lock.json', root), 'utf8'));
const additions = JSON.parse(
  readFileSync(new URL('docs/phase-03/approved-dependencies.json', root), 'utf8'),
);
const redesign = JSON.parse(
  readFileSync(new URL('docs/ui-redesign/approved-presentation-changes.json', root), 'utf8'),
);
const lockEntries = { ...additions.lockEntries, ...redesign.lockEntries };
for (const path of new Set([
  ...Object.keys(oldLock.packages),
  ...Object.keys(currentLock.packages),
  ...Object.keys(authIntegration.dependencyChanges ?? {}),
])) {
  if (!path) continue;
  const expected = Object.hasOwn(authIntegration.dependencyChanges ?? {}, path)
    ? authIntegration.dependencyChanges[path]
    : (lockEntries[path] ??
      (oldLock.packages[path]
        ? createHash('sha256').update(JSON.stringify(oldLock.packages[path])).digest('hex')
        : undefined));
  assert.notEqual(expected, undefined, `Unreviewed dependency addition: ${path}`);
  if (expected === null)
    assert.equal(currentLock.packages[path], undefined, `Reviewed removal changed: ${path}`);
  else
    assert.equal(
      createHash('sha256').update(JSON.stringify(currentLock.packages[path])).digest('hex'),
      expected,
      `Dependency drift: ${path}`,
    );
}
for (const section of ['dependencies', 'devDependencies']) {
  const expected = {
    ...oldLock.packages[''][section],
    ...additions[section],
    ...(section === 'dependencies' ? redesign.dependencies : {}),
  };
  assert.deepEqual(
    currentLock.packages[''][section],
    section === 'devDependencies' ? (authIntegration.releaseDevDependencies ?? expected) : expected,
  );
}
console.log(
  `Phase 02 integrity verified: ${Object.keys(baseline).length} prior files and portraits unchanged; historical lock and existing dependencies preserved; approved additions verified.`,
);
