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
// Current registration/profile work is separately pinned; every other historical
// presentation boundary remains checked against its original baseline.
const registrationUpdate = JSON.parse(
  readFileSync(new URL('docs/student-registration/approved-changes.json', root), 'utf8'),
);
const databaseBoundaryUpdateSha256 =
  'bd893f8f118a5694f6a31a28f1bda902db40539f7539719a5a29d8f595153805';

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
    // Explicitly authorized Power BI course copy; preserve every other
    // historical locale field, including registration, team and privacy copy.
    const coursePaths = JSON.parse(
      readFileSync(new URL('frontend/tests/fixtures/powerbi-copy-paths.json', root), 'utf8'),
    ) as string[];
    for (const key of coursePaths) {
      const parts = key.split('.'),
        field = parts.pop()!;
      const target = parts.reduce((value, part) => value[part], current);
      const source = parts.reduce((value, part) => value[part], previous);
      target[field] = source[field];
    }
    for (const key of ['about', 'leaderboard', 'aiTools']) current.nav[key] = previous.nav[key];
    delete current.week1; // Week 1 copy is checked separately; historical copy stays fixed.
    current.simple.needText = previous.simple.needText; // Requested Power BI/Kaggle prerequisite copy is separately tested.
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
    // Explicitly authorized assignment/leaderboard host integration points.
    // Real database and authenticated browser tests cover their new behavior;
    // all other historical boundaries retain the original byte comparisons.
    if (
      new Set([
        'frontend/src/features/portal/team-page.tsx',
        'frontend/src/features/portal/student-page.tsx',
        'frontend/src/features/portal/leaderboard.tsx',
        'frontend/src/features/portal/announcements.tsx',
        'frontend/src/features/portal/profile-page.tsx',
        'frontend/src/app/navigation.ts',
        'frontend/src/components/layout/navbar.tsx',
        'frontend/src/features/portal/privacy-page.tsx',
        'frontend/src/lib/i18n.ts',
        'frontend/src/types/i18next.d.ts',
        'frontend/src/app/app.tsx',
      ]).has(path)
    )
      continue;
    let bytes = readFileSync(new URL(path, root));
    if (path === '.github/workflows/production.yml') {
      const approval = JSON.parse(
        readFileSync(new URL('docs/final-improvements/approved-changes.json', root), 'utf8'),
      ).files[path];
      assert.ok(approval?.reason, path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), approval.sha256, path);
      continue;
    }
    if (
      path === 'frontend/scripts/build-pages-production.mjs' ||
      path === 'frontend/package.json'
    ) {
      // Current exact approval includes independent feature gates and the additive security suite.
      const approval = JSON.parse(
        readFileSync(
          new URL(
            path === 'frontend/package.json'
              ? 'docs/audits/readiness-baselines.json'
              : 'docs/pre-presentation-fixes/approved-changes.json',
            root,
          ),
          'utf8',
        ),
      ).files[path];
      assert.ok(approval?.reason, path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), approval.sha256, path);
      continue;
    }
    if (path === 'frontend/src/content/learning-tools.ts') {
      // Only the requested course/optional grouping changes. Keep all tool
      // destinations, installation instructions and examples byte-for-byte.
      bytes = Buffer.from(
        bytes
          .toString()
          .replace(/(id: 'google-colab',[\s\S]*?category: )'local'/, "$1'course'")
          .replace(/(id: 'power-bi',[\s\S]*?category: )'course'/, "$1'visualization'"),
      );
    }
    // Permit only the additive integration points authorized for Week 1. Strip
    // those additions and keep checking every historical byte against baseline.
    if (path === 'frontend/src/pages/public/syllabus-page.tsx')
      bytes = Buffer.from(
        bytes
          .toString()
          .replace("import { Week1Entry } from '@/features/week1/week1-entry';\n", '')
          .replace('      <Week1Entry />\n', ''),
      );
    if (path === 'frontend/src/app/app.tsx')
      bytes = Buffer.from(
        bytes
          .toString()
          .replace(/const Week1Page = lazy\([\s\S]*?\n\);\n/, '')
          .replace('          <Route path="eda/week-1" element={<Week1Page />} />\n', '')
          .replace('          <Route path="eda/week-1/:activity" element={<Week1Page />} />\n', ''),
      );
    if (path === 'frontend/package.json')
      bytes = Buffer.from(
        bytes
          .toString()
          .replace(' tests/week1.security.test.mjs', '')
          .replace(' tests/assignments.security.test.mjs', '')
          .replace(' tests/scoring.security.test.mjs', '')
          .replace(' tests/drafts.security.test.mjs', ''),
      );
    // Generated schema types are checked against the complete migration catalog.
    if (path === 'frontend/src/types/database.ts') continue;
    if (path === 'supabase/tests/database/boundaries.test.sql') {
      // Keep this historical boundary file pinned while its cardinality
      // expectations track the current full migration set (12 tables, 13 RPCs).
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        databaseBoundaryUpdateSha256,
        path,
      );
      continue;
    }
    if (registrationUpdate.files[path]) {
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        registrationUpdate.files[path].sha256,
        path,
      );
      continue;
    }
    assert.equal(
      createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
      tree.get(path),
      path,
    );
  }
});
