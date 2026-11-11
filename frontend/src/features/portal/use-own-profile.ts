import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/use-auth';
import { academyClient } from '@/lib/academy-client';
import type { Row } from './data';

export function useOwnProfile() {
  const auth = useAuth();
  const uid = auth.status === 'signed-in' ? auth.user?.id : undefined;
  const [result, setResult] = useState<{ uid: string; profile: Row<'profiles'> } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!uid || !academyClient) return;
    let active = true;
    const load = async () => {
      try {
        const { data, error } = await academyClient!
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .single();
        if (active) {
          setError(Boolean(error || !data));
          if (data && !error) setResult({ uid, profile: data });
        }
      } catch {
        if (active) setError(true);
      }
    };
    void load();
    window.addEventListener('academy-profile-updated', load);
    return () => {
      active = false;
      window.removeEventListener('academy-profile-updated', load);
    };
  }, [uid]);
  return {
    profile: result && result.uid === uid ? result.profile : null,
    error,
    updateProfile: (profile: Row<'profiles'>) => {
      if (uid && profile.id === uid) {
        setResult({ uid, profile });
        setError(false);
      }
    },
  };
}
