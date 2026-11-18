import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { client, useRemote, type Row } from '@/features/portal/data';
import { FormNotice } from '@/features/portal/form-feedback';
import { useWeek1Sync } from '@/features/week1/use-week1-sync';
import { requireWrite } from '@/features/week1/data';
import { loadAssignments, assignmentDownload } from './data';
import { AssignmentDetails } from './assignment-details';
import { useAssignmentCopy, assignmentTime } from './copy';
import { educationalFile, submissionLink, type Phase } from './domain';
import './assignments.css';
import { DraftForm, completeFormDraft } from '@/features/drafts';
export function StudentAssignments() {
  const { c, arabic } = useAssignmentCopy();
  const studentId = useAuth().user!.id;
  const load = useCallback(() => loadAssignments(studentId), [studentId]);
  const remote = useRemote(load);
  const data = remote.data;
  useWeek1Sync(remote.refresh, 'assignments');
  return (
    <section id="assignments" dir={arabic ? 'rtl' : 'ltr'}>
      <h2>{c.assignments}</h2>
      <p>{c.studentHelp}</p>
      {remote.error && <FormNotice message={c.error} kind="error" />}
      {!data ? (
        remote.error ? (
          <Button onClick={remote.refresh}>{c.retry}</Button>
        ) : (
          <p role="status">{c.loading}</p>
        )
      ) : (
        <>
          {!data.activities.length && <p>{c.empty}</p>}
          {data.activities.map((a) => (
            <StudentAssignment
              key={a.id}
              activity={a}
              submission={data.submissions.find((s) => s.activity_id === a.id)}
              grades={data.grades}
              reload={remote.refresh}
            />
          ))}
        </>
      )}
      {data && <PublicName currentName={data.leaderboardName} reload={remote.refresh} />}
    </section>
  );
}
function PublicName({ currentName, reload }: { currentName: string | null; reload: () => void }) {
  const { c } = useAssignmentCopy();
  const flight = useRef(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <details className="content-card">
      <summary>{c.publicName}</summary>
      <p>{c.publicNameHelp}</p>
      <DraftForm
        draftKey="public-name"
        baseVersion={currentName ?? ''}
        onSubmit={async (e) => {
          e.preventDefault();
          if (flight.current) return;
          flight.current = true;
          setBusy(true);
          setNotice('');
          const name = String(new FormData(e.currentTarget).get('leaderboard_name') ?? '').trim();
          const element = e.currentTarget;
          try {
            const user = await client().auth.getUser();
            if (!user.data.user) throw Error();
            requireWrite(
              await client()
                .from('profiles')
                .update({ leaderboard_name: name || null })
                .eq('id', user.data.user.id),
            );
            await completeFormDraft(element);
            setNotice(c.saved);
            reload();
          } catch {
            setNotice(c.error);
          } finally {
            flight.current = false;
            setBusy(false);
          }
        }}
      >
        <label>
          {c.publicName}
          <Input
            key={currentName}
            name="leaderboard_name"
            maxLength={80}
            defaultValue={currentName ?? ''}
            disabled={busy}
          />
        </label>
        <Button disabled={busy}>{c.save}</Button>
        <FormNotice message={notice} kind={notice === c.saved ? 'success' : 'error'} />
      </DraftForm>
    </details>
  );
}
function StudentAssignment({
  activity,
  submission,
  grades,
  reload,
}: {
  activity: Row<'activities'>;
  submission?: Row<'submissions'>;
  grades: Row<'grades'>[];
  reload: () => void;
}) {
  const { c, arabic } = useAssignmentCopy();
  const flight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'submitted' | 'error' | ''>('');
  const [mode, setMode] = useState(activity.submission_type === 'link' ? 'link' : 'file');
  const [deadlinePassed, setDeadlinePassed] = useState(
    () => Date.parse(activity.due_at!) <= Date.now(),
  );
  useEffect(() => {
    let timer: number;
    const check = () => {
      const remaining = Date.parse(activity.due_at!) - Date.now();
      setDeadlinePassed(remaining <= 0);
      if (remaining > 0) timer = window.setTimeout(check, Math.min(remaining, 2147483647));
    };
    timer = window.setTimeout(check, 0);
    return () => window.clearTimeout(timer);
  }, [activity.due_at]);
  const grade = grades.find((g) => g.submission_id === submission?.id && g.status === 'published');
  const finalized = submission && submission.status !== 'uploading';
  const phase = submission?.phase_snapshot as unknown as Phase | null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (flight.current) return;
    const form = new FormData(e.currentTarget);
    const element = e.currentTarget;
    const file = form.get('file') as File | null;
    const link = String(form.get('link') ?? '').trim();
    flight.current = true;
    setBusy(true);
    setNotice('');
    try {
      if (mode === 'link' && !submissionLink(link)) throw Error();
      const metadata = mode === 'file' ? educationalFile(file!) : null;
      const id = await client().rpc('submit_assignment', {
        p_activity: activity.id,
        p_request: crypto.randomUUID(),
        ...(mode === 'link' ? { p_link: link } : { p_file: metadata }),
      });
      requireWrite(id);
      if (metadata) {
        const row = await client().from('submissions').select('*').eq('id', id.data!).single();
        requireWrite(row);
        if (row.data!.status === 'uploading') {
          const upload = await client()
            .storage.from('student-submissions')
            .upload(row.data!.attachment_path!, file!, {
              contentType: metadata.mime,
              upsert: false,
            });
          if (upload.error && upload.error.message !== 'The resource already exists')
            throw upload.error;
          requireWrite(await client().rpc('finalize_assignment', { p_submission: id.data! }));
        }
      }
      const confirmed = await client()
        .from('submissions')
        .select('status')
        .eq('id', id.data!)
        .single();
      requireWrite(confirmed);
      if (confirmed.data?.status === 'uploading') throw Error();
      await completeFormDraft(element);
      setNotice('submitted');
      reload();
    } catch {
      setNotice('error');
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <article className="content-card assignment-card" data-assignment-id={activity.id}>
      <h3>{arabic ? activity.title_ar : activity.title_en}</h3>
      <AssignmentDetails activity={activity} />
      <p role="status">
        {c.status}: <strong>{finalized ? (grade ? c.reviewed : c.pending) : c.notSubmitted}</strong>
      </p>
      {finalized ? (
        <>
          <p>
            {c.submittedAt}:{' '}
            <time dateTime={submission.submitted_at!}>
              {assignmentTime(submission.submitted_at!, arabic)}
            </time>
          </p>
          <p>
            {c.phase}: {phase?.name} · {c.maximum}: {submission.max_eligible_points}
          </p>
          {submission.link_url && (
            <a href={submission.link_url} target="_blank" rel="noopener noreferrer" dir="ltr">
              {submission.link_url} ↗
            </a>
          )}
          {submission.attachment_path && (
            <Button
              variant="outline"
              onClick={() =>
                void assignmentDownload(submission.attachment_path!, submission.file_name!).catch(
                  () => setNotice('error'),
                )
              }
            >
              {c.download}
            </Button>
          )}
          {grade && (
            <section>
              <p>
                {c.awarded}: <strong>{grade.awarded_points}</strong> /{' '}
                {submission.max_eligible_points}
              </p>
              <h4>{c.feedback}</h4>
              <p className="assignment-instructions">{grade.feedback || c.noFeedback}</p>
              <p>
                {c.reviewedAt}: {assignmentTime(grade.published_at!, arabic)}
              </p>
            </section>
          )}
        </>
      ) : !activity.accepting || deadlinePassed ? (
        <p>{c.closed}</p>
      ) : (
        <DraftForm
          draftKey={`student-assignment:${activity.id}`}
          baseVersion={`${activity.version}:${submission?.status ?? 'new'}`}
          extra={{ mode }}
          restoreExtra={(value) => {
            const data = value as { mode?: string };
            if (data.mode === 'file' || data.mode === 'link') setMode(data.mode);
          }}
          onSubmit={submit}
          aria-busy={busy}
        >
          <fieldset disabled={busy}>
            {activity.submission_type === 'either' && (
              <label>
                {c.submissionType}
                <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="file">{c.file}</option>
                  <option value="link">{c.link}</option>
                </select>
              </label>
            )}
            {activity.submission_type !== 'link' && (
              <label data-mode="file" hidden={mode !== 'file'}>
                {c.file}
                <Input
                  name="file"
                  type="file"
                  accept=".pdf,.csv,.xlsx,.pbix,.zip"
                  required
                  disabled={mode !== 'file'}
                />
                <small>{c.fileHelp}</small>
              </label>
            )}
            {activity.submission_type !== 'file' && (
              <label data-mode="link" hidden={mode !== 'link'}>
                {c.link}
                <Input
                  name="link"
                  type="url"
                  dir="ltr"
                  maxLength={2000}
                  required
                  disabled={mode !== 'link'}
                />
              </label>
            )}
            <Button disabled={busy}>{c.submit}</Button>
          </fieldset>
          {submission?.status === 'uploading' && <p>{c.resumeUpload}</p>}
        </DraftForm>
      )}
      <FormNotice
        message={notice ? c[notice] : ''}
        kind={notice === 'submitted' ? 'success' : 'error'}
      />
    </article>
  );
}
