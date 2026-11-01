export function localTestTarget(value, kind = 'api') {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('A valid local test URL is required');
  }
  const api = kind === 'api';
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== (api ? '54321' : '54322') ||
    !(api ? url.protocol === 'http:' : ['postgres:', 'postgresql:'].includes(url.protocol)) ||
    url.search ||
    url.hash ||
    (api ? url.username || url.password || url.pathname !== '/' : url.pathname !== '/postgres')
  )
    throw new Error(
      'Integration tests require the explicit local Supabase ports; hosted targets are forbidden',
    );
  return value;
}
