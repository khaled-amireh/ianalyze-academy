export const winningLines = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
  [0, 4, 8, 12],
  [1, 5, 9, 13],
  [2, 6, 10, 14],
  [3, 7, 11, 15],
  [0, 5, 10, 15],
  [3, 6, 9, 12],
] as const;
// Audit note for Ignore, stored through the existing rejected transition.
export const BINGO_IGNORE_REASON = 'Ignored by organizer.';
export function datasetStatistics(attempts: { status: string; student_id: string }[]) {
  const submitted = attempts.filter((attempt) => attempt.status === 'submitted');
  return {
    total: submitted.length,
    students: new Set(submitted.map((attempt) => attempt.student_id)).size,
  };
}
export function isIgnoredClaim(claim: { status: string; rejection_reason: string | null } | null) {
  return claim?.status === 'rejected' && claim.rejection_reason === BINGO_IGNORE_REASON;
}
export function bingoLine(order: number[], completed: number[]) {
  return winningLines.find((line) =>
    line.every((position) => completed.includes(order[position]!)),
  );
}
export function isKaggleDataset(value: string) {
  return (
    value.length <= 500 &&
    /^https:\/\/(www\.)?kaggle\.com\/datasets\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/.test(
      value.trim(),
    )
  );
}
export type SessionTopic = {
  visible?: boolean;
  id: string;
  title_en: string;
  title_ar: string;
  description: string;
  notes: string;
  links: string;
  status: 'planned' | 'completed';
};
export function safeLinks(value: string) {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .every((s) => {
      try {
        const u = new URL(s);
        return ['https:', 'http:'].includes(u.protocol) && !/\s/.test(s);
      } catch {
        return false;
      }
    });
}
