export const target = Object.freeze({
  repository: 'khaled-amireh/ianalyze-academy',
  project: 'ocihwiqtgqplwgyhpwjv',
  supabaseUrl: 'https://ocihwiqtgqplwgyhpwjv.supabase.co',
  origin: 'https://ianalyze-academy.pages.dev',
  account: 'f25401b10b1826c747cd11739a9410bc',
  pagesProject: 'ianalyze-academy',
  productionBranch: 'main',
  sourceBranches: ['refs/heads/main', 'refs/heads/codex/supabase-auth-integration'],
});

export function requireReleaseCi(environment = process.env) {
  if (
    environment.CI !== 'true' ||
    environment.GITHUB_ACTIONS !== 'true' ||
    environment.GITHUB_EVENT_NAME !== 'push' ||
    environment.GITHUB_REPOSITORY !== target.repository ||
    !target.sourceBranches.includes(environment.GITHUB_REF) ||
    !/^[a-f0-9]{40}$/.test(environment.GITHUB_SHA ?? '')
  )
    throw new Error('Deployment requires a push of an approved branch in the original repository.');
}

export function requirePagesTarget(environment = process.env) {
  if (
    environment.CLOUDFLARE_ACCOUNT_ID !== target.account ||
    environment.CLOUDFLARE_PAGES_PROJECT !== target.pagesProject ||
    environment.CLOUDFLARE_PRODUCTION_BRANCH !== target.productionBranch ||
    environment.PRODUCTION_ORIGIN !== target.origin
  )
    throw new Error(
      'Cloudflare account, project, production label or origin does not match review.',
    );
}

export function requireSupabaseTarget(environment = process.env) {
  if (
    environment.SUPABASE_PROJECT_ID !== target.project ||
    environment.PRODUCTION_ORIGIN !== target.origin
  )
    throw new Error('Supabase project or production origin does not match review.');
}
