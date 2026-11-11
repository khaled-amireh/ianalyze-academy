import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearRegistrationDraft,
  draftKey,
  readRegistrationDraft,
  REGISTRATION_DRAFT_TTL,
  saveRegistrationDraftField,
  type DraftScope,
} from '../src/features/portal/registration-draft.ts';
import { validateProfile } from '../src/features/portal/form-validation.ts';

const account: DraftScope = { kind: 'account' };
const student: DraftScope = { kind: 'profile', userId: 'student-a' };
function memory() {
  const records = new Map<string, string>();
  return {
    records,
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => {
      records.set(key, value);
    },
    removeItem: (key: string) => {
      records.delete(key);
    },
  };
}

test('account drafts allow only email; passwords, confirmation, tokens, roles and consent are never stored', () => {
  const storage = memory();
  saveRegistrationDraftField(account, 'email', 'student@example.test', storage, 100);
  for (const name of [
    'password',
    'confirmation',
    'access_token',
    'refresh_token',
    'secret',
    'role',
    'consent',
    'full_name',
  ])
    saveRegistrationDraftField(account, name, 'never-persist-this-value', storage, 101);
  assert.deepEqual(readRegistrationDraft(account, storage, 102), { email: 'student@example.test' });
  assert.ok(![...storage.records.values()].join('').includes('never-persist-this-value'));
});

test('profile drafts preserve allowed raw values and keep account email out of the scope', () => {
  const storage = memory();
  const fields = {
    full_name: ' طالب Student ',
    whatsapp: '079 000 0001',
    major: 'other',
    major_other: 'تخصص مخصص',
    academic_year: '4',
    python_experience: 'basic',
    university_id: ' 001234 ',
    locale: 'ar',
  };
  for (const [name, value] of Object.entries(fields))
    saveRegistrationDraftField(student, name, value, storage, 100);
  for (const name of [
    'email',
    'password',
    'confirmation',
    'university',
    'registered_at',
    'consent',
    'id',
  ])
    saveRegistrationDraftField(student, name, 'forbidden', storage, 100);
  assert.deepEqual(readRegistrationDraft(student, storage, 101), fields);
  assert.ok(!storage.getItem(draftKey(student))!.includes('forbidden'));
});

test('drafts expire after 24 hours and expired values are removed', () => {
  const storage = memory();
  saveRegistrationDraftField(account, 'email', 'student@example.test', storage, 100);
  assert.equal(REGISTRATION_DRAFT_TTL, 86_400_000);
  assert.deepEqual(readRegistrationDraft(account, storage, 99 + REGISTRATION_DRAFT_TTL), {
    email: 'student@example.test',
  });
  assert.deepEqual(readRegistrationDraft(account, storage, 100 + REGISTRATION_DRAFT_TTL), {});
  assert.equal(storage.getItem(draftKey(account)), null);
});

test('corrupted, incompatible, future-dated, cross-scope and injected records are safely discarded', () => {
  const storage = memory();
  saveRegistrationDraftField(account, 'email', 'student@example.test', storage, 100);
  const original = JSON.parse(storage.getItem(draftKey(account))!);
  for (const invalid of [
    '{',
    'null',
    '[]',
    JSON.stringify({ ...original, version: 2 }),
    JSON.stringify({ ...original, savedAt: 1000 }),
    JSON.stringify({ ...original, expiresAt: 1e15 }),
    JSON.stringify({ ...original, scope: draftKey(student) }),
    JSON.stringify({ ...original, fields: { password: 'injected' } }),
    JSON.stringify({ ...original, fields: { email: 42 } }),
    JSON.stringify({ ...original, fields: { email: 'x'.repeat(255) } }),
  ]) {
    storage.setItem(draftKey(account), invalid);
    assert.deepEqual(readRegistrationDraft(account, storage, 101), {});
    assert.equal(storage.getItem(draftKey(account)), null);
  }
});

test('profile drafts are isolated by user and manual clearing preserves other drafts/preferences', () => {
  const storage = memory();
  const other: DraftScope = { kind: 'profile', userId: 'student-b' };
  saveRegistrationDraftField(student, 'full_name', 'First Student', storage, 100);
  saveRegistrationDraftField(other, 'full_name', 'Other Student', storage, 100);
  storage.setItem('ianalyze.language', 'ar');
  assert.deepEqual(readRegistrationDraft(account, storage, 101), {});
  clearRegistrationDraft(student, storage);
  assert.deepEqual(readRegistrationDraft(student, storage, 101), {});
  assert.deepEqual(readRegistrationDraft(other, storage, 101), { full_name: 'Other Student' });
  assert.equal(storage.getItem('ianalyze.language'), 'ar');
});

test('each edit merges the latest persisted fields instead of writing a stale tab snapshot', () => {
  const storage = memory();
  saveRegistrationDraftField(student, 'full_name', 'Old Name', storage, 100);
  const staleSnapshot = readRegistrationDraft(student, storage, 101);
  saveRegistrationDraftField(student, 'full_name', 'New Name', storage, 102);
  saveRegistrationDraftField(student, 'university_id', '001234', storage, 103);
  assert.equal(staleSnapshot.full_name, 'Old Name');
  assert.deepEqual(readRegistrationDraft(student, storage, 104), {
    full_name: 'New Name',
    university_id: '001234',
  });
});

test('blocked storage never breaks registration and reports inability to persist', () => {
  const storage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
  assert.deepEqual(readRegistrationDraft(account, storage), {});
  assert.equal(
    saveRegistrationDraftField(account, 'email', 'student@example.test', storage),
    false,
  );
  assert.doesNotThrow(() => clearRegistrationDraft(account, storage));
});

test('restored values still go through existing University ID validation', () => {
  const storage = memory();
  saveRegistrationDraftField(student, 'university_id', 'student@example.test', storage, 100);
  const form = new FormData();
  for (const [name, value] of Object.entries(readRegistrationDraft(student, storage, 101)))
    form.set(name, value);
  assert.equal(validateProfile(form, true).university_id, 'invalidUniversityId');
  form.set('university_id', '');
  assert.equal(validateProfile(form, true).university_id, 'requiredField');
});
