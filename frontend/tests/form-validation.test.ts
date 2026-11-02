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
    major: 'AI',
    academic_year: '4',
    python_experience: 'basic',
    consent: 'on',
  };
  assert.deepEqual(validateProfile(form(valid), true), {});
  for (const year of ['0', '9', '2.5', 'Infinity', '1e0'])
    assert.equal(
      validateProfile(form({ ...valid, academic_year: year }), true).academic_year,
      'invalidYear',
    );
  assert.equal(
    validateProfile(form({ ...valid, academic_year: '' }), true).academic_year,
    'missingYear',
  );
  assert.equal(
    validateProfile(form({ ...valid, whatsapp: '0790000001' }), true).whatsapp,
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
