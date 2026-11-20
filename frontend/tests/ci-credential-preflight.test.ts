import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assessCloudflarePolicy,
  renderPreflight,
  runCredentialPreflight,
} from '../scripts/check-ci-credentials.mjs';

const account = 'f25401b10b1826c747cd11739a9410bc';
const project = 'ocihwiqtgqplwgyhpwjv';
const env = {
  CI: 'true',
  GITHUB_ACTIONS: 'true',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REPOSITORY: 'khaled-amireh/ianalyze-academy',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: 'a'.repeat(40),
  SUPABASE_PROJECT_ID: project,
  VITE_SUPABASE_URL: `https://${project}.supabase.co`,
  PRODUCTION_ORIGIN: 'https://ianalyze-academy.pages.dev',
  CLOUDFLARE_ACCOUNT_ID: account,
  CLOUDFLARE_PAGES_PROJECT: 'ianalyze-academy',
  CLOUDFLARE_PRODUCTION_BRANCH: 'main',
  SUPABASE_ACCESS_TOKEN: 'DUMMY_SUPABASE_CREDENTIAL_FOR_OFFLINE_TESTS',
  CLOUDFLARE_API_TOKEN: 'DUMMY_CLOUDFLARE_CREDENTIAL_FOR_OFFLINE_TESTS',
  ACADEMY_LEADER_USER_ID: '00000000-0000-4000-8000-000000000001',
};
const reviewedGates = {
  leaderboard_enabled: true,
  submission_service_enabled: true,
  uploads_enabled: false,
};
const tokenId = 'b'.repeat(32);
const policy = {
  policies: [
    {
      effect: 'allow',
      permission_groups: [{ name: 'Cloudflare Pages Edit' }],
      resources: { [`com.cloudflare.api.account.${account}`]: '*' },
    },
  ],
};
const now = Date.parse('2026-11-18T12:00:00Z');

function fixture(changes: Record<string, unknown> = {}) {
  const calls: { url: string; options: RequestInit }[] = [];
  const responses: Record<string, unknown> = {
    '/v1/projects': [{ id: project, name: 'ianalyze-academy', status: 'ACTIVE_HEALTHY' }],
    [`/v1/projects/${project}/database/query`]: [
      { read_only: true, verified_leader: true, gate_definitions_safe: true, gates: reviewedGates },
    ],
    [`/v1/projects/${project}/functions`]: [],
    [`/client/v4/accounts/${account}/pages/projects/ianalyze-academy`]: {
      success: true,
      result: {
        name: 'ianalyze-academy',
        subdomain: 'ianalyze-academy.pages.dev',
        production_branch: 'main',
        source: null,
      },
    },
    '/client/v4/user/tokens/verify': {
      success: true,
      result: { id: tokenId, status: 'active', expires_on: '2027-01-01T00:00:00Z' },
    },
    [`/client/v4/user/tokens/${tokenId}`]: { success: true, result: policy },
    ...changes,
  };
  const fetcher = async (url: string, options: RequestInit) => {
    calls.push({ url, options });
    const response = responses[new URL(url).pathname];
    if (response instanceof Error) throw response;
    if (response && typeof response === 'object' && 'httpStatus' in response) {
      const status = Number(response.httpStatus);
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => response.body,
      };
    }
    return {
      ok: response !== undefined,
      status: response === undefined ? 404 : 200,
      json: async () => response,
    };
  };
  return { calls, fetcher };
}
const status = (r: Awaited<ReturnType<typeof runCredentialPreflight>>, name: string) =>
  r.checks.find((c: { check: string }) => c.check.includes(name))?.status;

test('manual original-repository main context and fixed targets fail closed before networking', async () => {
  for (const patch of [
    { GITHUB_EVENT_NAME: 'push' },
    { GITHUB_EVENT_NAME: 'pull_request_target' },
    { GITHUB_REPOSITORY: 'someone-else/ianalyze-academy' },
    { GITHUB_REF: 'refs/heads/unreviewed' },
    { GITHUB_SHA: 'invalid' },
    { SUPABASE_PROJECT_ID: 'other' },
    { VITE_SUPABASE_URL: 'http://localhost:54331' },
    { CLOUDFLARE_ACCOUNT_ID: 'other' },
    { PRODUCTION_ORIGIN: 'https://other.invalid' },
    { SUPABASE_ACCESS_TOKEN: '' },
    { CLOUDFLARE_API_TOKEN: 'dummy\nsecret' },
    { ACADEMY_LEADER_USER_ID: "'; delete from auth.users; --" },
    { RUNNER_DEBUG: '1' },
    { ACTIONS_STEP_DEBUG: 'true' },
  ]) {
    const f = fixture();
    const r = await runCredentialPreflight({ ...env, ...patch }, f.fetcher, now);
    assert.equal(r.readChecksPassed, false);
    assert.equal(f.calls.length, 0);
  }
});

test('only fixed read routes and one SELECT-only POST are sent; credentials cannot follow redirects', async () => {
  const f = fixture();
  const r = await runCredentialPreflight(env, f.fetcher, now);
  assert.equal(r.readChecksPassed, true);
  assert.equal(r.releaseReady, false);
  assert.equal(status(r, 'Supabase write scopes'), 'UNVERIFIED');
  assert.equal(status(r, 'Pages write policy'), 'PASS');
  assert.equal(status(r, 'account restriction'), 'PASS');
  assert.equal(f.calls.length, 6);
  const urls = f.calls.map((c) => c.url);
  assert.ok(urls.every((u) => /^https:\/\/(api.supabase.com|api.cloudflare.com)\//.test(u)));
  const writes = f.calls.filter((c) => c.options.method !== 'GET');
  assert.equal(writes.length, 1);
  const body = JSON.parse(String(writes[0].options.body));
  assert.equal(body.read_only, true);
  assert.match(body.query, /^select /);
  assert.doesNotMatch(
    body.query,
    /\b(insert|update|delete|create|alter|drop|grant|revoke|copy)\b/i,
  );
  assert.match(body.query, /email_confirmed_at is not null/);
  assert.match(body.query, /r\.role='team'/);
  assert.match(body.query, /transaction_read_only/);
  assert.match(body.query, /u\.deleted_at is null/);
  assert.match(body.query, /u\.banned_until/);
  for (const call of f.calls) {
    assert.equal(call.options.redirect, 'error');
    const expected = call.url.startsWith('https://api.supabase.com')
      ? env.SUPABASE_ACCESS_TOKEN
      : env.CLOUDFLARE_API_TOKEN;
    assert.equal(
      (call.options.headers as Record<string, string>).Authorization,
      `Bearer ${expected}`,
    );
  }
});

test('denied database access, invalid Team binding, mismatched gates, and wrong Pages targets fail', async () => {
  for (const patch of [
    { read_only: false },
    { verified_leader: false },
    { gate_definitions_safe: false },
    { gates: { ...reviewedGates, uploads_enabled: true } },
    { gates: { ...reviewedGates, leaderboard_enabled: false } },
  ]) {
    const f = fixture({
      [`/v1/projects/${project}/database/query`]: [
        {
          read_only: true,
          verified_leader: true,
          gate_definitions_safe: true,
          gates: reviewedGates,
          ...patch,
        },
      ],
    });
    const r = await runCredentialPreflight(env, f.fetcher, now);
    assert.equal(r.readChecksPassed, false);
  }
  for (const route of [
    `/v1/projects/${project}/database/query`,
    `/v1/projects/${project}/functions`,
    `/client/v4/accounts/${account}/pages/projects/ianalyze-academy`,
  ]) {
    const f = fixture({ [route]: undefined });
    assert.equal((await runCredentialPreflight(env, f.fetcher, now)).readChecksPassed, false);
  }
  const f = fixture({ '/v1/projects': [{ id: 'other', status: 'ACTIVE_HEALTHY' }] });
  const r = await runCredentialPreflight(env, f.fetcher, now);
  assert.equal(r.readChecksPassed, false);
  assert.equal(status(r, 'database access'), 'UNVERIFIED');
  assert.ok(!f.calls.some((c) => c.options.method === 'POST'));
});

test('account-owned token fallback is read-only; unavailable self-details remain UNVERIFIED', async () => {
  const f = fixture({
    '/client/v4/user/tokens/verify': undefined,
    [`/client/v4/accounts/${account}/tokens/verify`]: {
      success: true,
      result: { id: tokenId, status: 'active' },
    },
  });
  const r = await runCredentialPreflight(env, f.fetcher, now);
  assert.equal(r.readChecksPassed, true);
  assert.equal(status(r, 'Pages write policy'), 'UNVERIFIED');
  assert.ok(f.calls.some((c) => c.url.endsWith(`/accounts/${account}/tokens/${tokenId}`)));
  assert.ok(
    f.calls.filter((c) => c.url.includes('/tokens/')).every((c) => c.options.method === 'GET'),
  );
});

test('expired/disabled tokens fail; unknown dates and complex policies are not certified', async () => {
  for (const patch of [
    { status: 'expired' },
    { status: 'disabled' },
    { expires_on: '2020-01-01T00:00:00Z' },
    { not_before: '2030-01-01T00:00:00Z' },
  ]) {
    const f = fixture({
      '/client/v4/user/tokens/verify': {
        success: true,
        result: { id: tokenId, status: 'active', ...patch },
      },
    });
    assert.equal(status(await runCredentialPreflight(env, f.fetcher, now), 'token status'), 'FAIL');
  }
  assert.deepEqual(assessCloudflarePolicy({ policies: [{ effect: 'deny' }] }), {
    policy: 'UNVERIFIED',
    restriction: 'UNVERIFIED',
  });
  assert.equal(
    assessCloudflarePolicy({
      policies: [{ ...policy.policies[0], resources: { 'com.cloudflare.api.account.*': '*' } }],
    }).restriction,
    'FAIL',
  );
  assert.equal(
    assessCloudflarePolicy({
      policies: [{ ...policy.policies[0], permission_groups: [{ name: 'Cloudflare Pages Read' }] }],
    }).policy,
    'UNVERIFIED',
  );
});

test('malicious provider messages, token values, UUIDs, and PII never reach results or summaries', async () => {
  const privateMessage = `${env.SUPABASE_ACCESS_TOKEN} ${env.CLOUDFLARE_API_TOKEN} ${env.ACADEMY_LEADER_USER_ID} person@example.test`;
  const f = fixture({
    [`/v1/projects/${project}/database/query`]: new Error(privateMessage),
    [`/client/v4/user/tokens/${tokenId}`]: { success: true, result: { name: privateMessage } },
  });
  const r = await runCredentialPreflight(env, f.fetcher, now);
  const output = JSON.stringify(r) + renderPreflight(r);
  for (const value of [
    env.SUPABASE_ACCESS_TOKEN,
    env.CLOUDFLARE_API_TOKEN,
    env.ACADEMY_LEADER_USER_ID,
    'person@example.test',
  ])
    assert.ok(!output.includes(value));
});

test('Cloudflare HTTP failures are classified without exposing response bodies or implying revocation', async () => {
  const route = `/client/v4/accounts/${account}/pages/projects/ianalyze-academy`;
  const cases = [
    [401, 'AUTHENTICATION_FAILED_HTTP_401'],
    [403, 'AUTHORIZATION_FAILED_HTTP_403'],
    [404, 'RESOURCE_NOT_FOUND_HTTP_404'],
    [503, 'HTTP_ERROR_503'],
  ] as const;
  for (const [httpStatus, diagnostic] of cases) {
    const f = fixture({
      [route]: { httpStatus, body: { secret: 'never-print-this-provider-body' } },
    });
    const result = await runCredentialPreflight(env, f.fetcher, now);
    assert.equal(status(result, 'Direct Upload project access'), 'FAIL');
    assert.equal(status(result, 'Cloudflare Pages project diagnostic'), diagnostic);
    const rendered = renderPreflight(result);
    assert.ok(!rendered.includes('never-print-this-provider-body'));
    assert.ok(!rendered.toLowerCase().includes('revoked'));
  }
});

test('Cloudflare network, API-envelope, and target mismatches remain distinct and sanitized', async () => {
  const route = `/client/v4/accounts/${account}/pages/projects/ianalyze-academy`;
  const network = fixture({
    [route]: new Error('credential person@example.test provider detail'),
  });
  const networkResult = await runCredentialPreflight(env, network.fetcher, now);
  assert.equal(status(networkResult, 'Cloudflare Pages project diagnostic'), 'NETWORK_ERROR');
  assert.ok(!renderPreflight(networkResult).includes('person@example.test'));

  const api = fixture({
    [route]: { success: false, errors: [{ message: 'private provider detail' }] },
  });
  const apiResult = await runCredentialPreflight(env, api.fetcher, now);
  assert.equal(status(apiResult, 'Cloudflare Pages project diagnostic'), 'API_ERROR');
  assert.ok(!renderPreflight(apiResult).includes('private provider detail'));

  const mismatch = fixture({
    [route]: {
      success: true,
      result: {
        name: 'unexpected-project',
        subdomain: 'unexpected.pages.dev',
        production_branch: 'main',
        source: null,
      },
    },
  });
  const mismatchResult = await runCredentialPreflight(env, mismatch.fetcher, now);
  assert.equal(status(mismatchResult, 'Cloudflare Pages project diagnostic'), 'TARGET_MISMATCH');
});

test('workflow has manual-only execution, pinned actions, no npm install, build, migrations or deployment', () => {
  const workflow = readFileSync(
    new URL('../../.github/workflows/credential-preflight.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /on:\s*\n\s+workflow_dispatch:/);
  assert.doesNotMatch(
    workflow,
    /^\s+(?:push|pull_request|pull_request_target|workflow_run|schedule):/m,
  );
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(
    workflow,
    /(?:npm (?:ci|install)|release:|wrangler|supabase (?:db|functions|secrets)|id-token: write)/,
  );
  const actions = [...workflow.matchAll(/uses: ([^\s]+)/g)].map((m) => m[1]);
  assert.equal(actions.length, 2);
  assert.ok(actions.every((s) => /@[a-f0-9]{40}$/.test(s)));
  for (const secret of ['SUPABASE_ACCESS_TOKEN', 'CLOUDFLARE_API_TOKEN', 'ACADEMY_LEADER_USER_ID'])
    assert.ok(workflow.includes(`secrets.${secret}`));
});
