import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { requirePagesTarget, requireReleaseCi, target } from './release-target.mjs';

const checkOnly = process.argv.includes('--check-only');
requirePagesTarget();
if (!checkOnly) requireReleaseCi();
if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error('Cloudflare Actions secret is missing.');
const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${target.account}/pages/projects/${target.pagesProject}`,
  {
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
    signal: AbortSignal.timeout(15000),
  },
);
const body = await response.json();
if (
  !response.ok ||
  !body.success ||
  body.result?.name !== target.pagesProject ||
  body.result?.subdomain !== 'ianalyze-academy.pages.dev' ||
  body.result?.production_branch !== target.productionBranch ||
  body.result?.source
)
  throw new Error('Pages token/project check failed; no project will be created or deployed.');
console.log('Existing Direct Upload project and production branch label verified.');
if (!checkOnly) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  if (
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() !==
    process.env.GITHUB_SHA
  )
    throw new Error('Checked-out commit differs from the push being deployed.');
  execFileSync(process.execPath, ['scripts/check-pages-artifact.mjs', '--configured'], {
    cwd: root,
    stdio: 'inherit',
  });
  try {
    execFileSync(
      process.execPath,
      [
        'node_modules/wrangler/bin/wrangler.js',
        'pages',
        'deploy',
        fileURLToPath(new URL('../dist/', import.meta.url)),
        '--project-name',
        target.pagesProject,
        '--branch',
        target.productionBranch,
        '--commit-hash',
        process.env.GITHUB_SHA,
        '--commit-dirty=false',
        '--commit-message',
        `Reviewed push ${process.env.GITHUB_SHA}`,
      ],
      {
        cwd: root,
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 240000,
      },
    );
  } catch {
    throw new Error(
      'Pages upload failed; inspect Cloudflare deployment status. Credentials suppressed.',
    );
  }
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const expected = digest(readFileSync(new URL('../dist/index.html', import.meta.url)));
  let verified = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const live = await fetch(`${target.origin}/?release=${process.env.GITHUB_SHA}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (live.ok && digest(Buffer.from(await live.arrayBuffer())) === expected) {
      verified = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!verified)
    throw new Error('Uploaded build has not verified on the canonical production alias.');
  const callback = await fetch(`${target.origin}/auth/callback`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!callback.ok || !callback.headers.get('cache-control')?.includes('no-store'))
    throw new Error('Production callback route or no-store policy failed verification.');
  console.log(`Production artifact verified at ${target.origin}; feature gates remain closed.`);
}
