// Offline-only classification. Never contacts providers or prints configuration values.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { readSupabaseConfiguration } from '../src/lib/supabase-config.ts';
import { verifyRegistrationApproval } from './registration-approval.mjs';
import { productionFeatures } from './production-feature-approval.mjs';

export function configuredBuildReadiness(environment, proof, now = Date.now()) {
  const checks = [];
  const config = readSupabaseConfiguration(environment);
  checks.push({
    check: 'production-configuration',
    passed:
      config.status === 'configured' && config.url === 'https://ocihwiqtgqplwgyhpwjv.supabase.co',
    category: 'verified-configuration',
  });
  const registration = environment.ACADEMY_REGISTRATION_APPROVED === 'true';
  try {
    productionFeatures(environment, registration);
    checks.push({ check: 'feature-approvals', passed: true });
  } catch {
    checks.push({ check: 'feature-approvals', passed: false, category: 'verified-configuration' });
  }
  if (registration) {
    try {
      verifyRegistrationApproval(proof, now, environment);
      checks.push({ check: 'registration-proof', passed: true });
    } catch {
      checks.push({
        check: 'registration-proof',
        passed: false,
        category: proof ? 'stale-or-invalid-evidence' : 'missing-evidence',
        action:
          'Obtain a fresh v2 verified-Leader and exact gate-definition proof in a separately authorized read-only production session.',
      });
    }
  }
  return {
    offlineOnly: true,
    productionAccess: false,
    productionWrites: false,
    configuredBuildReady: checks.every((check) => check.passed),
    checks,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let report;
  try {
    const configurationPath = process.argv[2];
    const environment = configurationPath
      ? parseEnv(readFileSync(configurationPath, 'utf8'))
      : process.env;
    const proofPath = new URL('../artifacts/registration-readiness.json', import.meta.url);
    const proof = existsSync(proofPath) ? JSON.parse(readFileSync(proofPath, 'utf8')) : undefined;
    report = configuredBuildReadiness(environment, proof);
  } catch {
    report = {
      offlineOnly: true,
      productionAccess: false,
      configuredBuildReady: false,
      checks: [{ check: 'input-files', passed: false, category: 'missing-or-invalid-local-input' }],
    };
  }
  const output = new URL('../artifacts/release-readiness-preflight.json', import.meta.url);
  mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (!report.configuredBuildReady) process.exitCode = 1;
}
