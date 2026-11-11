import { Button } from '@/components/ui/button';
import { usePortalCopy } from './copy';

export function RegistrationDraftNotice({
  onClear,
  disabled,
  unavailable,
}: {
  onClear: () => void;
  disabled: boolean;
  unavailable: boolean;
}) {
  const { c } = usePortalCopy();
  return (
    <div>
      <p className="field-hint">{unavailable ? c.draftUnavailable : c.draftPrivacy}</p>
      <Button type="button" variant="outline" disabled={disabled} onClick={onClear}>
        {c.clearSavedInformation}
      </Button>
    </div>
  );
}
