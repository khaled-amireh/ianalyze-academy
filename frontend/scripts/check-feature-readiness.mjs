import { readFileSync } from 'node:fs';
import { requireSupabaseTarget, target } from './release-target.mjs';
requireSupabaseTarget();
if (!process.env.SUPABASE_ACCESS_TOKEN)
  throw Error('Read-only schema verification credential is required.');
const query = readFileSync(
  new URL('../../supabase/operations/final-improvements-readiness.sql', import.meta.url),
  'utf8',
);
const response = await fetch(
  `https://api.supabase.com/v1/projects/${target.project}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ read_only: true, query }),
    signal: AbortSignal.timeout(20000),
  },
);
if (!response.ok) throw Error('Read-only schema check failed; release blocked.');
const rows = await response.json();
if (!Array.isArray(rows) || rows.length !== 1 || Object.values(rows[0]).some((x) => x !== true))
  throw Error(
    'Required profile/notification migration, index, RLS or RPC grants are missing. Release blocked; apply only after backup and approved release preparation.',
  );
console.log(
  'Hosted profile and notification schema, uniqueness index, RLS and RPC grants are ready. No data was modified.',
);
