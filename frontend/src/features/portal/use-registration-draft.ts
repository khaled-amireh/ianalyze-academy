import { useRef, useState, type ChangeEvent } from 'react';
import {
  clearRegistrationDraft,
  readRegistrationDraft,
  saveRegistrationDraftField,
  type DraftScope,
  type DraftValues,
} from './registration-draft';

// Restore once, synchronously. Storage events and focus changes never replace
// current input; controlled non-secret fields are populated before first paint.
export function useRegistrationDraft(scope: DraftScope | null, defaults: DraftValues) {
  const [values, setValues] = useState(() => ({
    ...defaults,
    ...(scope ? readRegistrationDraft(scope) : {}),
  }));
  const [unavailable, setUnavailable] = useState(false);
  const active = useRef(true);
  const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const control = event.currentTarget;
    if (
      !(control instanceof HTMLInputElement || control instanceof HTMLSelectElement) ||
      control.type === 'password' ||
      !Object.hasOwn(defaults, control.name)
    )
      return;
    const { name, value } = control;
    setValues((current) => ({ ...current, [name]: value }));
    if (scope && active.current && !saveRegistrationDraftField(scope, name, value))
      setUnavailable(true);
  };
  const clear = () => {
    if (scope) clearRegistrationDraft(scope);
    setValues({ ...defaults });
  };
  const complete = () => {
    active.current = false;
    if (scope) clearRegistrationDraft(scope);
  };
  const field = (name: string) => ({ value: values[name] ?? '', onChange: change });
  return { values, field, clear, complete, unavailable };
}
