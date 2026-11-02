// Configured, gated production candidate. This script never deploys anything.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import { readSupabaseConfiguration } from '../src/lib/supabase-config.ts';
import { registrationApproved } from './registration-approval.mjs';

const configuration = readSupabaseConfiguration(process.env);
if (
  configuration.status !== 'configured' ||
  configuration.url !== 'https://ocihwiqtgqplwgyhpwjv.supabase.co'
)
  throw new Error('The verified production URL and browser-safe publishable key are required.');

const root = fileURLToPath(new URL('../', import.meta.url));
const registration = registrationApproved();
const envDirectory = new URL('../artifacts/pages-empty-environment/', import.meta.url);
mkdirSync(envDirectory, { recursive: true });
if (readdirSync(envDirectory).length) throw new Error('Build environment directory must be empty.');
for (const name of Object.keys(process.env))
  if (/^(?:VITE_|SUPABASE_|CLOUDFLARE_|CF_API_)/.test(name)) delete process.env[name];
Object.assign(process.env, {
  VITE_SUPABASE_URL: configuration.url,
  VITE_SUPABASE_PUBLISHABLE_KEY: configuration.publishableKey,
  VITE_ENABLE_DEV_PREVIEWS: 'false',
  VITE_ENABLE_REGISTRATION: String(registration),
  VITE_ENABLE_SUBMISSIONS: 'false',
  VITE_ENABLE_LEADERBOARD: 'false',
  VITE_PRIVACY_APPROVED: String(registration),
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
writeFileSync(
  new URL('../artifacts/configured-build.json', import.meta.url),
  JSON.stringify(
    {
      project: 'ocihwiqtgqplwgyhpwjv',
      publishableKeySha256: createHash('sha256').update(configuration.publishableKey).digest('hex'),
      registration,
      submissions: false,
      leaderboard: false,
      privacyApproved: registration,
      developmentPreviews: false,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Configured production build complete; registration ${registration ? 'open after verified Leader approval' : 'closed'}; submissions and leaderboard closed.`,
);
