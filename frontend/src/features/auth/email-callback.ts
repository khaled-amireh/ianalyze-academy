export type EmailCallback =
  | { kind: 'code'; code: string; recovery: boolean }
  | { kind: 'token'; tokenHash: string; type: 'email' | 'signup' | 'recovery'; recovery: boolean }
  | { kind: 'legacy' }
  | { kind: 'invalid' };

/** Deduplicate StrictMode's concurrent exchange, without caching used credentials. */
export function createEmailExchangeDeduplicator() {
  const pending = new Map<string, Promise<boolean>>();
  return (key: string, exchange: () => Promise<boolean>) => {
    const current = pending.get(key);
    if (current) return current;
    if (pending.size >= 16) pending.delete(pending.keys().next().value!);
    const result = Promise.resolve()
      .then(exchange)
      .catch(() => false)
      .finally(() => {
        if (pending.get(key) === result) pending.delete(key);
      });
    pending.set(key, result);
    return result;
  };
}

// URL data is untrusted. Destinations are always selected locally, never from `next`.
export function readEmailCallback(search: string, fragment: string): EmailCallback {
  const params = new URLSearchParams(search);
  const hash = new URLSearchParams(fragment.replace(/^#/, ''));
  if (
    params.has('error') ||
    params.has('error_code') ||
    hash.has('error') ||
    hash.has('error_code')
  )
    return { kind: 'invalid' };
  if (hash.has('access_token')) return { kind: 'legacy' };
  if (['code', 'token_hash', 'type', 'flow'].some((key) => params.getAll(key).length > 1))
    return { kind: 'invalid' };
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (code && !tokenHash && !type && code.length <= 2048)
    return { kind: 'code', code, recovery: params.get('flow') === 'recovery' };
  if (
    !code &&
    tokenHash &&
    tokenHash.length <= 2048 &&
    ['email', 'signup', 'recovery'].includes(type ?? '')
  )
    return {
      kind: 'token',
      tokenHash,
      type: type as 'email' | 'signup' | 'recovery',
      recovery: type === 'recovery',
    };
  return { kind: 'invalid' };
}
