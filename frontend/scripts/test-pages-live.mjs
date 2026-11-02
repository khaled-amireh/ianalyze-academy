// Read-only verification of the approved first public-site deployment.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const deploymentId = '12bce49f-9d9f-4168-a22e-b57f5d8ab5a1';
const origins = [
  'https://ianalyze-academy.pages.dev',
  'https://12bce49f.ianalyze-academy.pages.dev',
];
const manifestBytes = readFileSync(
  new URL('../../docs/phase-04/pages-artifact-manifest.json', import.meta.url),
);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(
  sha(manifestBytes),
  '0f85151d0534d518798b0241c1979ec7a3a43061edc499bc44cb27205107c0f2',
);
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.length, 18);
const html = manifest.find((file) => file.path === 'index.html');
const policy = readFileSync(new URL('../dist/_headers', import.meta.url), 'utf8');
assert.equal(sha(Buffer.from(policy)), manifest.find((file) => file.path === '_headers').sha256);
const csp = policy.match(/^\s+Content-Security-Policy: (.+)$/m)[1];
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
  '/auth/reset',
  '/student',
  '/workspace',
  '/privacy',
  '/_preview/',
];
const checks = [];
function checkHeaders(response) {
  assert.equal(response.headers.get('content-security-policy'), csp);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(
    response.headers.get('permissions-policy'),
    'camera=(), microphone=(), geolocation=()',
  );
}
for (const origin of origins) {
  await Promise.all(
    manifest
      .filter((file) => file.path !== '_headers')
      .map(async (file) => {
        // Pages canonically redirects /index.html to /; hash the root response.
        const publicPath = file.path === 'index.html' ? '/' : '/' + file.path;
        const response = await fetch(origin + publicPath, {
          redirect: 'manual',
          signal: AbortSignal.timeout(30000),
        });
        assert.equal(response.status, 200, `${origin}/${file.path}`);
        checkHeaders(response);
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(bytes.length, file.bytes, file.path);
        assert.equal(sha(bytes), file.sha256, `${file.path}: remote bytes differ`);
        if (file.path.endsWith('.js'))
          assert.match(response.headers.get('content-type') ?? '', /javascript/);
        if (file.path.endsWith('.css'))
          assert.match(response.headers.get('content-type') ?? '', /text\/css/);
        checks.push({ origin, path: '/' + file.path, bytes: bytes.length, sha256: sha(bytes) });
      }),
  );
  for (const path of routes) {
    const response = await fetch(origin + path, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 200, origin + path);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    checkHeaders(response);
    assert.equal(sha(Buffer.from(await response.arrayBuffer())), html.sha256, path);
    if (path.startsWith('/auth/'))
      assert.equal(response.headers.get('cache-control'), 'no-store', path);
  }
  // Pages interprets _headers as configuration; it is not a public asset.
  const internal = await fetch(origin + '/_headers', { signal: AbortSignal.timeout(30000) });
  assert.equal(sha(Buffer.from(await internal.arrayBuffer())), html.sha256);
  console.log(`${origin}: 17 byte-exact files, 16 SPA paths, headers and private config passed.`);
}
const redirect = await fetch('http://ianalyze-academy.pages.dev/', {
  redirect: 'manual',
  signal: AbortSignal.timeout(30000),
});
assert.ok([301, 302, 307, 308].includes(redirect.status));
assert.equal(redirect.headers.get('location'), 'https://ianalyze-academy.pages.dev/');
await redirect.body?.cancel();
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../artifacts/pages-live-http.json', import.meta.url),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      deploymentId,
      manifestSha256: sha(manifestBytes),
      origins,
      routes,
      checks,
      httpsRedirect: true,
      headersVerified: true,
    },
    null,
    2,
  ) + '\n',
);
