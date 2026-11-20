import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as notebook from '../../supabase/functions/_shared/notebook.ts';

// Run the actual handler with synthetic provider adapters; no fetch/network or Deno install.
const code = ts.transpileModule(
  readFileSync(
    new URL('../../supabase/functions/notebook-submit/index.ts', import.meta.url),
    'utf8',
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const id = '11111111-1111-4111-8111-111111111111';
const body = JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: {}, cells: [] });
function harness(
  options: {
    role?: string;
    verified?: boolean;
    enabled?: boolean;
    capability?: boolean;
    budgetDenied?: boolean;
    uploadConflict?: boolean;
    differentExistingBody?: boolean;
    finalizeDenied?: boolean;
  } = {},
) {
  let handler!: (request: Request) => Promise<Response>;
  const calls: string[] = [];
  const environment: Record<string, string> = {
    ACADEMY_ALLOWED_ORIGINS: 'https://academy.example.test',
    SUPABASE_URL: 'https://provider.example.test',
    SUPABASE_ANON_KEY: 'synthetic-public',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-private',
    ACADEMY_UPLOADS_ENABLED: String(options.enabled ?? true),
  };
  runInNewContext(code, {
    exports: {},
    Response,
    Uint8Array,
    Deno: {
      env: { get: (name: string) => environment[name] },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
    require: (name: string) => {
      if (name === '../_shared/notebook.ts') return notebook;
      assert.equal(name, 'npm:@supabase/supabase-js@2.118.0');
      return {
        createClient: (_url: string, key: string) => ({
          auth: {
            getUser: async () => ({
              data: {
                user: { id, email_confirmed_at: options.verified === false ? null : '2026-01-01' },
              },
            }),
          },
          rpc: async (rpc: string) => {
            calls.push(rpc);
            if (rpc === 'current_academy_role') return { data: options.role ?? 'student' };
            if (rpc === 'academy_capabilities')
              return { data: { submissions: options.capability ?? true } };
            assert.equal(key, 'synthetic-private');
            if (rpc === 'claim_submission_request')
              return { error: options.budgetDenied ? {} : null };
            if (rpc === 'reserve_notebook')
              return { data: { id, path: 'synthetic/private.ipynb', status: 'uploading' } };
            assert.equal(rpc, 'finalize_notebook');
            return { error: options.finalizeDenied ? {} : null };
          },
          storage: {
            from: (bucket: string) => {
              assert.equal(bucket, 'student-submissions');
              return {
                upload: async (_path: string, _bytes: Uint8Array, config: { upsert: boolean }) => {
                  calls.push('upload');
                  assert.equal(config.upsert, false);
                  return { error: options.uploadConflict ? {} : null };
                },
                download: async () => {
                  calls.push('download');
                  return { data: new Blob([options.differentExistingBody ? 'different' : body]) };
                },
              };
            },
          },
        }),
      };
    },
  });
  const request = (headers: Record<string, string> = {}, method = 'POST', payload = body) =>
    handler(
      new Request('https://edge.example.test/notebook-submit', {
        method,
        headers: {
          origin: 'https://academy.example.test',
          authorization: 'Bearer synthetic-session',
          'x-activity-id': id,
          'x-request-id': id,
          'x-filename': 'fixture.ipynb',
          ...headers,
        },
        ...(method === 'POST' ? { body: payload } : {}),
      }),
    );
  return { request, calls };
}

test('Edge handler rejects foreign origins, unsupported methods and missing authentication before provider use', async () => {
  const h = harness();
  assert.equal((await h.request({ origin: 'https://foreign.example.test' })).status, 403);
  assert.equal((await h.request({}, 'GET')).status, 405);
  assert.equal((await h.request({ authorization: '' })).status, 401);
  const preflight = await h.request({}, 'OPTIONS');
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get('Access-Control-Allow-Origin'),
    'https://academy.example.test',
  );
  assert.deepEqual(h.calls, []);
});
test('Edge handler enforces verified Student identity and both submission gates', async () => {
  for (const [config, status] of [
    [{ verified: false }, 401],
    [{ role: 'team' }, 403],
    [{ enabled: false }, 503],
    [{ capability: false }, 503],
  ] as const) {
    const h = harness(config);
    assert.equal((await h.request()).status, status);
    assert.ok(!h.calls.includes('claim_submission_request'));
  }
});
test('Edge handler rejects malformed requests, exhausted quotas and invalid notebooks without upload', async () => {
  const malformed = harness();
  assert.equal((await malformed.request({ 'x-request-id': 'invalid' })).status, 400);
  const budget = harness({ budgetDenied: true });
  assert.equal((await budget.request()).status, 429);
  const invalid = harness();
  assert.equal((await invalid.request({}, 'POST', '<script>invalid</script>')).status, 400);
  for (const h of [malformed, budget, invalid]) assert.ok(!h.calls.includes('upload'));
});
test('Edge handler submits validated bytes without overwriting and retries only identical content', async () => {
  for (const conflict of [false, true]) {
    const h = harness({ uploadConflict: conflict });
    const response = await h.request();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id, status: 'submitted' });
    assert.ok(h.calls.includes('finalize_notebook'));
    assert.equal(h.calls.includes('download'), conflict);
  }
  const mismatch = harness({ uploadConflict: true, differentExistingBody: true });
  assert.equal((await mismatch.request()).status, 503);
  assert.ok(!mismatch.calls.includes('finalize_notebook'));
});
test('Edge handler reports incomplete finalization without reporting success or internal errors', async () => {
  const h = harness({ finalizeDenied: true });
  const response = await h.request();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'Finalization incomplete; retry the same file and request',
  });
});
