import { checked, client } from '@/features/portal/data';
import { fetchAll } from '@/lib/fetch-all';
export async function loadAssignments(studentId: string) {
  const db = client();
  const [activities, submissions, grades, profile] = await Promise.all([
    fetchAll((start, end) =>
      db
        .from('activities')
        .select('*', { count: 'exact' })
        .eq('assignment_mode', true)
        .order('sort_order')
        .order('id')
        .range(start, end),
    ),
    fetchAll((start, end) =>
      db
        .from('submissions')
        .select('*', { count: 'exact' })
        .eq('assignment_submission', true)
        .eq('student_id', studentId)
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
    db.from('profiles').select('public_full_name_consent').eq('id', studentId).single(),
  ]);
  return {
    activities,
    submissions,
    grades: grades.filter((grade) =>
      submissions.some((submission) => submission.id === grade.submission_id),
    ),
    publicFullNameConsent: checked(profile).public_full_name_consent,
  };
}
export async function assignmentDownload(path: string, name: string) {
  const blob = checked(await client().storage.from('student-submissions').download(path));
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
