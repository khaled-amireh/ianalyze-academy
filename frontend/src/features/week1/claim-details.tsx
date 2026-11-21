import { FormNotice } from '@/features/portal/form-feedback';
import type { Claim } from './data';
import { formatTime, useWeek1Copy, claimStatusText } from './copy';
import { isIgnoredClaim } from './domain';
export function ClaimDetails({ claim }: { claim: Claim }) {
  const { c, arabic } = useWeek1Copy();
  return (
    <div className="week1-claim">
      <p>
        {c.reference}:{' '}
        <strong className="week1-reference" dir="ltr">
          {claim.reference}
        </strong>
      </p>
      <p>
        {c.status}: <strong>{claimStatusText(claim, c)}</strong>
      </p>
      <p>
        {c.timestamp}: {formatTime(claim.created_at, arabic)}
      </p>
      <p>
        {c.round}: <bdi>{claim.round_id}</bdi>
      </p>
      <h3>{c.winningLine}</h3>
      <ol>
        {(claim.challenges as number[]).map((id, i) => (
          <li key={id}>
            {c.position} {Number((claim.winning_line as number[])[i]) + 1}: {c.challenges[id]}
          </li>
        ))}
      </ol>
      {claim.rejection_reason && (
        <FormNotice
          message={
            isIgnoredClaim(claim) ? c.ignoredHelp : `${c.rejection}: ${claim.rejection_reason}`
          }
          kind={isIgnoredClaim(claim) ? 'info' : 'error'}
        />
      )}
      {claim.reviewed_at && (
        <p>
          {c.reviewed}: {formatTime(claim.reviewed_at, arabic)}
        </p>
      )}
      {claim.status === 'pending' && <p>{c.pendingHelp}</p>}
    </div>
  );
}
