// Uses only the separately named synthetic release stack; credentials stay process-only.
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const frontend = fileURLToPath(new URL('../', import.meta.url));
let vite;
try {
  const status = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'node_modules/supabase/dist/supabase.js',
        'status',
        '--workdir',
        'artifacts/release-blockers-local',
        '--output',
        'json',
      ],
      {
        cwd: frontend,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
      },
    ),
  );
  if (
    new URL(status.API_URL).origin !== 'http://127.0.0.1:55431' ||
    new URL(status.DB_URL).hostname !== '127.0.0.1' ||
    new URL(status.DB_URL).port !== '55432'
  )
    throw new Error('LOCAL_TARGET_MISMATCH');
  const env = {
    ...process.env,
    RELEASE_LOCAL_TESTS: '1',
    LOCAL_SUPABASE_URL: status.API_URL,
    LOCAL_SUPABASE_DB_URL: status.DB_URL,
    LOCAL_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    LOCAL_SUPABASE_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
    VITE_SUPABASE_URL: status.API_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    VITE_ENABLE_DEV_PREVIEWS: 'false',
    VITE_ENABLE_REGISTRATION: 'true',
    VITE_ENABLE_SUBMISSIONS: 'true',
    VITE_ENABLE_LEADERBOARD: 'true',
    VITE_PRIVACY_APPROVED: 'true',
  };
  if (!env.LOCAL_SUPABASE_PUBLISHABLE_KEY || !env.LOCAL_SUPABASE_SECRET_KEY)
    throw new Error('LOCAL_CONFIGURATION_MISSING');
  vite = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5197', '--strictPort'],
    { cwd: frontend, env, windowsHide: true, stdio: 'ignore' },
  );
  let ready = false;
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch('http://127.0.0.1:5197')).ok) {
        ready = true;
        break;
      }
    } catch {
      // Vite may still be starting; retry only this loopback endpoint.
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error('LOCAL_FRONTEND_UNAVAILABLE');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', 'tests/release-local.integration.test.mjs'], {
      cwd: frontend,
      env,
      windowsHide: true,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      process.exitCode = code ?? 1;
      resolve();
    });
  });
} catch (error) {
  console.error(
    ['LOCAL_TARGET_MISMATCH', 'LOCAL_CONFIGURATION_MISSING', 'LOCAL_FRONTEND_UNAVAILABLE'].includes(
      error.message,
    )
      ? error.message
      : 'LOCAL_STACK_STATUS_UNAVAILABLE: Start the dedicated release-blockers-local stack; no credentials were logged.',
  );
  process.exitCode = 1;
} finally {
  vite?.kill();
}
