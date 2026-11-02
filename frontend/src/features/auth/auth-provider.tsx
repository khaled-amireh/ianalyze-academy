import { useEffect, useState, type ReactNode } from 'react';
import { academyClient as client } from '@/lib/academy-client';
import { createAuthStore } from './auth-store';
import { createSupabaseAuthPort } from './supabase-auth-port';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => {
    return createAuthStore(client ? createSupabaseAuthPort(client) : null);
  });
  useEffect(() => store.start(), [store]);
  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>;
}
