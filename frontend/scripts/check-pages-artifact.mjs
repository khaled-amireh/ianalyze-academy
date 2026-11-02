import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
function files(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`)
      : [{ path: `${prefix}${entry.name}`, url: new URL(entry.name, directory) }],
  );
}
const entries = files(dist);
for (const { path, url } of entries) {
  assert.ok(
    !/(?:^|\/)\.env(?:[./]|$)/.test(path) &&
      !/(?:^|\/)(?:node_modules|supabase|docs|artifacts)(?:\/|$)/.test(path),
    `Private/source path in artifact: ${path}`,
  );
  assert.ok(!/\.(?:map|tsx?|sql|ipynb)$/.test(path), `Unexpected source/notebook: ${path}`);
  assert.ok(statSync(url).size < 25 * 1024 * 1024, `Pages asset exceeds 25 MiB: ${path}`);
}
const html = readFileSync(new URL('index.html', dist), 'utf8');
const headers = readFileSync(new URL('_headers', dist), 'utf8');
assert.equal(
  existsSync(new URL('404.html', dist)),
  false,
  'Top-level 404 disables Pages SPA fallback',
);
if (existsSync(new URL('_redirects', dist)))
  assert.doesNotMatch(
    readFileSync(new URL('_redirects', dist), 'utf8'),
    /^\/\*\s+\/index\.html\s+200\s*$/m,
    'Catch-all proxy would override static assets',
  );
assert.equal(headers, readFileSync(new URL('public/_headers', root), 'utf8'));
for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  if (!script[1].trim()) continue;
  const hash = createHash('sha256').update(script[1].replace(/\r\n/g, '\n')).digest('base64');
  assert.ok(
    headers.includes(`'sha256-${hash}'`),
    'Built inline preference script must match CSP hash',
  );
}
const texts = entries
  .filter((x) => /\.(?:js|html|css|json)$/.test(x.path))
  .map((x) => readFileSync(x.url, 'utf8'))
  .join('\n');
for (const pattern of [
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /sb_publishable_[A-Za-z0-9_-]{20,}/,
  /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
])
  assert.ok(!pattern.test(texts), 'Possible credential in Pages artifact');
for (const forbidden of [
  'http://127.0.0.1:54321',
  'http://localhost:54321',
  'IANALYZE_DEV_ONLY_01',
  '/_preview/',
  'ocihwiqtgqplwgyhpwjv.supabase.co',
  'This is a draft privacy notice for iAnalyze Academy',
])
  assert.ok(!texts.includes(forbidden), `Test/preview material in artifact: ${forbidden}`);
const manifest = entries.map(({ path, url }) => ({
  path,
  bytes: statSync(url).size,
  sha256: createHash('sha256').update(readFileSync(url)).digest('hex'),
}));
writeFileSync(
  new URL('artifacts/pages-artifact-manifest.json', root),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  `Pages artifact passed: ${entries.length} files; SPA rule and CSP verified; no local backend, source maps or credential patterns.`,
);
