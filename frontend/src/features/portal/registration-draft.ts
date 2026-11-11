import { majors } from './profile-fields.ts';

export const REGISTRATION_DRAFT_TTL = 24 * 60 * 60 * 1000;
const VERSION = 1;
export type DraftScope = { kind: 'account' } | { kind: 'profile'; userId: string };
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type DraftValues = Record<string, string>;
const limits = {
  email: 254,
  full_name: 150,
  whatsapp: 64,
  major: 150,
  major_other: 150,
  academic_year: 1,
  python_experience: 11,
  university_id: 50,
  locale: 2,
};
export function draftKey(scope: DraftScope) {
  return `ianalyze.registration-draft.v${VERSION}.${scope.kind === 'account' ? 'account' : 'profile.' + encodeURIComponent(scope.userId)}`;
}
function browserStorage(): DraftStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
function allowed(scope: DraftScope, name: string) {
  return scope.kind === 'account'
    ? name === 'email'
    : name !== 'email' && Object.hasOwn(limits, name);
}
function valid(scope: DraftScope, name: string, value: unknown): value is string {
  if (
    !allowed(scope, name) ||
    typeof value !== 'string' ||
    value.length > limits[name as keyof typeof limits]
  )
    return false;
  if (name === 'locale') return ['ar', 'en'].includes(value);
  if (name === 'academic_year') return value === '' || /^[1-5]$/.test(value);
  if (name === 'python_experience') return ['', 'none', 'basic', 'experienced'].includes(value);
  if (name === 'major') return ['', 'other', ...majors.map((major) => major.value)].includes(value);
  return true;
}
export function clearRegistrationDraft(scope: DraftScope, storage = browserStorage()) {
  try {
    storage?.removeItem(draftKey(scope));
  } catch {
    /* Restricted storage must not block registration. */
  }
}
export function readRegistrationDraft(
  scope: DraftScope,
  storage = browserStorage(),
  now = Date.now(),
): DraftValues {
  try {
    const raw = storage?.getItem(draftKey(scope));
    if (!raw) return {};
    const draft = JSON.parse(raw);
    if (
      !draft ||
      draft.version !== VERSION ||
      draft.scope !== draftKey(scope) ||
      !Number.isFinite(draft.savedAt) ||
      draft.savedAt > now ||
      draft.expiresAt !== draft.savedAt + REGISTRATION_DRAFT_TTL ||
      draft.expiresAt <= now ||
      !draft.fields ||
      typeof draft.fields !== 'object' ||
      Array.isArray(draft.fields) ||
      !Object.entries(draft.fields).every(([name, value]) => valid(scope, name, value))
    ) {
      clearRegistrationDraft(scope, storage);
      return {};
    }
    return draft.fields;
  } catch {
    clearRegistrationDraft(scope, storage);
    return {};
  }
}
// Persist only a changed, explicitly allowed field. Merge the latest stored draft,
// so a stale tab cannot rewrite other fields using its older form snapshot.
export function saveRegistrationDraftField(
  scope: DraftScope,
  name: string,
  value: unknown,
  storage = browserStorage(),
  now = Date.now(),
) {
  if (!valid(scope, name, value)) return true;
  try {
    if (!storage) return false;
    const fields = { ...readRegistrationDraft(scope, storage, now), [name]: value };
    storage.setItem(
      draftKey(scope),
      JSON.stringify({
        version: VERSION,
        scope: draftKey(scope),
        savedAt: now,
        expiresAt: now + REGISTRATION_DRAFT_TTL,
        fields,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
