// Dedicated synthetic stack snapshot. Never reset or alter an existing local database.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const frontend = fileURLToPath(new URL('../', import.meta.url));
const root = new URL('../../', import.meta.url);
const destination = new URL('../artifacts/release-blockers-local/supabase/', import.meta.url);
const copy = (source, target) => {
  if (source.endsWith('/')) {
    mkdirSync(new URL(target), { recursive: true });
    for (const child of readdirSync(new URL(source), { withFileTypes: true }))
      copy(
        source + child.name + (child.isDirectory() ? '/' : ''),
        target + child.name + (child.isDirectory() ? '/' : ''),
      );
  } else {
    const bytes = readFileSync(new URL(source));
    if (existsSync(new URL(target)) && !readFileSync(new URL(target)).equals(bytes))
      throw new Error('LOCAL_SNAPSHOT_CHANGED');
    writeFileSync(new URL(target), bytes);
  }
};
try {
  mkdirSync(destination, { recursive: true });
  const config = readFileSync(new URL('supabase/config.toml', root), 'utf8')
    .replace('ianalyze-academy-local', 'academy-blockers-20261120')
    .replaceAll('54321', '55431')
    .replaceAll('54322', '55432')
    .replaceAll('54320', '55430')
    .replaceAll('54323', '55433')
    .replaceAll('54324', '55434');
  const target = new URL('config.toml', destination);
  if (
    existsSync(target) &&
    readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== config.replaceAll('\r\n', '\n')
  )
    throw new Error('LOCAL_SNAPSHOT_CHANGED');
  writeFileSync(target, config);
  for (const name of ['migrations', 'templates', 'functions'])
    copy(new URL(`supabase/${name}/`, root).href, new URL(`${name}/`, destination).href);
  execFileSync(
    process.execPath,
    [
      'node_modules/supabase/dist/supabase.js',
      'start',
      '--workdir',
      'artifacts/release-blockers-local',
      '--exclude',
      'studio,imgproxy,edge-runtime',
    ],
    {
      cwd: frontend,
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 240000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  console.log('Dedicated local stack ready on API 55431 / DB 55432; credentials suppressed.');
} catch (error) {
  console.error(
    error.message === 'LOCAL_SNAPSHOT_CHANGED'
      ? 'LOCAL_SNAPSHOT_CHANGED: Existing local snapshot was preserved. Review a new isolated stack before applying candidate changes.'
      : 'LOCAL_STACK_START_FAILED: Verify Docker engine, unreserved ports 55430-55434 and the pinned Supabase CLI. Existing databases were not reset; credentials suppressed.',
  );
  process.exitCode = 1;
}
