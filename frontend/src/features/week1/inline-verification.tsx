import { useState } from 'react';
import { useAuth } from '@/features/auth/use-auth';
import { useRemote } from '@/features/portal/data';
import { FormNotice } from '@/features/portal/form-feedback';
import { Button } from '@/components/ui/button';
import { ClaimDetails } from './claim-details';
import { loadPendingBingoReview, type Claim } from './data';
import { BINGO_IGNORE_REASON } from './domain';
import { useWeek1Copy } from './copy';
import { useClaimReview } from './use-claim-review';
import { useWeek1Sync } from './use-week1-sync';

// Gate before mounting the loader; ordinary students never request this queue.
export function InlineBingoVerification() {
  const auth = useAuth();
  return auth.status === 'signed-in' && auth.role === 'team' ? <PendingQueue /> : null;
}
function PendingQueue() {
  const { c, arabic } = useWeek1Copy();
  const remote = useRemote(loadPendingBingoReview);
  const [page, setPage] = useState(0);
  useWeek1Sync(remote.refresh, 'bingo');
  const data = remote.data;
  const current = Math.min(page, Math.max(0, Math.ceil((data?.claims.length ?? 0) / 20) - 1));
  return (
    <section
      className="content-card week1-verification"
      id="bingo-organizer-verification"
      dir={arabic ? 'rtl' : 'ltr'}
      aria-labelledby="bingo-verification-title"
    >
      <div className="portal-actions">
        <h2 id="bingo-verification-title">{c.organizerVerification}</h2>
      </div>
      <p>{c.inlineReviewHelp}</p>
      {remote.error && <FormNotice message={c.unavailable} kind="error" />}
      {!data ? (
        !remote.error && <p role="status">{c.loading}</p>
      ) : (
        <>
          {!data.claims.length && <p role="status">{c.noPendingClaims}</p>}
          {data.claims.slice(current * 20, current * 20 + 20).map((claim) => {
            const profile = data.profiles.find((profile) => profile.id === claim.student_id);
            return (
              <article key={claim.id} className="week1-pending-claim" data-claim-id={claim.id}>
                <h3>
                  <bdi dir="auto">{profile?.full_name || c.student}</bdi>
                </h3>
                <ClaimDetails claim={claim} />
                <InlineReviewActions
                  claim={claim}
                  onReviewed={() => {
                    remote.update((current) => ({
                      ...current,
                      claims: current.claims.filter((item) => item.id !== claim.id),
                    }));
                    remote.refresh();
                  }}
                  refresh={remote.refresh}
                />
              </article>
            );
          })}
          {data.claims.length > 20 && (
            <nav className="portal-actions" aria-label={c.organizerVerification}>
              <Button
                variant="outline"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                {c.previous}
              </Button>
              <bdi>
                {current + 1} / {Math.ceil(data.claims.length / 20)}
              </bdi>
              <Button
                variant="outline"
                disabled={(current + 1) * 20 >= data.claims.length}
                onClick={() => setPage(current + 1)}
              >
                {c.next}
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
function InlineReviewActions({
  claim,
  onReviewed,
  refresh,
}: {
  claim: Claim;
  onReviewed: () => void;
  refresh: () => void;
}) {
  const { c } = useWeek1Copy();
  const { busy, notice, review } = useClaimReview(claim.id, onReviewed, refresh);
  return (
    <>
      <div className="week1-verification-actions">
        <Button size="lg" disabled={busy} onClick={() => void review('verified')}>
          {c.verify}
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (window.confirm(c.confirmIgnore)) void review('rejected', BINGO_IGNORE_REASON);
          }}
        >
          {c.ignore}
        </Button>
      </div>
      <FormNotice
        message={notice ? c[notice] : ''}
        kind={notice === 'saved' ? 'success' : 'error'}
      />
    </>
  );
}
