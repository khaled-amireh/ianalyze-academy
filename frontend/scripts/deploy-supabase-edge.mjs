import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireReleaseCi, requireSupabaseTarget, target } from './release-target.mjs';

requireReleaseCi();
requireSupabaseTarget();
if (!process.env.SUPABASE_ACCESS_TOKEN)
  throw new Error('Supabase Actions deployment secret is missing.');
const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const run = (args) => {
  try {
    return execFileSync(process.execPath, [cli, ...args, '--output-format', 'json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180000,
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
    });
  } catch {
    throw new Error('Supabase deployment request failed; credentials/raw responses suppressed.');
  }
};
const projects = JSON.parse(run(['projects', 'list']));
const project = (Array.isArray(projects) ? projects : (projects.projects ?? [])).find(
  (item) => item.id === target.project,
);
if (project?.name !== target.pagesProject || project.status !== 'ACTIVE_HEALTHY')
  throw new Error('Supabase deployment target failed identity/health verification.');

const temporary = mkdtempSync(join(tmpdir(), 'academy-edge-'));
if (
  dirname(resolve(temporary)) !== resolve(tmpdir()) ||
  !basename(temporary).startsWith('academy-edge-')
)
  throw new Error('Refusing cleanup outside the task-specific temporary directory.');
try {
  const settings = join(temporary, 'runtime.env');
  writeFileSync(
    settings,
    `ACADEMY_ALLOWED_ORIGINS=${target.origin}\nACADEMY_ACTIVITY_UPLOADS_ENABLED=false\n`,
    { mode: 0o600 },
  );
  run(['secrets', 'set', '--project-ref', target.project, '--env-file', settings]);
  const functionsToDeploy = ['notebook-submit', 'activity-submit'];
  for (const functionName of functionsToDeploy)
    run([
      'functions',
      'deploy',
      functionName,
      '--project-ref',
      target.project,
      '--use-api',
      '--no-verify-jwt',
      '--workdir',
      root,
    ]);
  const functions = JSON.parse(run(['functions', 'list', '--project-ref', target.project]));
  const deployedFunctions = Array.isArray(functions) ? functions : (functions.functions ?? []);
  for (const functionName of functionsToDeploy) {
    const deployed = deployedFunctions.find(
      (item) => item.slug === functionName || item.name === functionName,
    );
    if (deployed?.status !== 'ACTIVE' || deployed.verify_jwt !== false)
      throw new Error(
        `Deployed ${functionName} function does not match the reviewed gateway configuration.`,
      );
  }
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key ?? ''))
    throw new Error('Browser-safe key is required for the unauthenticated security probe.');
  const rejected = await fetch(`${target.supabaseUrl}/functions/v1/notebook-submit`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer invalid-release-probe',
      Origin: target.origin,
      'Content-Type': 'application/x-ipynb+json',
    },
    body: '{}',
    signal: AbortSignal.timeout(20000),
  });
  if (rejected.status !== 401)
    throw new Error('Notebook identity rejection failed; frontend deployment must stop.');
  const activityRejected = await fetch(`${target.supabaseUrl}/functions/v1/activity-submit`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer invalid-release-probe',
      Origin: target.origin,
      'Content-Type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(20000),
  });
  if (activityRejected.status !== 401)
    throw new Error('Activity function identity rejection failed; frontend deployment must stop.');
  console.log(
    'Notebook and activity functions released; anonymous access rejected and activity uploads remain closed.',
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
