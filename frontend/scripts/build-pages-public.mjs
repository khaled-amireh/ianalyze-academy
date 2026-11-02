// First public-site deployment candidate only. This never invokes Wrangler or Supabase.
// Excludes all real/local environment files, including local browser-test overrides.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const envDirectory = new URL('../artifacts/pages-empty-environment/', import.meta.url);
mkdirSync(envDirectory, { recursive: true });
if (readdirSync(envDirectory).length !== 0)
  throw new Error('Public build environment must be empty');
for (const key of Object.keys(process.env)) if (key.startsWith('VITE_')) delete process.env[key];
Object.assign(process.env, {
  VITE_ENABLE_DEV_PREVIEWS: 'false',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_PUBLISHABLE_KEY: '',
  VITE_ENABLE_REGISTRATION: 'false',
  VITE_ENABLE_SUBMISSIONS: 'false',
  VITE_ENABLE_LEADERBOARD: 'false',
  VITE_PRIVACY_APPROVED: 'false',
});
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], {
  cwd: root,
  stdio: 'inherit',
});
await build({
  root,
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  envDir: fileURLToPath(envDirectory),
  mode: 'production',
});
console.log(
  'Cloudflare public-site build complete: local env excluded; backend unconfigured; launch flags false.',
);
