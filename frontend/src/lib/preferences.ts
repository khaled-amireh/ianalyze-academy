export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function browserStorage(): PreferenceStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readPreference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
  storage = browserStorage(),
): T {
  try {
    const value = storage?.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function savePreference(key: string, value: string, storage = browserStorage()): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* Restricted storage must not prevent using the interface. */
  }
}
