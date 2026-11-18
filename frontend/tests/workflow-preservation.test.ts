import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, basename, join } from 'node:path';
import { verifyWorkflowInventory } from '../scripts/check-redesign.mjs';

const approvedPaths = [
  '.github/workflows/production.yml',
  '.github/workflows/credential-preflight.yml',
];

function fixture(t: { after: (callback: () => void) => void }) {
  const parent = resolve(tmpdir());
  const directory = mkdtempSync(join(parent, 'ianalyze-workflow-security-'));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), parent);
    assert.ok(basename(directory).startsWith('ianalyze-workflow-security-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', directory, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  git('init', '--quiet');
  mkdirSync(join(directory, '.github/workflows'), { recursive: true });
  for (const path of approvedPaths)
    writeFileSync(join(directory, path), readFileSync(new URL(`../../${path}`, import.meta.url)));
  git('add', '--', ...approvedPaths);
  const inventory = () =>
    git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
  const verify = () =>
    verifyWorkflowInventory(inventory(), (path: string) => readFileSync(join(directory, path)));
  return { directory, git, inventory, verify };
}

test('exact approved production and credential-preflight workflow fingerprints pass', (t) => {
  const f = fixture(t);
  assert.deepEqual(f.inventory().sort(), [...approvedPaths].sort());
  assert.doesNotThrow(f.verify);
});

test('an additional staged workflow YAML is rejected even when Git tracks it', (t) => {
  const f = fixture(t);
  const path = '.github/workflows/unapproved-probe.yml';
  writeFileSync(join(f.directory, path), 'name: Probe\non: workflow_dispatch\njobs: {}\n');
  f.git('add', '--', path);
  assert.ok(f.git('ls-files', '--cached').includes(path));
  assert.throws(f.verify, /Unapproved workflow: \.github\/workflows\/unapproved-probe\.yml/);
});

test('an untracked workflow YAML is inventoried and rejected before extension filtering', (t) => {
  const f = fixture(t);
  const path = '.github/workflows/untracked-probe.yaml';
  writeFileSync(join(f.directory, path), 'name: Probe\non: workflow_dispatch\njobs: {}\n');
  assert.ok(!f.git('ls-files', '--cached').includes(path));
  assert.ok(f.inventory().includes(path));
  assert.throws(f.verify, /Unapproved workflow: \.github\/workflows\/untracked-probe\.yaml/);
});

for (const path of approvedPaths)
  test(`modified approved workflow fails its fingerprint: ${path}`, (t) => {
    const f = fixture(t);
    const file = join(f.directory, path);
    writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from('\n# tampered\n')]));
    assert.throws(f.verify, /Reviewed workflow changed:/);
  });
