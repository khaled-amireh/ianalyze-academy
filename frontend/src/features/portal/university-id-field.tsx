import { useState, type ChangeEventHandler } from 'react';
import { FormField } from '@/components/shared/form-field';
import { Input } from '@/components/ui/input';
import { usePortalCopy } from './copy';
import { errorAttributes, type ValidationCode } from './form-validation';

export function UniversityIdField({
  id,
  value,
  onChange,
  required = true,
  error,
}: {
  id: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  required?: boolean;
  error?: ValidationCode;
}) {
  const { c, arabic } = usePortalCopy();
  const [open, setOpen] = useState(false);
  return (
    <FormField
      id={id}
      label={required ? c.universityIdRequired : c.universityId}
      error={error ? c[error] : undefined}
    >
      <div className="university-id-control">
        <Input
          {...errorAttributes(id, error, open)}
          name="university_id"
          required={required}
          inputMode="numeric"
          dir="ltr"
          maxLength={50}
          value={value}
          onChange={onChange}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        />
        {open && (
          <div
            id={id + '-hint'}
            role="tooltip"
            className="university-id-hint"
            dir={arabic ? 'rtl' : 'ltr'}
          >
            {c.universityIdHint}
          </div>
        )}
      </div>
    </FormField>
  );
}
