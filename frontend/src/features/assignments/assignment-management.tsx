import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { client, type PortalData, type Row } from '@/features/portal/data';
import { FormNotice } from '@/features/portal/form-feedback';
import { requireWrite } from '@/features/week1/data';
import type { Json } from '@/types/database';
import { useAssignmentCopy, assignmentTime } from './copy';
import {
  ammanInput,
  fromAmmanInput,
  assignmentValidation,
  assignmentError,
  type Phase,
} from './domain';
import { DraftForm, completeFormDraft, hasLocalFormDraft } from '@/features/drafts';
import { useAuth } from '@/features/auth/use-auth';
import { assignmentDownload } from './data';
import './assignments.css';
export function AssignmentManagement({ data, reload }: { data: PortalData; reload: () => void }) {
  const { c, arabic } = useAssignmentCopy();
  const owner = useAuth().user?.id ?? '';
  const [creating, setCreating] = useState(() => hasLocalFormDraft(owner, 'assignment:new'));
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const assignments = data.activities
    .filter((a) => a.assignment_mode)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  async function action(
    a: Row<'activities'>,
    change: Partial<Row<'activities'>> | 'delete' | 'up' | 'down',
  ) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setNotice('');
    try {
      if (change === 'delete') {
        if (!window.confirm(c.confirmDelete)) return;
        requireWrite(await client().from('activities').delete().eq('id', a.id));
      } else if (typeof change === 'string')
        requireWrite(
          await client().rpc('move_assignment', {
            p_id: a.id,
            p_direction: change === 'up' ? -1 : 1,
            p_version: a.version,
          }),
        );
      else
        requireWrite(
          await client().rpc('save_assignment', {
            p_id: a.id,
            p_version: a.version,
            p_data: { ...a, ...change } as unknown as Json,
          }),
        );
      reload();
      setNotice(c.saved);
    } catch (e) {
      setNotice(c[assignmentError(e)]);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  function cards(archived: boolean) {
    return assignments
      .filter((a) => a.archived === archived)
      .map((a, index) => {
        const submissions = data.submissions.filter((s) => s.activity_id === a.id);
        return (
          <article
            className="s-card assignment-card"
            key={`${a.id}-${a.version}`}
            data-assignment-id={a.id}
          >
            <h3>{arabic ? a.title_ar : a.title_en}</h3>
            <p>
              {a.archived ? c.archived : a.status === 'published' ? c.published : c.draft} ·{' '}
              {a.accepting ? c.open : c.closed}
            </p>
            <div className="assignment-toolbar">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void action(a, { status: a.status === 'draft' ? 'published' : 'draft' })
                }
              >
                {a.status === 'draft' ? c.publish : c.hide}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void action(a, { accepting: !a.accepting })}
              >
                {a.accepting ? c.close : c.reopen}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void action(a, { archived: !a.archived })}
              >
                {a.archived ? c.restore : c.archive}
              </Button>
              {!archived && (
                <>
                  <Button
                    variant="outline"
                    disabled={busy || index === 0}
                    onClick={() => void action(a, 'up')}
                  >
                    {c.up}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || index === assignments.filter((x) => !x.archived).length - 1}
                    onClick={() => void action(a, 'down')}
                  >
                    {c.down}
                  </Button>
                </>
              )}
              {a.status === 'draft' && !submissions.length && (
                <Button variant="outline" disabled={busy} onClick={() => void action(a, 'delete')}>
                  {c.remove}
                </Button>
              )}
            </div>
            <details>
              <summary>{c.edit}</summary>
              <AssignmentEditor activity={a} locked={submissions.length > 0} onSaved={reload} />
            </details>
            <details>
              <summary>
                {c.review} ({submissions.filter((s) => s.status !== 'uploading').length})
              </summary>
              {!submissions.some((s) => s.status !== 'uploading') && <p>{c.noSubmissions}</p>}
              {submissions
                .filter((s) => s.status !== 'uploading')
                .map((s) => (
                  <AssignmentReview
                    key={`${s.id}-${data.grades.filter((g) => g.submission_id === s.id).length}`}
                    submission={s}
                    studentName={
                      data.profiles.find((p) => p.id === s.student_id)?.full_name || c.student
                    }
                    grades={data.grades.filter((g) => g.submission_id === s.id)}
                    onSaved={reload}
                  />
                ))}
            </details>
          </article>
        );
      });
  }
  return (
    <div id="assignment-management" dir={arabic ? 'rtl' : 'ltr'}>
      <p>{c.adminHelp}</p>
      <Button onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
        {c.create}
      </Button>
      {creating && (
        <AssignmentEditor
          onSaved={() => {
            setCreating(false);
            setNotice(c.saved);
            reload();
          }}
        />
      )}
      {!assignments.length && <p>{c.emptyAdmin}</p>}
      {cards(false)}
      <details>
        <summary>{c.archived}</summary>
        {cards(true)}
      </details>
      <FormNotice message={notice} kind={notice === c.saved ? 'success' : 'error'} />
    </div>
  );
}
function AssignmentEditor({
  activity,
  locked = false,
  onSaved,
}: {
  activity?: Row<'activities'>;
  locked?: boolean;
  onSaved: () => void;
}) {
  const { c } = useAssignmentCopy();
  const [phases, setPhases] = useState<Phase[]>((activity?.phases as unknown as Phase[]) ?? []);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  function phaseEdit(i: number, key: keyof Phase, value: string) {
    setPhases((all) =>
      all.map((p, j) => (i === j ? { ...p, [key]: key === 'points' ? Number(value) : value } : p)),
    );
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setNotice('');
    const form = new FormData(e.currentTarget);
    const element = e.currentTarget;
    try {
      const values = {
        title_en: String(form.get('title_en')).trim(),
        title_ar: String(form.get('title_ar')).trim(),
        instructions_en: String(form.get('instructions_en') ?? ''),
        instructions_ar: String(form.get('instructions_ar') ?? ''),
        reference_links: String(form.get('reference_links') ?? ''),
        submission_type: locked ? activity!.submission_type : String(form.get('submission_type')),
        publish_at: locked ? activity!.publish_at : fromAmmanInput(String(form.get('publish_at'))),
        due_at: locked ? activity!.due_at : fromAmmanInput(String(form.get('due_at'))),
        phases,
        status: String(form.get('status')),
        accepting: activity?.accepting ?? true,
        archived: activity?.archived ?? false,
        sort_order: activity?.sort_order ?? 0,
      };
      const invalid = assignmentValidation(values);
      if (invalid) {
        setNotice(c[invalid]);
        return;
      }
      requireWrite(
        await client().rpc('save_assignment', {
          ...(activity ? { p_id: activity.id } : {}),
          p_data: values as unknown as Json,
          p_version: activity?.version ?? 0,
          ...(!activity ? { p_request: requestId } : {}),
        }),
      );
      await completeFormDraft(element);
      setNotice(c.saved);
      onSaved();
    } catch (error) {
      setNotice(c[assignmentError(error)]);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <DraftForm
      draftKey={`assignment:${activity?.id ?? 'new'}`}
      baseVersion={String(activity?.version ?? 0)}
      extra={{ phases, requestId }}
      restoreExtra={(value) => {
        const data = value as { phases?: Phase[]; requestId?: string };
        if (Array.isArray(data.phases)) setPhases(data.phases);
        if (typeof data.requestId === 'string')
          setRequestId(data.requestId as `${string}-${string}-${string}-${string}-${string}`);
      }}
      className="assignment-card"
      onSubmit={save}
      aria-busy={busy}
    >
      <fieldset disabled={busy}>
        <div className="portal-grid">
          {(['title_en', 'title_ar', 'instructions_en', 'instructions_ar'] as const).map(
            (key, i) => (
              <label key={key}>
                {c[(['titleEn', 'titleAr', 'instructionsEn', 'instructionsAr'] as const)[i]!]}
                {key.startsWith('title') ? (
                  <Input
                    name={key}
                    dir={key.endsWith('_ar') ? 'rtl' : 'ltr'}
                    defaultValue={activity?.[key] ?? ''}
                    maxLength={200}
                    required
                  />
                ) : (
                  <textarea
                    name={key}
                    dir={key.endsWith('_ar') ? 'rtl' : 'ltr'}
                    defaultValue={activity?.[key] ?? ''}
                    maxLength={10000}
                    rows={3}
                  />
                )}
              </label>
            ),
          )}
        </div>
        <label>
          {c.references}
          <textarea
            name="reference_links"
            dir="ltr"
            defaultValue={activity?.reference_links ?? ''}
            maxLength={5000}
            rows={2}
          />
        </label>
        <label>
          {c.visibility}
          <select name="status" defaultValue={activity?.status ?? 'draft'}>
            <option value="draft">{c.draft}</option>
            <option value="published">{c.published}</option>
          </select>
        </label>
        {locked && <p>{c.rulesLocked}</p>}
        <fieldset disabled={locked}>
          <label>
            {c.submissionType}
            <select name="submission_type" defaultValue={activity?.submission_type ?? 'either'}>
              <option value="file">{c.file}</option>
              <option value="link">{c.link}</option>
              <option value="either">{c.either}</option>
            </select>
          </label>
          <div className="portal-grid">
            <label>
              {c.publishAt} ({c.timezone})
              <Input
                type="datetime-local"
                step="1"
                name="publish_at"
                defaultValue={ammanInput(activity?.publish_at ?? null)}
                required
              />
            </label>
            <label>
              {c.deadline} ({c.timezone})
              <Input
                type="datetime-local"
                step="1"
                name="due_at"
                defaultValue={ammanInput(activity?.due_at ?? null)}
                required
              />
            </label>
          </div>
          <h4>{c.phases}</h4>
          <p>{c.boundaries}</p>
          {phases.map((p, i) => (
            <fieldset key={i} className="assignment-phase-editor">
              <legend>
                {c.phase} {i + 1}
              </legend>
              <div className="portal-grid">
                <label>
                  {c.phaseName}
                  <Input
                    value={p.name}
                    required
                    maxLength={100}
                    onChange={(e) => phaseEdit(i, 'name', e.target.value)}
                  />
                </label>
                <label>
                  {c.points}
                  <Input
                    value={p.points}
                    type="number"
                    required
                    min="0"
                    max="999999"
                    step="0.01"
                    onChange={(e) => phaseEdit(i, 'points', e.target.value)}
                  />
                </label>
                {(['start', 'end'] as const).map((key) => (
                  <label key={key}>
                    {c[key]}
                    <Input
                      type="datetime-local"
                      step="1"
                      required
                      value={p[key] ? ammanInput(p[key]) : ''}
                      onChange={(e) =>
                        phaseEdit(i, key, e.target.value ? fromAmmanInput(e.target.value) : '')
                      }
                    />
                  </label>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPhases((all) => all.filter((_, j) => j !== i))}
              >
                {c.remove}
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={phases.length >= 20}
            onClick={() =>
              setPhases((all) => [...all, { name: '', start: '', end: '', points: 0 }])
            }
          >
            {c.addPhase}
          </Button>
        </fieldset>
        <div className="assignment-toolbar">
          <Button disabled={busy || phases.length === 0}>{c.save}</Button>
        </div>
      </fieldset>
      <FormNotice message={notice} kind={notice === c.saved ? 'success' : 'error'} />
    </DraftForm>
  );
}
function AssignmentReview({
  submission: s,
  grades,
  studentName,
  onSaved,
}: {
  submission: Row<'submissions'>;
  grades: Row<'grades'>[];
  studentName: string;
  onSaved: () => void;
}) {
  const { c, arabic } = useAssignmentCopy();
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const [notice, setNotice] = useState('');
  const latest = grades[0];
  const phase = s.phase_snapshot as unknown as Phase;
  return (
    <section className="assignment-card" data-submission-id={s.id}>
      <h4 dir="auto">{studentName}</h4>
      <p>
        {c.submittedAt}:{' '}
        <time dateTime={s.submitted_at!}>{assignmentTime(s.submitted_at!, arabic)}</time>
      </p>
      <p>
        {c.phase}: {phase?.name} · {c.maximum}: {s.max_eligible_points}
      </p>
      <p>
        {c.status}: {latest ? c.reviewed : c.pending}
      </p>
      {s.link_url && (
        <a href={s.link_url} dir="ltr" target="_blank" rel="noopener noreferrer">
          {s.link_url} ↗
        </a>
      )}
      {s.attachment_path && (
        <Button
          variant="outline"
          onClick={() =>
            void assignmentDownload(s.attachment_path!, s.file_name!).catch(() =>
              setNotice(c.error),
            )
          }
        >
          {c.download}
        </Button>
      )}
      <DraftForm
        draftKey={`assignment-review:${s.id}`}
        baseVersion={String(latest?.revision ?? 0)}
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          if (flight.current) return;
          flight.current = true;
          setBusy(true);
          setNotice('');
          const form = new FormData(e.currentTarget);
          const element = e.currentTarget;
          try {
            requireWrite(
              await client().rpc('review_assignment', {
                p_submission: s.id,
                p_points: Number(form.get('points')),
                p_feedback: String(form.get('feedback') ?? ''),
                p_revision: latest?.revision ?? 0,
              }),
            );
            await completeFormDraft(element);
            setNotice(c.saved);
            onSaved();
          } catch (error) {
            setNotice(c[assignmentError(error)]);
          } finally {
            flight.current = false;
            setBusy(false);
          }
        }}
      >
        <label>
          {c.awarded} / {s.max_eligible_points}
          <Input
            name="points"
            type="number"
            required
            min="0"
            max={s.max_eligible_points!}
            step="0.01"
            defaultValue={latest?.awarded_points ?? ''}
          />
        </label>
        <label>
          {c.feedback}
          <textarea
            name="feedback"
            maxLength={10000}
            rows={3}
            defaultValue={latest?.feedback ?? ''}
          />
        </label>
        <Button disabled={busy}>{c.approve}</Button>
      </DraftForm>
      {grades.length > 0 && (
        <details>
          <summary>{c.reviewHistory}</summary>
          {grades.map((g) => (
            <p key={g.id}>
              {assignmentTime(g.published_at!, arabic)} · {g.awarded_points} /{' '}
              {s.max_eligible_points} · {g.feedback}
            </p>
          ))}
        </details>
      )}
      <FormNotice message={notice} kind={notice === c.saved ? 'success' : 'error'} />
    </section>
  );
}
