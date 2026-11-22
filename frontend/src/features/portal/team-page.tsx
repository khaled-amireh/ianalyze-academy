import { useCallback, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/use-auth';
import { PageContainer } from '@/components/shared/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { stateText, usePortalCopy } from './copy';
import { MixedText } from '@/components/shared/mixed-text';
import { FormNotice } from './form-feedback';
import type { PortalCopy } from './copy';
import { AnnouncementManager } from './announcements';
import { AdminPointAwards } from './admin-point-awards';
import { InitialAdminPromotion } from './initial-admin-promotion';
import { OwnerTeamTransition } from './owner-team-transition';
import { majorLabel, ZUJ } from './profile-fields';
import { academicYearLabel } from './academic-years';
import { fromAmmanDateTimeLocal, toAmmanDateTimeLocal } from './date-time';
import { validateTimingBonuses } from './timing-bonus';
import {
  checked,
  client,
  downloadNotebook,
  downloadActivitySubmissionFile,
  loadPortal,
  useRemote,
  type PortalData,
  type Row,
} from './data';

function ActivityEditor({
  data,
  reload,
  activity,
  readOnly = false,
  canUnpublish = true,
}: {
  data: PortalData;
  reload: () => void;
  activity?: Row<'activities'>;
  readOnly?: boolean;
  canUnpublish?: boolean;
}) {
  const { c, arabic } = usePortalCopy();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<keyof PortalCopy | ''>('');
  const dueInput = toAmmanDateTimeLocal(activity?.due_at);
  const opensInput = toAmmanDateTimeLocal(activity?.opens_at);
  const phaseEarlyInput = toAmmanDateTimeLocal(activity?.phase_1_ends_at);
  const phaseMiddleInput = toAmmanDateTimeLocal(activity?.phase_2_ends_at);
  const hasSubmissions = Boolean(
    activity && data.submissions.some((s) => s.activity_id === activity.id),
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const status = form.get('approved') === 'on' ? 'published' : 'draft';
      if (
        status === 'published' &&
        (!String(form.get('instructions_ar')).trim() ||
          !String(form.get('instructions_en')).trim() ||
          !data.rubrics.some((r) => r.activity_id === activity?.id && r.status === 'published'))
      )
        throw new Error('Published rubric/instructions required');
      const due = String(form.get('due_at') ?? '');
      const opens = String(form.get('opens_at') ?? '');
      const phaseEarly = String(form.get('phase_1_ends_at') ?? '');
      const phaseMiddle = String(form.get('phase_2_ends_at') ?? '');
      const phaseEarlyBonus = Number(form.get('phase_1_bonus_points'));
      const phaseMiddleBonus = Number(form.get('phase_2_bonus_points'));
      const phaseLateBonus = Number(form.get('phase_3_bonus_points'));
      validateTimingBonuses({
        opensAt: opens,
        phaseOneEndsAt: phaseEarly,
        phaseTwoEndsAt: phaseMiddle,
        dueAt: due,
        earlyBonus: phaseEarlyBonus,
        middleBonus: phaseMiddleBonus,
        lateBonus: phaseLateBonus,
      });
      const submissionMode = String(form.get('submission_mode'));
      const values = {
        week_id: String(form.get('week_id')),
        title_ar: String(form.get('title_ar')).trim(),
        title_en: String(form.get('title_en')).trim(),
        instructions_ar: String(form.get('instructions_ar')).trim(),
        instructions_en: String(form.get('instructions_en')).trim(),
        max_score: Number(form.get('max_score')),
        due_at: due ? fromAmmanDateTimeLocal(due) : null,
        opens_at: opens ? fromAmmanDateTimeLocal(opens) : null,
        phase_1_ends_at: phaseEarly ? fromAmmanDateTimeLocal(phaseEarly) : null,
        phase_2_ends_at: phaseMiddle ? fromAmmanDateTimeLocal(phaseMiddle) : null,
        phase_1_bonus_points: phaseEarlyBonus,
        phase_2_bonus_points: phaseMiddleBonus,
        phase_3_bonus_points: phaseLateBonus,
        submission_mode: submissionMode,
        max_submission_files: Number(form.get('max_submission_files')),
        max_submission_file_bytes: Math.round(
          Number(form.get('max_submission_file_mib')) * 1048576,
        ),
        status,
      };
      const result = activity
        ? await client().from('activities').update(values).eq('id', activity.id)
        : await client().from('activities').insert(values);
      if (result.error) throw result.error;
      setMessage('saved');
      reload();
    } catch {
      setMessage('error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} aria-busy={busy}>
      <h3>
        <MixedText>
          {activity ? (arabic ? activity.title_ar : activity.title_en) : c.createActivity}
        </MixedText>
      </h3>
      <fieldset disabled={readOnly || hasSubmissions}>
        <div className="portal-grid">
          <label>
            {c.week}
            <select name="week_id" defaultValue={activity?.week_id ?? ''} required>
              <option value="">{c.select}</option>
              {data.weeks
                .filter((w) => w.week_number === 1)
                .map((w) => (
                  <option value={w.id} key={w.id}>
                    {new Intl.NumberFormat(arabic ? 'ar-JO' : 'en-GB').format(w.week_number)}.{' '}
                    {arabic ? w.title_ar : w.title_en}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {c.submissionMode}
            <select
              name="submission_mode"
              defaultValue={activity?.submission_mode ?? 'notebook'}
              disabled={readOnly}
            >
              <option value="notebook">{c.notebookMode}</option>
              <option value="files">{c.filesMode}</option>
            </select>
          </label>
          <label>
            {c.maximum}
            <Input
              type="number"
              name="max_score"
              min="0.01"
              max="999999"
              step="0.01"
              defaultValue={activity?.max_score ?? ''}
              required
            />
          </label>
          <label>
            {c.titleAr}
            <Input
              name="title_ar"
              dir="rtl"
              maxLength={200}
              defaultValue={activity?.title_ar ?? ''}
              required
            />
          </label>
          <label>
            {c.titleEn}
            <Input
              name="title_en"
              dir="ltr"
              maxLength={200}
              defaultValue={activity?.title_en ?? ''}
              required
            />
          </label>
          <label>
            {c.instructionsAr}
            <textarea
              name="instructions_ar"
              dir="rtl"
              rows={5}
              defaultValue={activity?.instructions_ar ?? ''}
            />
          </label>
          <label>
            {c.instructionsEn}
            <textarea
              name="instructions_en"
              dir="ltr"
              rows={5}
              defaultValue={activity?.instructions_en ?? ''}
            />
          </label>
          <label>
            {c.opensAt}
            <Input
              type="datetime-local"
              name="opens_at"
              defaultValue={opensInput}
              disabled={readOnly}
            />
            <small>Asia/Amman</small>
          </label>
          <label>
            {c.deadline}
            <Input
              type="datetime-local"
              name="due_at"
              defaultValue={dueInput}
              disabled={readOnly}
            />
            <small>{c.noDeadline} / Asia/Amman</small>
          </label>
          <label>
            {c.maxFiles}
            <Input
              type="number"
              name="max_submission_files"
              min="1"
              max="3"
              step="1"
              defaultValue={activity?.max_submission_files ?? 3}
              disabled={readOnly}
              required
            />
          </label>
          <label>
            {c.maxFileSize}
            <Input
              type="number"
              name="max_submission_file_mib"
              min="0.01"
              max="10"
              step="0.01"
              defaultValue={(activity?.max_submission_file_bytes ?? 10485760) / 1048576}
              disabled={readOnly}
              required
            />
          </label>
          <label>
            {c.phaseEarlyEnd}
            <Input
              type="datetime-local"
              name="phase_1_ends_at"
              defaultValue={phaseEarlyInput}
              disabled={readOnly}
            />
          </label>
          <label>
            {c.phaseMiddleEnd}
            <Input
              type="datetime-local"
              name="phase_2_ends_at"
              defaultValue={phaseMiddleInput}
              disabled={readOnly}
            />
          </label>
          <label>
            {c.phaseEarlyBonus}
            <Input
              type="number"
              name="phase_1_bonus_points"
              min="0"
              max="999999.99"
              step="0.01"
              defaultValue={activity?.phase_1_bonus_points ?? 0}
              disabled={readOnly}
              required
            />
          </label>
          <label>
            {c.phaseMiddleBonus}
            <Input
              type="number"
              name="phase_2_bonus_points"
              min="0"
              max="999999.99"
              step="0.01"
              defaultValue={activity?.phase_2_bonus_points ?? 0}
              disabled={readOnly}
              required
            />
          </label>
          <label>
            {c.phaseLateBonus}
            <Input
              type="number"
              name="phase_3_bonus_points"
              min="0"
              max="999999.99"
              step="0.01"
              defaultValue={activity?.phase_3_bonus_points ?? 0}
              disabled={readOnly}
              required
            />
            <small>{c.phaseScoringFormula}</small>
          </label>
        </div>
        <label className="portal-check">
          <input
            type="checkbox"
            name="approved"
            defaultChecked={activity?.status === 'published'}
            disabled={readOnly || (!canUnpublish && activity?.status === 'published')}
          />
          {c.approved}
        </label>
      </fieldset>
      <p>
        {c.status}: {stateText(activity?.status ?? 'draft', c)}
      </p>
      {!readOnly && <Button disabled={busy || hasSubmissions}>{c.save}</Button>}
      <FormNotice
        message={message ? c[message] : ''}
        kind={message === 'saved' || message === 'submitted' ? 'success' : 'error'}
      />
    </form>
  );
}
function RubricEditor({
  activity,
  data,
  reload,
  readOnly = false,
}: {
  activity: Row<'activities'>;
  data: PortalData;
  reload: () => void;
  readOnly?: boolean;
}) {
  const { c, arabic } = usePortalCopy();
  const [count, setCount] = useState(1);
  const [message, setMessage] = useState<keyof PortalCopy | ''>('');
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const rows = Array.from({ length: count }, (_, i) => ({
        label_ar: String(form.get(`ar${i}`)),
        label_en: String(form.get(`en${i}`)),
        max_points: Number(form.get(`max${i}`)),
      }));
      const result = await client().rpc('create_draft_rubric', {
        p_activity_id: activity.id,
        p_criteria: rows,
      });
      if (result.error) throw result.error;
      setMessage('saved');
      reload();
    } catch {
      setMessage('error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section>
      <h3>
        {c.rubric}: <MixedText>{arabic ? activity.title_ar : activity.title_en}</MixedText>
      </h3>
      {data.rubrics
        .filter((r) => r.activity_id === activity.id)
        .map((r) => (
          <div key={r.id}>
            <p>
              {c.version}{' '}
              <bdi>{new Intl.NumberFormat(arabic ? 'ar-JO' : 'en-GB').format(r.version)}</bdi> —{' '}
              {stateText(r.status, c)}
            </p>
            <ul>
              {data.criteria
                .filter((x) => x.rubric_id === r.id)
                .map((x) => (
                  <li key={x.id}>
                    {arabic ? x.label_ar : x.label_en}: {x.max_points}
                  </li>
                ))}
            </ul>
            {r.status === 'draft' && !readOnly && (
              <>
                <DraftCriteria
                  rubric={r}
                  criteria={data.criteria.filter((x) => x.rubric_id === r.id)}
                  reload={reload}
                />
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    if (inFlight.current) return;
                    inFlight.current = true;
                    setBusy(true);
                    try {
                      const result = await client()
                        .from('rubrics')
                        .update({ status: 'published' })
                        .eq('id', r.id);
                      if (result.error) throw result.error;
                      reload();
                    } catch {
                      setMessage('error');
                    } finally {
                      inFlight.current = false;
                      setBusy(false);
                    }
                  }}
                >
                  {c.publishRubric}
                </Button>
              </>
            )}
          </div>
        ))}
      {!readOnly && (
        <form onSubmit={create} aria-busy={busy}>
          {Array.from({ length: count }, (_, i) => (
            <div className="portal-criterion" key={i}>
              <Input
                name={`ar${i}`}
                dir="rtl"
                placeholder={c.criterionAr}
                aria-label={`${c.criterionAr} ${i + 1}`}
                maxLength={300}
                required
              />
              <Input
                name={`en${i}`}
                dir="ltr"
                placeholder={c.criterionEn}
                aria-label={`${c.criterionEn} ${i + 1}`}
                maxLength={300}
                required
              />
              <Input
                name={`max${i}`}
                type="number"
                min="0.01"
                step="0.01"
                max={activity.max_score}
                placeholder={c.maximum}
                aria-label={`${c.maximum} ${i + 1}`}
                required
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={count >= 30 || busy}
            onClick={() => setCount((v) => v + 1)}
          >
            {c.addCriterion}
          </Button>
          <Button disabled={busy}>{c.createRubric}</Button>
        </form>
      )}
      <FormNotice
        message={message ? c[message] : ''}
        kind={message === 'saved' || message === 'submitted' ? 'success' : 'error'}
      />
    </section>
  );
}
function DraftCriteria({
  rubric,
  criteria,
  reload,
}: {
  rubric: Row<'rubrics'>;
  criteria: Row<'rubric_criteria'>[];
  reload: () => void;
}) {
  const { c } = usePortalCopy();
  const [count, setCount] = useState(Math.max(1, criteria.length));
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<keyof PortalCopy | ''>('');
  return (
    <form
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        const form = new FormData(event.currentTarget);
        try {
          const rows = Array.from({ length: count }, (_, i) => ({
            label_ar: String(form.get(`ar${i}`)),
            label_en: String(form.get(`en${i}`)),
            max_points: Number(form.get(`max${i}`)),
          }));
          const result = await client().rpc('save_draft_rubric', {
            p_rubric_id: rubric.id,
            p_criteria: rows,
          });
          if (result.error) throw result.error;
          reload();
        } catch {
          setMessage('error');
        } finally {
          inFlight.current = false;
          setBusy(false);
        }
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div className="portal-criterion" key={i}>
          <Input
            name={`ar${i}`}
            dir="rtl"
            aria-label={`${c.criterionAr} ${i + 1}`}
            defaultValue={criteria[i]?.label_ar ?? ''}
            required
            maxLength={300}
          />
          <Input
            name={`en${i}`}
            dir="ltr"
            aria-label={`${c.criterionEn} ${i + 1}`}
            defaultValue={criteria[i]?.label_en ?? ''}
            required
            maxLength={300}
          />
          <Input
            type="number"
            name={`max${i}`}
            min="0.01"
            max="999999"
            step="0.01"
            aria-label={`${c.maximum} ${i + 1}`}
            defaultValue={criteria[i]?.max_points ?? ''}
            required
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={busy || count >= 30}
        onClick={() => setCount((v) => v + 1)}
      >
        {c.addCriterion}
      </Button>
      <Button disabled={busy}>{c.save}</Button>
      <FormNotice
        message={message ? c[message] : ''}
        kind={message === 'saved' || message === 'submitted' ? 'success' : 'error'}
      />
    </form>
  );
}
function Review({
  submission,
  data,
  reload,
}: {
  submission: Row<'submissions'>;
  data: PortalData;
  reload: () => void;
}) {
  const { c, arabic } = usePortalCopy();
  const [message, setMessage] = useState<keyof PortalCopy | ''>('');
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const grades = data.grades.filter((g) => g.submission_id === submission.id);
  const last = grades[0];
  const expected = Math.max(0, ...grades.map((g) => g.revision));
  const student = data.profiles.find((p) => p.id === submission.student_id);
  const activity = data.activities.find((a) => a.id === submission.activity_id);
  async function grade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const publish =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'publish';
    try {
      const scores: Record<string, number> = {};
      for (const criterion of data.criteria.filter((x) => x.rubric_id === submission.rubric_id)) {
        const value = String(form.get(criterion.id) ?? '');
        if (value !== '') scores[criterion.id] = Number(value);
      }
      const result = await client().rpc('save_grade', {
        p_submission_id: submission.id,
        p_scores: scores,
        p_feedback: String(form.get('feedback') ?? ''),
        p_publish: publish,
        p_expected_revision: expected,
      });
      if (result.error) throw result.error;
      setMessage('saved');
      reload();
    } catch {
      setMessage('error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="content-card">
      <h3>
        <bdi dir="auto">{student?.full_name ?? submission.student_id}</bdi> —{' '}
        <MixedText>{(arabic ? activity?.title_ar : activity?.title_en) ?? ''}</MixedText> —{' '}
        <bdi>#{submission.attempt}</bdi>
      </h3>
      <p>
        {c.status}: {stateText(submission.status, c)}
      </p>
      {submission.object_path &&
        submission.status !== 'uploading' &&
        submission.submission_mode === 'notebook' && (
          <Button
            variant="outline"
            onClick={() =>
              void downloadNotebook(submission.object_path!).catch(() => setMessage('error'))
            }
          >
            {c.download}
          </Button>
        )}
      {submission.submission_mode === 'files' &&
        submission.status !== 'uploading' &&
        data.submissionFiles
          .filter((file) => file.submission_id === submission.id)
          .map((file) => (
            <Button
              key={file.id}
              variant="outline"
              onClick={() =>
                void downloadActivitySubmissionFile(file.storage_path, file.original_name).catch(
                  () => setMessage('error'),
                )
              }
            >
              {c.downloadFile}: <bdi dir="auto">{file.original_name}</bdi>
            </Button>
          ))}
      {submission.status !== 'uploading' && (
        <form onSubmit={grade} aria-busy={busy}>
          {data.criteria
            .filter((x) => x.rubric_id === submission.rubric_id)
            .map((x) => (
              <label key={x.id}>
                {arabic ? x.label_ar : x.label_en} / {x.max_points}
                <Input
                  name={x.id}
                  type="number"
                  min="0"
                  max={x.max_points}
                  step="0.01"
                  defaultValue={
                    data.scores.find((s) => s.grade_id === last?.id && s.criterion_id === x.id)
                      ?.points ?? ''
                  }
                />
              </label>
            ))}
          <label>
            {c.feedback}
            <textarea
              name="feedback"
              maxLength={10000}
              rows={4}
              defaultValue={last?.feedback ?? ''}
            />
          </label>
          <div className="portal-actions">
            <Button type="submit" value="draft" disabled={busy}>
              {c.draftSave}
            </Button>
            <Button type="submit" value="publish" disabled={busy}>
              {c.publish}
            </Button>
            {submission.attempt < 2 && submission.status !== 'resubmission_required' && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (inFlight.current) return;
                  inFlight.current = true;
                  setBusy(true);
                  try {
                    const result = await client().rpc('request_resubmission', {
                      p_submission_id: submission.id,
                    });
                    if (result.error) throw result.error;
                    reload();
                  } catch {
                    setMessage('error');
                  } finally {
                    inFlight.current = false;
                    setBusy(false);
                  }
                }}
              >
                {c.resubmit}
              </Button>
            )}
          </div>
        </form>
      )}
      <FormNotice
        message={message ? c[message] : ''}
        kind={message === 'saved' || message === 'submitted' ? 'success' : 'error'}
      />
    </section>
  );
}
function Materials() {
  const { c } = usePortalCopy();
  const load = useCallback(
    async () => checked(await client().storage.from('team-materials').list('', { limit: 100 })),
    [],
  );
  const { data, error } = useRemote(load);
  const [message, setMessage] = useState<keyof PortalCopy | ''>('');
  return (
    <section className="content-card">
      <h2>{c.materials}</h2>
      {data
        ?.filter((f) => f.id)
        .map((f) => (
          <p key={f.id}>
            <Button
              variant="outline"
              onClick={() =>
                void downloadNotebook(f.name, 'team-materials').catch(() => setMessage('error'))
              }
            >
              {f.name}
            </Button>
          </p>
        ))}
      <FormNotice
        message={
          error ? c.error : !data ? c.wait : !data.length ? c.noRecords : message ? c[message] : ''
        }
        kind={error || message === 'error' ? 'error' : 'info'}
      />
    </section>
  );
}
export function TeamPageLive() {
  const { c, arabic } = usePortalCopy();
  const auth = useAuth();
  const location = useLocation();
  const routeState = location.state as { profileSaved?: string; emailVerified?: boolean } | null;
  const profileSaved = routeState?.profileSaved;
  const { data, error, reload } = useRemote(loadPortal);
  const [message, setMessage] = useState<keyof PortalCopy | ''>('');
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewActivity, setReviewActivity] = useState('');
  if (!data)
    return (
      <PageContainer className="portal-page">
        <h1 id="page-title" tabIndex={-1}>
          {c.team}
        </h1>
        <p role="status">{error ? c.error : c.wait}</p>
        <Button onClick={reload}>{c.retry}</Button>
      </PageContainer>
    );
  const reviews = data.submissions.filter(
    (s) => !reviewActivity || s.activity_id === reviewActivity,
  );
  const pageCount = Math.max(1, Math.ceil(reviews.length / 20));
  const currentPage = Math.min(reviewPage, pageCount - 1);
  return (
    <PageContainer className="portal-page">
      <InitialAdminPromotion />
      <OwnerTeamTransition />
      <h1 id="page-title" tabIndex={-1}>
        {c.team}
      </h1>
      <nav className="portal-actions">
        <Link to="/student">{c.profile}</Link>
        <a href="#students">{c.students}</a>
        <a href="#activities">{c.manage}</a>
        <a href="#reviews">{c.review}</a>
        <Button onClick={reload}>{c.retry}</Button>
        <Button variant="outline" onClick={() => void auth.signOut()}>
          {c.logout}
        </Button>
      </nav>
      <FormNotice
        message={
          profileSaved === 'registered'
            ? c.registered
            : profileSaved === 'saved'
              ? c.saved
              : routeState?.emailVerified
                ? c.confirmed
                : ''
        }
        kind="success"
      />
      <section id="students" className="content-card">
        <h2>{c.students}</h2>
        <div className="portal-table" role="region" aria-label={c.students} tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>{c.fullName}</th>
                <th>{c.email}</th>
                <th>{c.whatsapp}</th>
                <th>{c.university}</th>
                <th>{c.major}</th>
                <th>{c.year}</th>
                <th>{c.python}</th>
                <th>{c.universityId}</th>
                <th>{c.preferredLanguage}</th>
                <th>{c.registrationDate}</th>
              </tr>
            </thead>
            <tbody>
              {!data.profiles.some((p) => p.registered_at) && (
                <tr>
                  <td colSpan={10}>{c.noRecords}</td>
                </tr>
              )}
              {data.profiles
                .filter((p) => p.registered_at)
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <bdi dir="auto">{p.full_name || c.notProvided}</bdi>
                    </td>
                    <td>
                      <bdi dir="ltr">{p.email || c.notProvided}</bdi>
                    </td>
                    <td>
                      <bdi dir="ltr">{p.whatsapp || c.notProvided}</bdi>
                    </td>
                    <td>
                      <bdi dir="auto">
                        {p.university === ZUJ ? c.zuj : p.university || c.notProvided}
                      </bdi>
                    </td>
                    <td>
                      <bdi dir="auto">{majorLabel(p.major, arabic) || c.notProvided}</bdi>
                    </td>
                    <td>{academicYearLabel(p.academic_year, arabic)}</td>
                    <td>
                      {p.python_experience === 'none'
                        ? c.none
                        : p.python_experience === 'basic'
                          ? c.basic
                          : p.python_experience === 'experienced'
                            ? c.experienced
                            : c.notProvided}
                    </td>
                    <td>
                      <bdi dir="auto">{p.university_id || c.notProvided}</bdi>
                    </td>
                    <td>{p.locale === 'ar' ? c.arabicLanguage : c.englishLanguage}</td>
                    <td>
                      {new Intl.DateTimeFormat(arabic ? 'ar-JO' : 'en-GB', {
                        dateStyle: 'medium',
                        timeZone: 'Asia/Amman',
                      }).format(new Date(p.registered_at!))}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <AdminPointAwards />
      <section id="activities" className="content-card">
        <h2>{c.manage}</h2>
        {data.weeks
          .filter((week) => week.week_number === 1)
          .map((week) => {
            return (
              <div className="portal-actions" key={week.id}>
                <span>
                  <bdi>
                    {new Intl.NumberFormat(arabic ? 'ar-JO' : 'en-GB').format(week.week_number)}
                  </bdi>
                  . <MixedText>{arabic ? week.title_ar : week.title_en}</MixedText> —{' '}
                  {stateText(week.status, c)}
                </span>
              </div>
            );
          })}
        <ActivityEditor data={data} reload={reload} />
        {data.activities
          .filter((activity) =>
            data.weeks.some((week) => week.id === activity.week_id && week.week_number === 1),
          )
          .map((a) => (
            <details key={a.id}>
              <summary>
                {arabic ? a.title_ar : a.title_en} —{' '}
                {a.archived_at ? c.archived : stateText(a.status, c)}
              </summary>
              <ActivityEditor
                activity={a}
                data={data}
                reload={reload}
                readOnly={Boolean(a.archived_at)}
                canUnpublish={
                  !data.submissions.some((submission) => submission.activity_id === a.id)
                }
              />
              {!a.archived_at && (
                <RubricEditor
                  activity={a}
                  data={data}
                  reload={reload}
                  readOnly={data.submissions.some((submission) => submission.activity_id === a.id)}
                />
              )}
              {!a.archived_at && (
                <div className="portal-actions">
                  {a.status === 'draft' &&
                    !data.submissions.some((submission) => submission.activity_id === a.id) &&
                    !data.rubrics.some(
                      (rubric) => rubric.activity_id === a.id && rubric.status === 'published',
                    ) && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!window.confirm(c.deleteDraftConfirm)) return;
                          try {
                            const result = await client().rpc('delete_activity_draft', {
                              p_activity_id: a.id,
                            });
                            if (result.error) throw result.error;
                            reload();
                          } catch {
                            setMessage('error');
                          }
                        }}
                      >
                        {c.deleteDraftActivity}
                      </Button>
                    )}
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!window.confirm(c.archiveConfirm)) return;
                      try {
                        const result = await client().rpc('archive_activity', {
                          p_activity_id: a.id,
                        });
                        if (result.error) throw result.error;
                        reload();
                      } catch {
                        setMessage('error');
                      }
                    }}
                  >
                    {c.archiveActivity}
                  </Button>
                </div>
              )}
            </details>
          ))}
        <FormNotice
          message={message ? c[message] : ''}
          kind={message === 'saved' || message === 'submitted' ? 'success' : 'error'}
        />
      </section>
      <section id="reviews">
        <h2>{c.review}</h2>
        <label>
          {c.activities}
          <select
            value={reviewActivity}
            onChange={(event) => {
              setReviewActivity(event.target.value);
              setReviewPage(0);
            }}
          >
            <option value="">{c.allActivities}</option>
            {data.activities.map((a) => (
              <option key={a.id} value={a.id}>
                {arabic ? a.title_ar : a.title_en}
              </option>
            ))}
          </select>
        </label>
        <nav className="portal-actions" aria-label={c.review}>
          <Button
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setReviewPage(currentPage - 1)}
          >
            {c.previous}
          </Button>
          <bdi>
            {currentPage + 1} / {pageCount}
          </bdi>
          <Button
            variant="outline"
            disabled={currentPage + 1 >= pageCount}
            onClick={() => setReviewPage(currentPage + 1)}
          >
            {c.next}
          </Button>
        </nav>
        {!reviews.length && <p>{c.noRecords}</p>}
        {reviews.slice(currentPage * 20, currentPage * 20 + 20).map((s) => (
          <Review
            key={`${s.id}-${Math.max(0, ...data.grades.filter((g) => g.submission_id === s.id).map((g) => g.revision))}`}
            submission={s}
            data={data}
            reload={reload}
          />
        ))}
      </section>
      <AnnouncementManager />
      <Materials />
    </PageContainer>
  );
}
