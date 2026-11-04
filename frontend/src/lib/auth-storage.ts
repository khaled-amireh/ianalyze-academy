export const AUTH_KEY = 'ianalyze.auth';
const MODE_KEY = AUTH_KEY + '.persistence';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Fail closed to in-memory storage when browser storage is disabled.
export function createAuthStorage(local?: Store, session?: Store) {
  const memory = new Map<string, string>();
  const read = (store: Store | undefined, key: string) => {
    try {
      return store?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  // Preserve existing persisted sessions; new logins default to session storage.
  let persistent =
    read(local, MODE_KEY) === 'local' ||
    (read(local, MODE_KEY) === null && read(local, AUTH_KEY) !== null);
  const remove = (store: Store | undefined, key: string) => {
    try {
      store?.removeItem(key);
    } catch {
      /* restricted storage */
    }
  };
  const storage = {
    getItem(key: string) {
      try {
        const target = persistent ? local : session;
        return target ? target.getItem(key) : (memory.get(key) ?? null);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem(key: string, value: string) {
      memory.delete(key);
      remove(persistent ? session : local, key);
      try {
        const target = persistent ? local : session;
        if (target) {
          target.setItem(key, value);
          return;
        }
      } catch {
        /* memory only */
      }
      memory.set(key, value);
    },
    removeItem(key: string) {
      memory.delete(key);
      remove(local, key);
      remove(session, key);
    },
  };
  return {
    storage,
    setRememberMe(remember: boolean) {
      const values = [AUTH_KEY, AUTH_KEY + '-code-verifier', AUTH_KEY + '-user'].map(
        (key) => [key, storage.getItem(key)] as const,
      );
      persistent = remember;
      try {
        local?.setItem(MODE_KEY, remember ? 'local' : 'session');
      } catch {
        /* memory only */
      }
      for (const [key, value] of values) {
        storage.removeItem(key);
        if (value !== null) storage.setItem(key, value);
      }
    },
  };
}

function browserStore(name: 'localStorage' | 'sessionStorage') {
  try {
    return typeof window === 'undefined' ? undefined : window[name];
  } catch {
    return undefined;
  }
}
export const authPersistence = createAuthStorage(
  browserStore('localStorage'),
  browserStore('sessionStorage'),
);
