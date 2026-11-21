import { useRef, useState } from 'react';
import { client } from '@/features/portal/data';
import { isConflict, requireWrite } from './data';

// One guarded write path shared by /workspace and inline Bingo review.
export function useClaimReview(claimId: string, onReviewed: () => void, onConflict?: () => void) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'error' | 'conflict' | ''>('');
  async function review(status: 'verified' | 'rejected', reason = '') {
    if (inFlight.current || finalized) return;
    inFlight.current = true;
    setBusy(true);
    setNotice('');
    try {
      requireWrite(
        await client().rpc('week1_review_bingo', {
          p_id: claimId,
          p_status: status,
          p_reason: reason.trim(),
        }),
      );
      setFinalized(true);
      setNotice('saved');
      onReviewed();
    } catch (error) {
      setNotice(isConflict(error) ? 'conflict' : 'error');
      if (isConflict(error)) onConflict?.();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { busy: busy || finalized, notice, review };
}
