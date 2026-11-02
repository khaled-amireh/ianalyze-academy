// Reads the project-scoped LOCAL stack only. No login, linking or hosted operations.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localTestTarget } from './local-test-target.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const output = new URL('../artifacts/supabase-auth-integration/', import.meta.url);
try {
  const status = JSON.parse(
    execFileSync(process.execPath, [cli, 'status', '--workdir', root, '--output-format', 'json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
    }),
  );
  const api = localTestTarget(status.API_URL);
  const database = localTestTarget(status.DB_URL, 'database');
  if (!String(status.PUBLISHABLE_KEY ?? '').startsWith('sb_publishable_'))
    throw new Error('Local browser publishable key unavailable');
  const secret = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Local service credential unavailable');
  mkdirSync(output, { recursive: true });
  const save = (name, values) =>
    writeFileSync(
      new URL(name, output),
      Object.entries(values)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join('\n') + '\n',
      { mode: 0o600 },
    );
  save('stack.env', {
    RUN_LOCAL_SUPABASE_TESTS: '1',
    LOCAL_SUPABASE_URL: api,
    LOCAL_SUPABASE_DB_URL: database,
    LOCAL_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    LOCAL_SUPABASE_SECRET_KEY: secret,
  });
  save('frontend.env', {
    VITE_SUPABASE_URL: api,
    VITE_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    VITE_ENABLE_DEV_PREVIEWS: 'false',
    VITE_ENABLE_REGISTRATION: 'true',
    VITE_ENABLE_SUBMISSIONS: 'true',
    VITE_ENABLE_LEADERBOARD: 'true',
    VITE_PRIVACY_APPROVED: 'true',
  });
  save('edge.env', {
    ACADEMY_ALLOWED_ORIGINS: 'http://127.0.0.1:5173,http://localhost:5173',
    ACADEMY_UPLOADS_ENABLED: 'true',
  });
  console.log(
    'Local-only test environments prepared under ignored artifacts; existing .env files preserved. Credentials were not printed. Production builds remain closed.',
  );
} catch {
  console.error(
    'Local preparation failed. Start the project-scoped Supabase stack and verify local CLI access. No credentials were printed.',
  );
  process.exitCode = 1;
}
