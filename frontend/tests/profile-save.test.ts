import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { saveAcademyProfile } from '../src/lib/academy-data.ts';
import { profilePatch } from '../src/features/portal/profile-fields.ts';
import type { AcademyClient } from '../src/lib/supabase.ts';

const initial = {
  id: '00000000-0000-4000-8000-000000000091',
  full_name: 'Student',
  email: 'student@example.test',
  whatsapp: '+962790000001',
  major: 'Computer Science',
  academic_year: 4,
  python_experience: 'basic',
  university_id: '0012345',
  university: 'Al-Zaytoonah University of Jordan',
  locale: 'en',
  registered_at: '2026-11-11T09:00:00Z',
  consent_at: '2026-11-11T09:00:00Z',
  consent_version: 'registration-v1',
};
function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...initial, ...overrides }))
    data.set(key, String(value));
  return data;
}

// Use the installed Supabase query builder, intercepting every request in memory.
// Empty PATCH requests behave like PostgREST: zero rows cannot satisfy .single().
function fixture({ failUpdate = false, failRead = false, failRegistration = false } = {}) {
  let profile = { ...initial };
  const requests: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const sdk = createClient('http://127.0.0.1:54321', 'sb_publishable_TEST_ONLY', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, options) => {
        const url = new URL(String(input));
        const method = options?.method ?? 'GET';
        const body = JSON.parse(String(options?.body ?? '{}'));
        requests.push({ method, path: url.pathname, body });
        const response = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
          });
        if (url.pathname === '/rest/v1/rpc/complete_registration') {
          if (failRegistration)
            return response({ code: '42501', message: 'Registration denied' }, 403);
          return response(null);
        }
        assert.equal(url.pathname, '/rest/v1/profiles');
        assert.equal(url.searchParams.get('id'), 'eq.' + initial.id);
        if (method === 'PATCH') {
          if (!Object.keys(body).length)
            return response({ code: 'PGRST116', message: 'The result contains 0 rows' }, 406);
          if (failUpdate) return response({ code: '42501', message: 'Update denied' }, 403);
          profile = { ...profile, ...body };
        } else {
          assert.equal(method, 'GET');
          if (failRead) return response({ code: 'PGRST000', message: 'Read unavailable' }, 503);
        }
        return response(profile);
      },
    },
  });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: initial.id } }, error: null }) },
    from: sdk.from.bind(sdk),
    rpc: sdk.rpc.bind(sdk),
  } as unknown as AcademyClient;
  return { client, requests, profile: () => profile };
}

test('unchanged Save succeeds with the persisted profile and sends no PATCH', async () => {
  const f = fixture();
  const patch = profilePatch(form(), initial, false);
  assert.deepEqual(patch, {});
  assert.deepEqual(await saveAcademyProfile(f.client, patch, false), initial);
  assert.deepEqual(f.profile(), initial);
  assert.ok(f.requests.length > 0, 'Success must use real read responses');
  assert.ok(f.requests.every((request) => request.method === 'GET'));
});

test('whitespace and phone formatting that normalize to saved values send no PATCH', async () => {
  const f = fixture();
  const patch = profilePatch(
    form({
      full_name: '  Student  ',
      major: ' Computer Science ',
      academic_year: ' 4 ',
      python_experience: ' basic ',
      university_id: ' 0012345 ',
      locale: ' en ',
      whatsapp: '079 000 0001',
    }),
    initial,
    false,
  );
  assert.deepEqual(patch, {});
  assert.deepEqual(await saveAcademyProfile(f.client, patch, false), initial);
  assert.ok(f.requests.every((request) => request.method === 'GET'));
});

test('a genuine change performs one nonempty PATCH and returns the saved row', async () => {
  const f = fixture();
  const patch = profilePatch(form({ full_name: ' Updated Student ' }), initial, false);
  const saved = await saveAcademyProfile(f.client, patch, false);
  assert.deepEqual(saved, { ...initial, full_name: 'Updated Student' });
  assert.deepEqual(
    f.requests.filter((request) => request.method === 'PATCH').map((request) => request.body),
    [{ full_name: 'Updated Student' }],
  );
});

test('an actual Supabase update failure remains rejected and does not change data', async () => {
  const f = fixture({ failUpdate: true });
  await assert.rejects(saveAcademyProfile(f.client, { full_name: 'Updated Student' }, false), {
    code: '42501',
    message: 'Update denied',
  });
  assert.deepEqual(f.profile(), initial);
  assert.deepEqual(
    f.requests.map((request) => request.method),
    ['PATCH'],
  );
});

test('an unchanged Save does not invent success if the authenticated profile read fails', async () => {
  const f = fixture({ failRead: true });
  await assert.rejects(saveAcademyProfile(f.client, {}, false), {
    code: 'PGRST000',
    message: 'Read unavailable',
  });
  assert.ok(f.requests.every((request) => request.method === 'GET'));
});

test('an empty registration patch still invokes completion and propagates RPC errors', async () => {
  const f = fixture();
  await saveAcademyProfile(f.client, {}, true);
  assert.equal(
    f.requests.filter((request) => request.path.endsWith('/complete_registration')).length,
    1,
  );
  assert.ok(!f.requests.some((request) => request.method === 'PATCH'));
  const denied = fixture({ failRegistration: true });
  await assert.rejects(saveAcademyProfile(denied.client, {}, true), {
    code: '42501',
    message: 'Registration denied',
  });
});
