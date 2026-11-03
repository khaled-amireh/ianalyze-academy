import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('all iAnalyze logo assets and the shared logo layout remain byte-identical to the requested baseline', () => {
  const root = new URL('../../', import.meta.url);
  const baseline = JSON.parse(
    readFileSync(new URL('docs/final-quality/branding-preservation.json', root), 'utf8'),
  ) as { files: Record<string, string> };
  assert.ok(Object.keys(baseline.files).length >= 9);
  for (const [path, hash] of Object.entries(baseline.files))
    assert.equal(
      createHash('sha256')
        .update(readFileSync(new URL(path, root)))
        .digest('hex'),
      hash,
      path,
    );
});
