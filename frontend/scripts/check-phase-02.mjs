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
  hash('frontend/package-lock.json'),
  frontendBefore['frontend/package-lock.json'],
  'Dependency lock changed',
);
console.log(
  `Phase 02 integrity verified: ${Object.keys(baseline).length} prior files preserved; both supplied portraits unchanged; dependency lock unchanged.`,
);
