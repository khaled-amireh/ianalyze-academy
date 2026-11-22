export type SubmissionWindowState = 'upcoming' | 'open' | 'closed';

export function submissionWindowState(
  opensAt: string | null,
  dueAt: string | null,
  now = Date.now(),
): SubmissionWindowState {
  if (opensAt) {
    const opens = Date.parse(opensAt);
    if (!Number.isFinite(opens)) return 'closed';
    if (now < opens) return 'upcoming';
  }
  if (dueAt) {
    const deadline = Date.parse(dueAt);
    if (!Number.isFinite(deadline) || now > deadline) return 'closed';
  }
  return 'open';
}
