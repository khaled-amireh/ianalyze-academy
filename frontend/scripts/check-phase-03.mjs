import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { root } from './database-fixture.mjs';
import { mergeResolution, verifyMergePreservation } from './verify-merge-preservation.mjs';

const manifest = JSON.parse(
  readFileSync(new URL('docs/phase-03/baseline/preserved-frontend.json', root), 'utf8'),
);
// Phase 04 explicitly authorizes route wiring and a configured-account navigation link.
// Preserve the original bytes as well as the untouched manifest hashes.
const integration = JSON.parse(
  readFileSync(new URL('docs/phase-04/approved-integration-files.json', root), 'utf8'),
);
assert.deepEqual(Object.keys(integration).sort(), [
  'frontend/src/app/app.tsx',
  'frontend/src/components/layout/navbar.tsx',
]);
const redesign = JSON.parse(
  readFileSync(new URL('docs/ui-redesign/approved-presentation-changes.json', root), 'utf8'),
);
verifyMergePreservation();
for (const [path, hash] of Object.entries(manifest)) {
  if (redesign.replacedFrontendFiles.includes(path) || mergeResolution.resolvedFiles[path])
    continue;
  assert.equal(
    createHash('sha256')
      .update(readFileSync(new URL(integration[path] ?? path, root)))
      .digest('hex'),
    hash,
    `Unrelated frontend/Yomna file changed: ${path}`,
  );
}
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
for (const path of files) {
  assert.ok(
    !/(?:^|\/)\.env(?:\.|$)/.test(path) || path.endsWith('.example'),
    `Real environment tracked: ${path}`,
  );
  if (!/\.(?:md|json|ts|tsx|mjs|sql|toml|example)$/.test(path)) continue;
  const text = readFileSync(new URL(path, root), 'utf8');
  for (const pattern of [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /sb_secret_[A-Za-z0-9_-]{24,}/,
    /gh[pousr]_[A-Za-z0-9]{30,}/,
    /(?:AKIA|ASIA)[A-Z0-9]{16}/,
  ])
    assert.ok(!pattern.test(text), `Possible secret in ${path}`);
}
const example = readFileSync(new URL('frontend/.env.example', root), 'utf8');
assert.match(example, /^VITE_ENABLE_DEV_PREVIEWS=false$/m);
assert.match(example, /^VITE_SUPABASE_URL=$/m);
assert.match(example, /^VITE_SUPABASE_PUBLISHABLE_KEY=$/m);
console.log(
  'Phase 03 boundaries verified: unchanged historical files preserved; approved redesign/integration resolutions hash-pinned; source secret-pattern scan clean.',
);
