import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/use-auth';
import { academyClient } from '@/lib/academy-client';
type Notification = {
  event_key: string;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  href: string;
  created_at: string;
  read_at: string | null;
};
export function useNotifications() {
  const auth = useAuth();
  const uid = auth.status === 'signed-in' ? auth.user?.id : undefined;
  const [result, setResult] = useState<{ uid: string; items: Notification[] } | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((x) => x + 1), []);
  useEffect(() => {
    if (!uid || !academyClient) return;
    let active = true;
    const load = async () => {
      try {
        const { data, error } = await academyClient!.rpc('academy_notifications');
        if (active) {
          setError(Boolean(error));
          if (!error && Array.isArray(data)) setResult({ uid, items: data as Notification[] });
          // Never leave potentially withdrawn content visible after a failed refresh.
          else setResult(null);
        }
      } catch {
        if (active) {
          setError(true);
          setResult(null);
        }
      }
    };
    void load();
    const interval = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 60_000);
    window.addEventListener('focus', load);
    window.addEventListener('academy-notifications-updated', load);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', load);
      window.removeEventListener('academy-notifications-updated', load);
    };
  }, [uid, revision]);
  return {
    items: result && result.uid === uid ? result.items : [],
    loading: (!result || result.uid !== uid) && !error,
    error,
    reload,
  };
}
