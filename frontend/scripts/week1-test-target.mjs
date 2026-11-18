import { localTestTarget } from './local-test-target.mjs';
// Fresh Week 1 stack uses separate ports to preserve existing local databases.
// Reuse every existing host/protocol/path guard; no hosted targets are accepted.
export function week1TestTarget(value, kind = 'api') {
  const candidate = new URL(value);
  if (candidate.port === (kind === 'api' ? '54331' : '54332')) {
    const validation = new URL(candidate);
    validation.port = kind === 'api' ? '54321' : '54322';
    localTestTarget(validation.href, kind);
    return value;
  }
  return localTestTarget(value, kind);
}
