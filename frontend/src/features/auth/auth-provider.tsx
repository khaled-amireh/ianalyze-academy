import { useEffect, useState, type ReactNode } from 'react';
import { createAcademyClient } from '@/lib/supabase';
import { createAuthStore } from './auth-store';
import { createSupabaseAuthPort } from './supabase-auth-port';
import { AuthContext } from './auth-context';

const client = createAcademyClient(import.meta.env);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => {
    return createAuthStore(client ? createSupabaseAuthPort(client) : null);
  });
  useEffect(() => store.start(), [store]);
  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>;
}
