import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { client } from '@/features/portal/data';
import { FormNotice } from '@/features/portal/form-feedback';
import { requireWrite } from '@/features/week1/data';
import { useAssignmentCopy } from './copy';
export function ParticipationApproval({
  attemptId,
  approved,
  onApproved,
}: {
  attemptId: string;
  approved: boolean;
  onApproved: () => void;
}) {
  const { c } = useAssignmentCopy();
  const flight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div>
      <p>{approved ? c.participationApproved : c.participationHelp}</p>
      {!approved && (
        <Button
          disabled={busy}
          onClick={async () => {
            if (flight.current) return;
            flight.current = true;
            setBusy(true);
            setError(false);
            try {
              requireWrite(
                await client().rpc('approve_dataset_participation', { p_attempt: attemptId }),
              );
              onApproved();
            } catch {
              setError(true);
            } finally {
              flight.current = false;
              setBusy(false);
            }
          }}
        >
          {c.approveParticipation}
        </Button>
      )}
      {error && <FormNotice message={c.error} kind="error" />}
    </div>
  );
}
