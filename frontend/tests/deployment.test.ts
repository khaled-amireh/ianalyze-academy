import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
test('Cloudflare CSP permits the existing preference script by hash, with no inline-script wildcard', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)![1]!.replace(/\r\n/g, '\n');
  const hash = createHash('sha256').update(source).digest('base64');
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.ok(headers.includes(`'sha256-${hash}'`));
  assert.match(headers, /script-src 'self' 'sha256-[^']+';/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /Referrer-Policy: no-referrer/);
});
test('Cloudflare default SPA fallback stays enabled without a catch-all asset rewrite', () => {
  assert.equal(existsSync(new URL('../public/404.html', import.meta.url)), false);
  const redirects = new URL('../public/_redirects', import.meta.url);
  if (existsSync(redirects))
    assert.doesNotMatch(readFileSync(redirects, 'utf8'), /^\/\*\s+\/index\.html\s+200\s*$/m);
});

test('video frames allow only the approved Drive and privacy-enhanced YouTube origins', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.equal(
    headers.match(/frame-src ([^;]+);/)?.[1],
    'https://drive.google.com https://www.youtube-nocookie.com',
  );
});
