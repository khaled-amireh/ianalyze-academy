import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
function files(url) {
  return readdirSync(url, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? files(new URL(`${item.name}/`, url)) : [new URL(item.name, url)],
  );
}
const built = files(new URL('dist/', root));
const text = built
  .filter((url) => /\.(js|html|css|json)$/.test(url.pathname))
  .map((url) => readFileSync(url, 'utf8'))
  .join('\n');
for (const forbidden of [
  'IANALYZE_DEV_ONLY_01',
  '/_preview/',
  'team-syllabus.md',
  'Local development preview',
  'Workspace foundation / development only',
])
  assert.ok(!text.includes(forbidden), `Development/private material in production: ${forbidden}`);
assert.ok(
  !built.some((url) =>
    /dev-routes|workspace-foundation|component-gallery|team-syllabus|syllabus-page/.test(
      url.pathname,
    ),
  ),
  'Unexpected preview/private/unreleased asset',
);
const baseline = JSON.parse(
  readFileSync(new URL('../docs/phase-01/preserved-phase00.json', root), 'utf8'),
);
for (const [name, hash] of Object.entries(baseline)) {
  const actual = createHash('sha256')
    .update(readFileSync(new URL(`../${name}`, root)))
    .digest('hex');
  assert.equal(actual, hash, `Phase 00 file changed: ${name}`);
}
for (const name of ['ianalyze-logo.png', 'iteam-logo.png'])
  assert.ok(
    readFileSync(new URL(`src/assets/${name}`, root)).equals(
      readFileSync(new URL(`../design-preview/assets/${name}`, root)),
    ),
    `Logo modified: ${name}`,
  );
console.log(
  `Production boundary verified across ${built.length} build files; ${Object.keys(baseline).length} Phase 00 files unchanged; both logos byte-identical.`,
);
