import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { readSupabaseConfiguration } from './supabase-config';
import { authPersistence } from './auth-storage';

export function createAcademyClient(environment: Record<string, string | boolean | undefined>) {
  const configuration = readSupabaseConfiguration(environment);
  if (configuration.status !== 'configured') return null;
  return createClient<Database>(configuration.url, configuration.publishableKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'ianalyze.auth',
      storage: authPersistence.storage,
    },
  });
}

export type AcademyClient = NonNullable<ReturnType<typeof createAcademyClient>>;
