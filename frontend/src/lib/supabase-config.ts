export type SupabaseConfiguration =
  | { status: 'unconfigured' | 'invalid' }
  | { status: 'configured'; url: string; publishableKey: string };

export function readSupabaseConfiguration(
  environment: Record<string, string | boolean | undefined>,
): SupabaseConfiguration {
  const url = String(environment.VITE_SUPABASE_URL ?? '').trim();
  const publishableKey = String(environment.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  if (!url && !publishableKey) return { status: 'unconfigured' };
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) return { status: 'invalid' };
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (
      (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== '/'
    )
      return { status: 'invalid' };
    return { status: 'configured', url: parsed.origin, publishableKey };
  } catch {
    return { status: 'invalid' };
  }
}
