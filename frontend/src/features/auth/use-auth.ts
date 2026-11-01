import { useSyncExternalStore } from 'react';
import { useAuthStore } from './auth-context';

export function useAuth() {
  const store = useAuthStore();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...state, refresh: store.refresh, signOut: store.signOut };
}
