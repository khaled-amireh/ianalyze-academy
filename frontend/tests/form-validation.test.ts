import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAuth,
  validateProfile,
  requestError,
} from '../src/features/portal/form-validation.ts';
const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
test('signup rejects incomplete, malformed and mismatched values before a request; recovery and login keep their own rules', () => {
  assert.deepEqual(validateAuth(form({}), 'signup'), {
    email: 'requiredField',
    password: 'requiredField',
    confirmation: 'requiredField',
    consent: 'consentRequired',
  });
  assert.equal(
    validateAuth(
      form({ email: 'invalid', password: 'short', confirmation: 'other', consent: 'on' }),
      'signup',
    ).email,
    'invalidEmail',
  );
  const x = validateAuth(
    form({
      email: 'learner@example.org',
      password: 'short',
      confirmation: 'different',
      consent: 'on',
    }),
    'signup',
  );
  assert.equal(x.password, 'shortPassword');
  assert.equal(x.confirmation, 'passwordMismatch');
  const valid = {
    email: ' learner@example.org ',
    password: 'Private-valid-123',
    confirmation: 'Private-valid-123',
    consent: 'on',
  };
  assert.deepEqual(validateAuth(form(valid), 'signup'), {});
  assert.deepEqual(validateAuth(form({ email: valid.email }), 'recover'), {});
  assert.deepEqual(validateAuth(form({ email: valid.email, password: 'old' }), 'login'), {});
  assert.deepEqual(
    validateAuth(form({ password: valid.password, confirmation: valid.confirmation }), 'reset'),
    {},
  );
});
test('registration validates the database contract without accepting partial consent, invalid years or foreign phone syntax', () => {
  const valid = {
    full_name: 'Learner',
    whatsapp: '+962790000001',
    major: 'Data Science & Artificial Intelligence',
    university_id: '202311432',
    academic_year: '4',
    python_experience: 'basic',
    consent: 'on',
  };
  assert.deepEqual(validateProfile(form(valid), true), {});
  for (const year of ['0', '6', '7', '8', '9', '2.5', 'Infinity', '1e0'])
    assert.equal(
      validateProfile(form({ ...valid, academic_year: year }), true).academic_year,
      'invalidYear',
    );
  assert.equal(
    validateProfile(form({ ...valid, academic_year: '' }), true).academic_year,
    'missingYear',
  );
  assert.deepEqual(validateProfile(form({ ...valid, whatsapp: '0790000001' }), true), {});
  assert.equal(
    validateProfile(form({ ...valid, whatsapp: '0760000001' }), true).whatsapp,
    'invalidPhone',
  );
  const legacy = { whatsapp: '+447700900123', academic_year: 7 };
  assert.deepEqual(
    validateProfile(
      form({ ...valid, whatsapp: legacy.whatsapp, academic_year: '7' }),
      false,
      legacy,
    ),
    {},
  );
  assert.equal(
    validateProfile(form({ ...valid, academic_year: '7' }), true, legacy).academic_year,
    'invalidYear',
  );
  assert.equal(
    validateProfile(form({ ...valid, whatsapp: '+447700900124' }), false, legacy).whatsapp,
    'invalidPhone',
  );
  assert.equal(validateProfile(form({ ...valid, consent: '' }), true).consent, 'consentRequired');
  assert.deepEqual(validateProfile(form({ ...valid, consent: '' }), false), {});
  assert.equal(
    validateProfile(form({ ...valid, full_name: '   ' }), true).full_name,
    'requiredField',
  );
});
test('SDK returned errors map to safe actionable copy; arbitrary server text is never shown', () => {
  assert.equal(requestError({ code: 'invalid_credentials' }), 'invalidCredentials');
  assert.equal(requestError({ code: 'email_not_confirmed' }), 'confirmEmail');
  assert.equal(requestError({ name: 'AuthRetryableFetchError', status: 0 }), 'networkError');
  assert.equal(requestError(new TypeError('private transport details')), 'networkError');
  assert.equal(requestError({ status: 429 }), 'rateLimited');
  assert.equal(requestError({ code: 'PGRST301' }), 'sessionExpired');
  assert.equal(requestError({ message: 'private database details' }), 'error');
});

test('major Other, historical values, required university IDs and conflict messages', () => {
  const valid = {
    full_name: 'Student',
    whatsapp: '0790000001',
    major: 'other',
    major_other: 'Historical custom major',
    university_id: '202311432',
    academic_year: '4',
    python_experience: 'none',
    consent: 'on',
  };
  assert.deepEqual(validateProfile(form(valid), true), {});
  assert.equal(
    validateProfile(form({ ...valid, major_other: '' }), true).major_other,
    'requiredField',
  );
  assert.equal(
    validateProfile(form({ ...valid, major: 'Unlisted text' }), true).major,
    'requiredField',
  );
  const zuj = { ...valid, university: 'Al-Zaytoonah University of Jordan' };
  for (const university_id of ['abc', 'student@example.org', '١٢٣', '123456789012345678901'])
    assert.equal(
      validateProfile(form({ ...zuj, university_id }), true).university_id,
      'invalidUniversityId',
    );
  assert.deepEqual(validateProfile(form({ ...zuj, university_id: ' 202311432 ' }), true), {});
  assert.equal(
    validateProfile(form({ ...valid, university_id: '   ' }), true).university_id,
    'requiredField',
  );
  assert.equal(
    requestError({
      code: '23505',
      message: 'duplicate key violates unique constraint "profiles_zuj_university_id_unique"',
    }),
    'duplicateUniversityId',
  );
});

test('only editing a verified team profile may preserve unchanged incomplete fields', () => {
  const incomplete = {
    full_name: 'Historical Team',
    major: null,
    whatsapp: null,
    academic_year: null,
    python_experience: null,
    university_id: null,
  };
  const values = { full_name: 'Updated Team', locale: 'en' };
  assert.deepEqual(validateProfile(form(values), false, incomplete, true), {});
  assert.equal(validateProfile(form(values), false, incomplete).university_id, 'requiredField');
  assert.equal(
    validateProfile(form(values), true, incomplete, true).university_id,
    'requiredField',
  );
  for (const university_id of ['email@example.org', '12 34', '123456789012345678901'])
    assert.equal(
      validateProfile(form({ ...values, university_id }), false, incomplete, true).university_id,
      'invalidUniversityId',
    );
  assert.equal(
    validateProfile(
      form({ ...values, university_id: '' }),
      false,
      { ...incomplete, university_id: '1234' },
      true,
    ).university_id,
    'requiredField',
  );
  assert.deepEqual(
    validateProfile(
      form({ ...values, university_id: 'legacy' }),
      false,
      { ...incomplete, university_id: 'legacy' },
      true,
    ),
    {},
  );
});
