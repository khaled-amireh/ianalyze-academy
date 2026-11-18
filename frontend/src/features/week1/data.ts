import { checked, client, type Row } from '@/features/portal/data';
import { fetchAll } from '@/lib/fetch-all';

export async function loadWeek1Student(studentId: string, activity?: 'dataset' | 'bingo') {
  const db = client();
  const [profile, dataset, boards, claims, participation] = await Promise.all([
    db.from('profiles').select('registered_at').eq('id', studentId).single(),
    activity === 'bingo'
      ? Promise.resolve([] as Row<'week1_datasets'>[])
      : fetchAll((start, end) =>
          db
            .from('week1_datasets')
            .select('*', { count: 'exact' })
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(start, end),
        ),
    activity === 'dataset'
      ? Promise.resolve([] as Row<'week1_bingo_boards'>[])
      : fetchAll((start, end) =>
          db
            .from('week1_bingo_boards')
            .select('*', { count: 'exact' })
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(start, end),
        ),
    activity === 'dataset'
      ? Promise.resolve([] as Row<'week1_bingo_claims'>[])
      : fetchAll((start, end) =>
          db
            .from('week1_bingo_claims')
            .select('*', { count: 'exact' })
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(start, end),
        ),
    activity === 'bingo'
      ? Promise.resolve({ data: null, error: null })
      : db
          .from('point_awards')
          .select('points')
          .eq('student_id', studentId)
          .eq('source_key', 'dataset:week1')
          .maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (participation.error) throw participation.error;
  const board = boards.find((item) => !item.retired_at) ?? null;
  return {
    registered: Boolean(profile.data?.registered_at),
    dataset: dataset.find((item) => item.status === 'draft') ?? dataset[0] ?? null,
    datasetAttempts: dataset,
    participationPoints: participation.data?.points ?? null,
    board,
    claim: claims.find((item) => item.round_id === board?.id) ?? null,
    previousRounds: boards
      .filter((item) => item.retired_at)
      .map((item) => ({
        board: item,
        number: boards.length - boards.findIndex((board) => board.id === item.id),
        claims: claims.filter((claim) => claim.round_id === item.id),
      })),
  };
}
export type StudentWeek1 = Awaited<ReturnType<typeof loadWeek1Student>>;
export type Claim = Row<'week1_bingo_claims'>;
async function loadBingoReview(pendingOnly: boolean) {
  const db = client();
  const [claims, profiles] = await Promise.all([
    fetchAll((start, end) => {
      const query = db.from('week1_bingo_claims').select('*', { count: 'exact' });
      return (pendingOnly ? query.eq('status', 'pending') : query)
        .order('created_at', { ascending: false })
        .order('id')
        .range(start, end);
    }),
    fetchAll((start, end) =>
      db
        .from('profiles')
        .select('id, full_name, university_id', { count: 'exact' })
        .order('id')
        .range(start, end),
    ),
  ]);
  return { claims, profiles };
}
export function loadPendingBingoReview() {
  return loadBingoReview(true);
}
export async function loadDatasetSubmissions() {
  const db = client();
  const [datasets, profiles, awards] = await Promise.all([
    fetchAll((start, end) =>
      db
        .from('week1_datasets')
        .select('*', { count: 'exact' })
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .order('id')
        .range(start, end),
    ),
    fetchAll((start, end) =>
      db.from('profiles').select('id, full_name', { count: 'exact' }).order('id').range(start, end),
    ),
    fetchAll((start, end) =>
      db
        .from('point_awards')
        .select('student_id,points', { count: 'exact' })
        .eq('source_key', 'dataset:week1')
        .order('student_id')
        .range(start, end),
    ),
  ]);
  return { datasets, profiles, awards };
}
export async function loadWeek1Session() {
  return checked(await client().from('week1_session').select('*').eq('id', 1).single());
}
export function requireWrite(result: { error: unknown }) {
  if (result.error) throw result.error;
}
export function isConflict(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    ['40001', '23505'].includes(String(error.code)),
  );
}
