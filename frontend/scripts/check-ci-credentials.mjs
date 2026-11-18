// No CLI subprocesses, downloads, uploads, arbitrary SQL, or provider mutations.
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { requirePagesTarget, requireSupabaseTarget, target } from './release-target.mjs';

const labels = Object.freeze({
  context: 'Manual workflow and fixed targets',
  projects: 'Supabase intended project access and health',
  database: 'Supabase read-only database access',
  leader: 'CI Leader is active, confirmed, and Team-authorized',
  gates: 'Production feature gates remain closed',
  functions: 'Supabase Edge Function listing access',
  pages: 'Cloudflare intended Direct Upload project access',
  token: 'Cloudflare token status and validity',
  policy: 'Cloudflare Pages write policy metadata',
  restriction: 'Cloudflare account restriction metadata',
  supabasePolicy: 'Supabase write scopes and project restriction policy',
});

export function validatePreflightContext(env) {
  if (
    env.CI !== 'true' ||
    env.GITHUB_ACTIONS !== 'true' ||
    env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    env.GITHUB_REPOSITORY !== target.repository ||
    env.GITHUB_REF !== 'refs/heads/main' ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') ||
    env.RUNNER_DEBUG === '1' ||
    env.ACTIONS_STEP_DEBUG === 'true'
  )
    throw Error('PREFLIGHT_CONTEXT_REJECTED');
  requireSupabaseTarget(env);
  requirePagesTarget(env);
  if (env.VITE_SUPABASE_URL !== target.supabaseUrl) throw Error('TARGET_REJECTED');
  for (const name of ['SUPABASE_ACCESS_TOKEN', 'CLOUDFLARE_API_TOKEN'])
    if (!env[name] || env[name] !== env[name].trim() || /[\r\n\0]/.test(env[name]))
      throw Error('CREDENTIAL_MISSING_OR_INVALID');
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      env.ACADEMY_LEADER_USER_ID ?? '',
    )
  )
    throw Error('LEADER_BINDING_INVALID');
}

function leaderQuery(owner) {
  // Only the validated UUID is interpolated. No private records are returned.
  return `select current_setting('transaction_read_only')='on' as read_only,
    exists(select 1 from auth.users u join app_private.user_roles r on r.user_id=u.id
      where u.id='${owner}'::uuid and u.email_confirmed_at is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
      and r.role='team') as verified_leader,
    (select count(*)=3 and bool_and(p.prosrc ~ '^[[:space:]]*select[[:space:]]+false;?[[:space:]]*$'
      and p.provolatile='i' and not p.prosecdef and p.pronargs=0
      and p.prorettype='boolean'::regtype and l.lanname='sql')
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      join pg_catalog.pg_language l on l.oid=p.prolang where n.nspname='app_private'
      and p.proname in ('uploads_enabled','submission_service_enabled','leaderboard_enabled'))
      as gates_closed`;
}

export function assessCloudflarePolicy(metadata) {
  if (!Array.isArray(metadata?.policies) || metadata.policies.length === 0)
    return { policy: 'UNVERIFIED', restriction: 'UNVERIFIED' };
  // Fail conservatively to UNVERIFIED for policy forms we cannot fully interpret.
  if (metadata.policies.some((p) => p.effect !== 'allow'))
    return { policy: 'UNVERIFIED', restriction: 'UNVERIFIED' };
  const account = `com.cloudflare.api.account.${target.account}`;
  const recognized = metadata.policies.every(
    (p) =>
      Array.isArray(p.permission_groups) &&
      p.resources &&
      !Array.isArray(p.resources) &&
      Object.keys(p.resources).length > 0 &&
      Object.values(p.resources).every((v) => v === '*'),
  );
  if (!recognized) return { policy: 'UNVERIFIED', restriction: 'UNVERIFIED' };
  const writesTarget = metadata.policies.some(
    (p) =>
      Object.hasOwn(p.resources, account) &&
      p.permission_groups.some((g) => /^(?:Cloudflare )?Pages (?:Edit|Write)$/.test(g.name ?? '')),
  );
  return {
    policy: writesTarget ? 'PASS' : 'UNVERIFIED',
    restriction: metadata.policies.every((p) =>
      Object.keys(p.resources).every((key) => key === account),
    )
      ? 'PASS'
      : 'FAIL',
  };
}

export async function runCredentialPreflight(env, fetcher = globalThis.fetch, now = Date.now()) {
  const checks = [];
  const add = (id, status) => checks.push({ check: labels[id], status });
  try {
    validatePreflightContext(env);
  } catch {
    add('context', 'FAIL');
    return { checks, readChecksPassed: false, releaseReady: false };
  }
  add('context', 'PASS');
  // Every request is selected here; callers cannot supply a URL, method, or query.
  const routes = {
    projects: ['supabase', 'GET', 'https://api.supabase.com/v1/projects'],
    database: [
      'supabase',
      'POST',
      `https://api.supabase.com/v1/projects/${target.project}/database/query`,
    ],
    functions: [
      'supabase',
      'GET',
      `https://api.supabase.com/v1/projects/${target.project}/functions`,
    ],
    pages: [
      'cloudflare',
      'GET',
      `https://api.cloudflare.com/client/v4/accounts/${target.account}/pages/projects/${target.pagesProject}`,
    ],
    verifyUser: ['cloudflare', 'GET', 'https://api.cloudflare.com/client/v4/user/tokens/verify'],
    verifyAccount: [
      'cloudflare',
      'GET',
      `https://api.cloudflare.com/client/v4/accounts/${target.account}/tokens/verify`,
    ],
  };
  const request = async (route) => {
    const [provider, method, url] = route;
    try {
      const response = await fetcher(url, {
        method,
        redirect: 'error', // Never forward bearer credentials to another URL.
        headers: {
          Authorization: `Bearer ${provider === 'supabase' ? env.SUPABASE_ACCESS_TOKEN : env.CLOUDFLARE_API_TOKEN}`,
          Accept: 'application/json',
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(method === 'POST'
          ? {
              body: JSON.stringify({
                read_only: true,
                query: leaderQuery(env.ACADEMY_LEADER_USER_ID),
              }),
            }
          : {}),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      // Provider errors, request options and response text must never reach logs.
      return null;
    }
  };

  const projects = await request(routes.projects);
  const matches = Array.isArray(projects) ? projects.filter((p) => p.id === target.project) : [];
  const projectOK =
    matches.length === 1 &&
    matches[0].name === target.pagesProject &&
    matches[0].status === 'ACTIVE_HEALTHY';
  add('projects', projectOK ? 'PASS' : 'FAIL');
  if (projectOK) {
    const rows = await request(routes.database);
    const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
    add('database', row?.read_only === true ? 'PASS' : 'FAIL');
    add('leader', row?.verified_leader === true ? 'PASS' : 'FAIL');
    add('gates', row?.gates_closed === true ? 'PASS' : 'FAIL');
    const functions = await request(routes.functions);
    add('functions', Array.isArray(functions) ? 'PASS' : 'FAIL');
  } else {
    for (const id of ['database', 'leader', 'gates', 'functions']) add(id, 'UNVERIFIED');
  }
  // Project listing and successful reads cannot prove policy restriction or write scopes.
  // No documented PAT self-introspection endpoint is assumed or invented here.
  add('supabasePolicy', 'UNVERIFIED');

  const pages = await request(routes.pages);
  const p = pages?.result;
  add(
    'pages',
    pages?.success === true &&
      p?.name === target.pagesProject &&
      p.subdomain === 'ianalyze-academy.pages.dev' &&
      p.production_branch === target.productionBranch &&
      !p.source
      ? 'PASS'
      : 'FAIL',
  );
  let verification = await request(routes.verifyUser);
  let tokenBase = 'https://api.cloudflare.com/client/v4/user/tokens/';
  if (verification?.success !== true) {
    verification = await request(routes.verifyAccount);
    tokenBase = `https://api.cloudflare.com/client/v4/accounts/${target.account}/tokens/`;
  }
  const token = verification?.success === true ? verification.result : null;
  if (!token) add('token', 'UNVERIFIED');
  else {
    const expiry = token.expires_on == null ? null : Date.parse(token.expires_on);
    const notBefore = token.not_before == null ? null : Date.parse(token.not_before);
    const invalidDates =
      (expiry !== null && !Number.isFinite(expiry)) ||
      (notBefore !== null && !Number.isFinite(notBefore));
    add(
      'token',
      invalidDates
        ? 'UNVERIFIED'
        : token.status === 'active' &&
            (expiry === null || expiry > now) &&
            (notBefore === null || notBefore <= now)
          ? 'PASS'
          : 'FAIL',
    );
  }
  let policy = { policy: 'UNVERIFIED', restriction: 'UNVERIFIED' };
  // Self-token details only. No token enumeration and no extra permissions requested.
  if (/^[a-f0-9]{32}$/i.test(token?.id ?? '')) {
    const details = await request(['cloudflare', 'GET', tokenBase + token.id]);
    if (details?.success === true) policy = assessCloudflarePolicy(details.result);
  }
  add('policy', policy.policy);
  add('restriction', policy.restriction);
  const required = ['context', 'projects', 'database', 'leader', 'gates', 'functions', 'pages'];
  return {
    checks,
    readChecksPassed: required.every((id) =>
      checks.some((c) => c.check === labels[id] && c.status === 'PASS'),
    ),
    releaseReady: false, // Scope metadata and final release approval remain separate gates.
  };
}

export function renderPreflight(result) {
  return [
    '## Read-only credential preflight',
    '',
    '| Check | Result |',
    '| --- | --- |',
    ...result.checks.map((c) => `| ${c.check} | ${c.status} |`),
    '',
    'Read access does not establish deployment/write permissions. UNVERIFIED requires owner review.',
    'This run does not authorize a migration, publish a build, or open feature gates.',
    '',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runCredentialPreflight(process.env);
    const summary = renderPreflight(result);
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    if (!result.readChecksPassed || result.checks.some((c) => c.status === 'FAIL'))
      process.exitCode = 1;
  } catch {
    console.log('Credential preflight stopped; raw diagnostics suppressed.');
    process.exitCode = 1;
  }
}
