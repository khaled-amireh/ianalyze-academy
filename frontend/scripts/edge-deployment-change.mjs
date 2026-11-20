import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const EDGE_DEPLOYMENT_PATHS = Object.freeze([
  'supabase/functions',
  'frontend/scripts/deploy-supabase-edge.mjs',
  'frontend/scripts/release-target.mjs',
]);

const COMMIT_SHA = /^[a-f0-9]{40}$/i;

export function edgeDeploymentRequired(changedPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.some((path) => typeof path !== 'string'))
    return true;
  return changedPaths.some((rawPath) => {
    const path = rawPath.replaceAll('\\', '/').replace(/^\.\//, '');
    return EDGE_DEPLOYMENT_PATHS.some(
      (candidate) => path === candidate || path.startsWith(`${candidate}/`),
    );
  });
}

function changedPathsForPush(beforeSha, headSha) {
  if (!COMMIT_SHA.test(beforeSha ?? '') || !COMMIT_SHA.test(headSha ?? '')) return null;
  try {
    execFileSync('git', ['cat-file', '-e', `${beforeSha}^{commit}`], { stdio: 'ignore' });
    execFileSync('git', ['cat-file', '-e', `${headSha}^{commit}`], { stdio: 'ignore' });
    return execFileSync('git', ['diff', '--name-only', '-z', beforeSha, headSha], {
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);
  } catch {
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = changedPathsForPush(process.env.BEFORE_SHA, process.env.GITHUB_SHA);
  const changed = paths === null || edgeDeploymentRequired(paths);
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error('GitHub output file is required for Edge change detection.');
  appendFileSync(output, `changed=${changed}\n`);
  console.log(
    `Edge deployment ${changed ? 'required' : 'not required'}${paths === null ? '; commit comparison unavailable' : ''}.`,
  );
}
