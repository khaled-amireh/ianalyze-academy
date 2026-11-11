import test from 'node:test';
import assert from 'node:assert/strict';
import { profilePatch, ZUJ } from '../src/features/portal/profile-fields.ts';
import type { ProfilePatch } from '../src/lib/academy-data.ts';

const values = {
  full_name: 'Student',
  whatsapp: '+962790000001',
  major: 'Computer Science',
  academic_year: '4',
  python_experience: 'basic',
  university_id: '12345',
  locale: 'en',
};
const form = (overrides = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...values, ...overrides })) data.set(key, value);
  return data;
};
const existing: ProfilePatch = { ...values, academic_year: 4, university: 'Historical University' };

test('new registration assigns the schema-compatible university and trims the saved ID', () => {
  const patch = profilePatch(form({ university_id: ' 000123 ', university: 'Injected' }), {}, true);
  assert.equal(patch.university, ZUJ);
  assert.equal(patch.university_id, '000123');
});

test('editing sends only changed personal fields and preserves historical values', () => {
  assert.deepEqual(profilePatch(form(), existing, false), {});
  assert.deepEqual(
    profilePatch(
      form({
        full_name: ' New Name ',
        university: ZUJ,
        role: 'team',
        id: 'another-user',
        registered_at: 'now',
      }),
      existing,
      false,
    ),
    { full_name: 'New Name' },
  );
  assert.deepEqual(profilePatch(form({ whatsapp: '0790000002' }), existing, false), {
    whatsapp: '+962790000002',
  });
  const incomplete = {
    full_name: 'Team',
    whatsapp: null,
    major: null,
    academic_year: null,
    python_experience: null,
    university_id: null,
    university: null,
    locale: 'ar',
  };
  const empty = new FormData();
  empty.set('full_name', 'Updated Team');
  empty.set('locale', 'ar');
  assert.deepEqual(profilePatch(empty, incomplete, false), { full_name: 'Updated Team' });
});
