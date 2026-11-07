// Local-only production-mode fixture. No real keys, remote writes, or deployment.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const frontend = fileURLToPath(new URL('../', import.meta.url));
const argument = (name) =>
  process.argv.find((s) => s.startsWith(`--${name}=`))?.slice(name.length + 3);
const suppliedDirectory = argument('directory');
const directory = resolve(
  repository,
  suppliedDirectory || 'frontend/artifacts/pre-presentation-fixes/dist',
);
const port = Number(argument('port') || 4193);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);

if (!suppliedDirectory) {
  const envDir = resolve(frontend, 'artifacts/pre-presentation-fixes/empty-environment');
  mkdirSync(envDir, { recursive: true });
  assert.equal(readdirSync(envDir).length, 0, 'Fixture environment directory must remain empty');
  for (const name of Object.keys(process.env))
    if (name.startsWith('VITE_')) delete process.env[name];
  Object.assign(process.env, {
    VITE_SUPABASE_URL: 'https://audit-fixture.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_LOCAL_FIXTURE_ONLY_123456789',
    VITE_ENABLE_DEV_PREVIEWS: 'false',
    VITE_ENABLE_REGISTRATION: 'true',
    VITE_PRIVACY_APPROVED: 'true',
    VITE_ENABLE_SUBMISSIONS: 'false',
    VITE_ENABLE_LEADERBOARD: 'false',
  });
  await build({
    root: frontend,
    configFile: resolve(frontend, 'vite.config.ts'),
    envDir,
    mode: 'production',
    build: { outDir: directory },
  });
}

assert.ok(
  existsSync(resolve(directory, 'index.html')) && existsSync(resolve(directory, '_headers')),
);
if (!process.argv.includes('--build-only')) {
  const headerText = readFileSync(resolve(directory, '_headers'), 'utf8');
  const headers = Object.fromEntries(
    headerText
      .split(/\r?\n/)
      .filter((line) => /^ {2}[\w-]+:/.test(line))
      .map((line) => {
        const colon = line.indexOf(':');
        return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
      })
      .filter(([name]) => name !== 'Cache-Control'),
  );
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.json': 'application/json',
  };
  createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405);
      response.end();
      return;
    }
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = resolve(directory, '.' + path);
    if (file !== directory && !file.startsWith(directory + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      if (extname(path) && !path.endsWith('.html')) {
        response.writeHead(404, headers);
        response.end();
        return;
      }
      file = resolve(directory, 'index.html');
    }
    response.writeHead(200, {
      ...headers,
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': path.startsWith('/auth/') ? 'no-store' : 'no-cache',
    });
    response.end(request.method === 'HEAD' ? undefined : readFileSync(file));
  }).listen(port, '127.0.0.1', () => {
    console.log(`Local CSP-preserving fixture: http://127.0.0.1:${port}`);
    console.log(
      'Synthetic backend only. Browser tests intercept requests; no production credentials used.',
    );
  });
}
