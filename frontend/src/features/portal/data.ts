import { useEffect, useState } from 'react';
import { academyClient } from '@/lib/academy-client';
import type { Database } from '@/types/database';
import { fetchAll } from '@/lib/fetch-all';
import { syllabus } from '@/content/public-content';
import en from '@/locales/en.json';
import ar from '@/locales/ar.json';
export type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export function client() {
  if (!academyClient) throw new Error('Backend unavailable');
  return academyClient;
}
export function checked<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error || result.data === null) throw new Error('Request failed');
  return result.data!;
}
export async function loadPortal() {
  const db = client();
  const [
    profiles,
    weeks,
    activities,
    rubrics,
    criteria,
    submissions,
    grades,
    scores,
    capabilities,
  ] = await Promise.all([
    fetchAll((start, end) =>
      db
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at')
        .order('id')
        .range(start, end),
    ),
    fetchAll((start, end) =>
      db
        .from('academy_weeks')
        .select('*', { count: 'exact' })
        .order('week_number')
        .range(start, end),
    ),
    fetchAll((start, end) =>
      db.from('activities').select('*', { count: 'exact' }).order('id').range(start, end),
    ),
    fetchAll((start, end) =>
      db
        .from('rubrics')
        .select('*', { count: 'exact' })
        .order('version')
        .order('id')
        .range(start, end),
    ),
    fetchAll((start, end) =>
      db
        .from('rubric_criteria')
        .select('*', { count: 'exact' })
        .order('sort_order')
        .order('id')
        .range(start, end),
    ),
    fetchAll((start, end) =>
      db
        .from('submissions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id')
        .range(start, end),
    ),
    fetchAll((start, end) =>
      db
        .from('grades')
        .select('*', { count: 'exact' })
        .order('revision', { ascending: false })
        .order('id')
        .range(start, end),
    ),
    fetchAll((start, end) =>
      db
        .from('grade_criterion_scores')
        .select('*', { count: 'exact' })
        .order('grade_id')
        .order('criterion_id')
        .range(start, end),
    ),
    db.rpc('academy_capabilities'),
  ]);
  return {
    profiles,
    weeks,
    activities,
    rubrics,
    criteria,
    submissions,
    grades,
    scores,
    capabilities: checked(capabilities) as { submissions: boolean; leaderboard: boolean },
  };
}
export type PortalData = Awaited<ReturnType<typeof loadPortal>>;
export function useRemote<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error: boolean }>({ error: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    void load()
      .then((data) => {
        if (alive) setState({ data, error: false });
      })
      .catch(() => {
        if (alive) setState((current) => ({ ...current, error: true }));
      });
    return () => {
      alive = false;
    };
  }, [load, revision]);
  return {
    ...state,
    update: (transform: (current: T) => T) => {
      setState((current) =>
        current.data ? { data: transform(current.data), error: false } : current,
      );
    },
    refresh: () => setRevision((v) => v + 1),
    reload: () => {
      setState({ error: false });
      setRevision((v) => v + 1);
    },
  };
}
export async function downloadNotebook(path: string, bucket = 'student-submissions') {
  const blob = checked(await client().storage.from(bucket).download(path));
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = path.split('/').at(-1) ?? 'download';
  anchor.rel = 'noopener';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// One translated source for public syllabus and both authenticated dashboards.
export const topics = syllabus.modules.map((module) => en.academy.modules[module.id].title);
export const topicsAr = syllabus.modules.map((module) => ar.academy.modules[module.id].title);
