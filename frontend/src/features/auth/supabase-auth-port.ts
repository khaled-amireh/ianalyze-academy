import type { AcademyClient } from '@/lib/supabase';
import type { AuthPort } from './auth-store';

export function createSupabaseAuthPort(client: AcademyClient): AuthPort {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error('Session unavailable');
      return data.session ? { userId: data.session.user.id } : null;
    },
    async getVerifiedUser() {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) throw new Error('Verification unavailable');
      return {
        id: data.user.id,
        email: data.user.email ?? null,
        confirmed: Boolean(data.user.email_confirmed_at),
      };
    },
    async getRole() {
      const { data, error } = await client.rpc('current_academy_role');
      if (error) throw new Error('Role unavailable');
      return data;
    },
    onSession(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(session ? { userId: session.user.id } : null);
      });
      return () => data.subscription.unsubscribe();
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw new Error('Sign-out unavailable');
    },
  };
}
