import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { root } from './database-fixture.mjs';

const manifest = JSON.parse(
  readFileSync(new URL('docs/phase-03/baseline/preserved-frontend.json', root), 'utf8'),
);
for (const [path, hash] of Object.entries(manifest))
  assert.equal(
    createHash('sha256')
      .update(readFileSync(new URL(path, root)))
      .digest('hex'),
    hash,
    `Unrelated frontend/Yomna file changed: ${path}`,
  );
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
  `Phase 03 boundary verified: ${Object.keys(manifest).length} frontend/Yomna files preserved; tracked/new source secret-pattern scan clean.`,
);
