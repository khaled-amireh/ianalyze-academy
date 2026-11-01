import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

export const root = new URL('../../', import.meta.url);
export const migrations = () =>
  readdirSync(new URL('supabase/migrations/', root))
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(new URL(`supabase/migrations/${name}`, root), 'utf8'));

// Test-only compatibility fixture. This is NOT GoTrue, PostgREST, or Storage API.
export async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users (
      id uuid primary key, email text, email_confirmed_at timestamptz,
      raw_user_meta_data jsonb not null default '{}'
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table storage.buckets (
      id text primary key, name text not null, public boolean not null default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
      name text not null, owner_id text, unique (bucket_id, name)
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
  for (const migration of migrations()) await db.exec(migration);
  return db;
}

export async function asUser(db, uid, callback, role = 'authenticated') {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role === 'anon' ? 'anon' : 'authenticated'}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? '']);
    const result = await callback();
    await db.exec('commit');
    return result;
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}
