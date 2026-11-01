import type { PropsWithChildren } from 'react';
import { MixedText } from './mixed-text';

/** Caller associates the control with inputId and the documented hint/error IDs. */
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: PropsWithChildren<{ id: string; label: string; hint?: string; error?: string }>) {
  return (
    <div className="form-field">
      <label htmlFor={id}>
        <MixedText>{label}</MixedText>
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          <MixedText>{hint}</MixedText>
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          <MixedText>{error}</MixedText>
        </p>
      )}
    </div>
  );
}
