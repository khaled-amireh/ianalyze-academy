import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import configuration from '../vite.config.ts';

const base = 'db4bb8eff14d2120107f756272c07eae4bda1341';
const root = new URL('../../', import.meta.url);
const original = (path: string) =>
  execFileSync('git', ['show', `${base}:${path}`], { cwd: root, encoding: 'utf8' });

test('production font output stays compatible with the unchanged restrictive CSP', () => {
  const policy = configuration.build?.assetsInlineLimit;
  assert.equal(typeof policy, 'function');
  if (typeof policy !== 'function') throw new Error('Font emission policy required');
  for (const file of ['small.woff2', 'large.woff', 'font.TTF', 'font.otf'])
    assert.equal(policy(file, Buffer.alloc(100)), false, file);
  assert.equal(
    policy('small.png', Buffer.alloc(100)),
    undefined,
    'other assets keep Vite defaults',
  );
  assert.equal(
    readFileSync(new URL('frontend/public/_headers', root), 'utf8'),
    original('frontend/public/_headers'),
    'No CSP or permissions relaxation',
  );
});

test('the authorized video redesign changes only its bilingual learning copy', () => {
  for (const locale of ['ar', 'en']) {
    const path = `frontend/src/locales/${locale}.json`;
    const current = JSON.parse(readFileSync(new URL(path, root), 'utf8'));
    const previous = JSON.parse(original(path));
    for (const key of ['expandVideo', 'closeVideo', 'playVideo', 'loadingVideo'])
      delete current.learning[key];
    current.learning.videos.kaggle = previous.learning.videos.kaggle;
    assert.deepEqual(current, previous, `${locale}: only reviewed video controls and Kaggle copy`);
  }
});

test('the scoped presentation fixes preserve assets, security, navigation and closed features', () => {
  const tree = new Map(
    execFileSync('git', ['ls-tree', '-r', base], {
      cwd: fileURLToPath(root),
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .map((line) => {
        const [metadata, path] = line.split('\t');
        return [path!, metadata!.split(' ')[2]!] as const;
      }),
  );
  const protectedFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', base], {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter((path) =>
      /^(?:supabase\/|\.github\/|frontend\/src\/(?:assets\/|features\/|lib\/|types\/))/.test(path),
    );
  protectedFiles.push(
    'frontend/src/components/layout/navbar.tsx',
    'frontend/src/components/layout/footer.tsx',
    'frontend/src/components/layout/brand-logo.tsx',
    'frontend/src/components/layout/mobile-navigation.tsx',
    'frontend/src/components/layout/page-transition.tsx',
    'frontend/src/components/layout/page-transition.css',
    'frontend/src/app/page-transition.ts',
    'frontend/src/app/app.tsx',
    'frontend/src/pages/public/syllabus-page.tsx',
    'frontend/src/content/learning-tools.ts',
    'frontend/scripts/build-pages-production.mjs',
    'frontend/package.json',
    'frontend/package-lock.json',
  );
  for (const path of protectedFiles) {
    const bytes = readFileSync(new URL(path, root));
    assert.equal(
      createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
      tree.get(path),
      path,
    );
  }
});
