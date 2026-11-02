export type ValidationCode =
  | 'requiredField'
  | 'invalidEmail'
  | 'shortPassword'
  | 'passwordMismatch'
  | 'invalidPhone'
  | 'missingYear'
  | 'invalidYear'
  | 'consentRequired'
  | 'tooLong';
export type FieldErrors = Record<string, ValidationCode>;
export type AuthMode = 'login' | 'signup' | 'recover' | 'reset';
const value = (form: FormData, name: string) => String(form.get(name) ?? '');
export function validateAuth(form: FormData, mode: AuthMode): FieldErrors {
  const errors: FieldErrors = {};
  const email = value(form, 'email').trim();
  const password = value(form, 'password');
  if (mode !== 'reset') {
    if (!email) errors.email = 'requiredField';
    else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = 'invalidEmail';
  }
  if (mode !== 'recover') {
    if (!password) errors.password = 'requiredField';
    else if (mode !== 'login' && password.length < 12) errors.password = 'shortPassword';
    else if (password.length > 128) errors.password = 'tooLong';
  }
  if (mode === 'signup' || mode === 'reset') {
    if (!value(form, 'confirmation')) errors.confirmation = 'requiredField';
    else if (password !== value(form, 'confirmation')) errors.confirmation = 'passwordMismatch';
  }
  if (mode === 'signup' && form.get('consent') !== 'on') errors.consent = 'consentRequired';
  return errors;
}
export function validateProfile(form: FormData, registering: boolean): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of ['full_name', 'major']) {
    const text = value(form, field).trim();
    if (!text) errors[field] = 'requiredField';
    else if (text.length > 150) errors[field] = 'tooLong';
  }
  const phone = value(form, 'whatsapp').trim();
  if (!phone) errors.whatsapp = 'requiredField';
  else if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) errors.whatsapp = 'invalidPhone';
  const year = value(form, 'academic_year');
  if (!year) errors.academic_year = 'missingYear';
  else if (!/^[1-8]$/.test(year)) errors.academic_year = 'invalidYear';
  if (!['none', 'basic', 'experienced'].includes(value(form, 'python_experience')))
    errors.python_experience = 'requiredField';
  if (value(form, 'university_id').trim().length > 50) errors.university_id = 'tooLong';
  if (registering && form.get('consent') !== 'on') errors.consent = 'consentRequired';
  return errors;
}
export function requestError(error: unknown) {
  const e = error as { code?: string; status?: number; name?: string; message?: string } | null;
  if (e?.code === 'email_not_confirmed') return 'confirmEmail';
  if (e?.code === 'invalid_credentials') return 'invalidCredentials';
  if (
    e?.status === 429 ||
    ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(e?.code ?? '')
  )
    return 'rateLimited';
  if (
    e?.status === 401 ||
    e?.name === 'AuthSessionMissingError' ||
    [
      'session_not_found',
      'refresh_token_not_found',
      'refresh_token_already_used',
      'PGRST301',
      'PGRST303',
    ].includes(e?.code ?? '') ||
    e?.message === 'Authentication required'
  )
    return 'sessionExpired';
  if (e?.code === 'weak_password') return 'passwordRejected';
  if (e?.name === 'TypeError' || e?.name === 'AuthRetryableFetchError' || e?.status === 0)
    return 'networkError';
  return 'error';
}
export function focusFirstError(form: HTMLFormElement, errors: FieldErrors) {
  const first = Object.keys(errors)[0];
  if (!first) return;
  const input = form.elements.namedItem(first);
  if (input instanceof HTMLElement) input.focus();
}
export function errorAttributes(id: string, error?: ValidationCode, hint = false) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby':
      [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
  };
}
