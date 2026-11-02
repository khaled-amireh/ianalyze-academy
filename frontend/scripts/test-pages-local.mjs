// Start `wrangler pages dev dist --ip 127.0.0.1 --port 4177` first. Never a hosted URL.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const origin = 'http://127.0.0.1:4177';
const dist = new URL('../dist/', import.meta.url);
const expectedHtml = readFileSync(new URL('index.html', dist), 'utf8');
const routes = [
  '/',
  '/about',
  '/eda',
  '/videos',
  '/team',
  '/join',
  '/leaderboard',
  '/contact',
  '/login',
  '/auth/recover',
  '/auth/callback',
  '/student',
  '/workspace',
  '/privacy',
];
for (const path of routes) {
  const response = await fetch(origin + path, { redirect: 'manual' });
  assert.equal(response.status, 200, `${path}: SPA document response`);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.equal(await response.text(), expectedHtml, `${path}: root document fallback`);
  assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  if (path.startsWith('/auth/')) assert.equal(response.headers.get('cache-control'), 'no-store');
}
const manifest = JSON.parse(
  readFileSync(new URL('../artifacts/pages-artifact-manifest.json', import.meta.url), 'utf8'),
);
let assets = 0;
for (const file of manifest.filter((x) => x.path.startsWith('assets/'))) {
  const response = await fetch(origin + '/' + file.path, { redirect: 'manual' });
  assert.equal(response.status, 200, file.path);
  const actual = createHash('sha256')
    .update(new Uint8Array(await response.arrayBuffer()))
    .digest('hex');
  assert.equal(actual, file.sha256, `${file.path}: actual asset, not rewritten HTML`);
  if (file.path.endsWith('.js'))
    assert.match(response.headers.get('content-type') ?? '', /javascript/);
  if (file.path.endsWith('.css'))
    assert.match(response.headers.get('content-type') ?? '', /text\/css/);
  assets++;
}
console.log(
  `Local Cloudflare Pages passed: ${routes.length} direct SPA paths, ${assets} byte-exact assets, CSP/referrer headers and callback no-store policy.`,
);
