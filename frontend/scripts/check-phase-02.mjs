import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
for (const [path, entry] of Object.entries(oldLock.packages)) {
  if (path)
    assert.deepEqual(currentLock.packages[path], entry, `Existing dependency changed: ${path}`);
}
for (const section of ['dependencies', 'devDependencies']) {
  assert.deepEqual(currentLock.packages[''][section], {
    ...oldLock.packages[''][section],
    ...additions[section],
    ...(section === 'dependencies' ? redesign.dependencies : {}),
  });
}
const added = Object.keys(currentLock.packages).filter((path) => !(path in oldLock.packages));
assert.deepEqual(added.sort(), Object.keys(lockEntries).sort(), 'Unapproved dependency additions');
for (const path of added)
  assert.equal(
    createHash('sha256').update(JSON.stringify(currentLock.packages[path])).digest('hex'),
    lockEntries[path],
    `New dependency drift: ${path}`,
  );
console.log(
  `Phase 02 integrity verified: ${Object.keys(baseline).length} prior files and portraits unchanged; historical lock and existing dependencies preserved; approved additions verified.`,
);
