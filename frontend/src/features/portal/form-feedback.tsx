import { useState } from 'react';
import { CircleAlert, CircleCheck, Info, Eye, EyeOff } from 'lucide-react';
import { MixedText } from '@/components/shared/mixed-text';
import { FormField } from '@/components/shared/form-field';
import { Input } from '@/components/ui/input';
import { errorAttributes, type ValidationCode } from './form-validation';
import type { PortalCopy } from './copy';

export function FormNotice({
  message,
  kind = 'info',
}: {
  message: string;
  kind?: 'error' | 'success' | 'info';
}) {
  if (!message) return null;
  const Icon = kind === 'error' ? CircleAlert : kind === 'success' ? CircleCheck : Info;
  return (
    <div
      className={`portal-notice portal-notice-${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <Icon aria-hidden="true" size={18} />
      <p>
        <MixedText>{message}</MixedText>
      </p>
    </div>
  );
}
export function PasswordField({
  id,
  name,
  label,
  error,
  c,
  current = false,
  hint = false,
}: {
  id: string;
  name: string;
  label: string;
  error?: ValidationCode;
  c: PortalCopy;
  current?: boolean;
  hint?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <FormField
      id={id}
      label={label}
      error={error ? c[error] : undefined}
      hint={hint ? c.passwordHint : undefined}
    >
      <div className="portal-password">
        <Input
          {...errorAttributes(id, error, hint)}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={current ? 'current-password' : 'new-password'}
          minLength={current ? 1 : 12}
          maxLength={128}
          required
          dir="ltr"
        />
        <button
          type="button"
          className="portal-password-toggle"
          aria-label={`${visible ? c.hidePassword : c.showPassword}: ${label}`}
          aria-controls={id}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          <Icon aria-hidden="true" size={18} />
        </button>
      </div>
    </FormField>
  );
}
