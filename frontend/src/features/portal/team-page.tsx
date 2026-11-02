import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/use-auth';
import { PageContainer } from '@/components/shared/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { stateText, usePortalCopy } from './copy';
import {
  checked,
  client,
  downloadNotebook,
  loadPortal,
  topics,
  topicsAr,
  useRemote,
  type PortalData,
  type Row,
} from './data';

function ActivityEditor({
  data,
  reload,
  activity,
}: {
  data: PortalData;
  reload: () => void;
  activity?: Row<'activities'>;
}) {
  const { c } = usePortalCopy();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const due = activity?.due_at ? new Date(activity.due_at) : null;
  const dueInput = due
    ? new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
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
      const values = {
        week_id: String(form.get('week_id')),
        title_ar: String(form.get('title_ar')).trim(),
        title_en: String(form.get('title_en')).trim(),
        instructions_ar: String(form.get('instructions_ar')).trim(),
        instructions_en: String(form.get('instructions_en')).trim(),
        max_score: Number(form.get('max_score')),
        due_at: due ? new Date(due).toISOString() : null,
        status,
      };
      const result = activity
        ? await client().from('activities').update(values).eq('id', activity.id)
        : await client().from('activities').insert(values);
      if (result.error) throw result.error;
      setMessage(c.saved);
      reload();
    } catch {
      setMessage(c.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <h3>{activity ? activity.title_en : c.createActivity}</h3>
      <div className="portal-grid">
        <label>
          {c.week}
          <select name="week_id" defaultValue={activity?.week_id ?? ''} required>
            <option value="">{c.select}</option>
            {data.weeks.map((w) => (
              <option value={w.id} key={w.id}>
                {w.week_number}. {w.title_en}
              </option>
            ))}
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
          <Input name="title_ar" maxLength={200} defaultValue={activity?.title_ar ?? ''} required />
        </label>
        <label>
          {c.titleEn}
          <Input name="title_en" maxLength={200} defaultValue={activity?.title_en ?? ''} required />
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
          {c.deadline}
          <Input type="datetime-local" name="due_at" defaultValue={dueInput} />
          <small>
            {c.noDeadline} / {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </small>
        </label>
      </div>
      <label className="portal-check">
        <input type="checkbox" name="approved" />
        {c.approved}
      </label>
      <p>
        {c.status}: {stateText(activity?.status ?? 'draft', c)}
      </p>
      <Button disabled={busy}>{c.save}</Button>
      <p role="status">{message}</p>
    </form>
  );
}
function RubricEditor({
  activity,
  data,
  reload,
}: {
  activity: Row<'activities'>;
  data: PortalData;
  reload: () => void;
}) {
  const { c, arabic } = usePortalCopy();
  const [count, setCount] = useState(1);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
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
      setMessage(c.saved);
      reload();
    } catch {
      setMessage(c.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h3>
        {c.rubric}: {activity.title_en}
      </h3>
      {data.rubrics
        .filter((r) => r.activity_id === activity.id)
        .map((r) => (
          <div key={r.id}>
            <p>
              v{r.version} — {stateText(r.status, c)}
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
            {r.status === 'draft' && (
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
                    setBusy(true);
                    try {
                      const result = await client()
                        .from('rubrics')
                        .update({ status: 'published' })
                        .eq('id', r.id);
                      if (result.error) throw result.error;
                      reload();
                    } catch {
                      setMessage(c.error);
                    } finally {
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
      <form onSubmit={create}>
        {Array.from({ length: count }, (_, i) => (
          <div className="portal-criterion" key={i}>
            <Input
              name={`ar${i}`}
              placeholder={c.criterionAr}
              aria-label={`${c.criterionAr} ${i + 1}`}
              maxLength={300}
              required
            />
            <Input
              name={`en${i}`}
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
      <p role="status">{message}</p>
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
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
          setMessage(c.error);
        } finally {
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
      <p role="status">{message}</p>
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
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const grades = data.grades.filter((g) => g.submission_id === submission.id);
  const last = grades[0];
  const expected = Math.max(0, ...grades.map((g) => g.revision));
  const student = data.profiles.find((p) => p.id === submission.student_id);
  const activity = data.activities.find((a) => a.id === submission.activity_id);
  async function grade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
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
      setMessage(c.saved);
      reload();
    } catch {
      setMessage(c.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card">
      <h3>
        {student?.full_name ?? submission.student_id} — {activity?.title_en} — #{submission.attempt}
      </h3>
      <p>
        {c.status}: {stateText(submission.status, c)}
      </p>
      {submission.object_path && submission.status !== 'uploading' && (
        <Button
          variant="outline"
          onClick={() =>
            void downloadNotebook(submission.object_path!).catch(() => setMessage(c.error))
          }
        >
          {c.download}
        </Button>
      )}
      {submission.status !== 'uploading' && (
        <form onSubmit={grade}>
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
                  setBusy(true);
                  try {
                    const result = await client().rpc('request_resubmission', {
                      p_submission_id: submission.id,
                    });
                    if (result.error) throw result.error;
                    reload();
                  } catch {
                    setMessage(c.error);
                  } finally {
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
      <p role="status">{message}</p>
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
  const [message, setMessage] = useState('');
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
                void downloadNotebook(f.name, 'team-materials').catch(() => setMessage(c.error))
              }
            >
              {f.name}
            </Button>
          </p>
        ))}
      <p role="status">{error ? c.error : !data ? c.wait : !data.length ? c.noRecords : message}</p>
    </section>
  );
}
export function TeamPageLive() {
  const { c, arabic } = usePortalCopy();
  const auth = useAuth();
  const { data, error, reload } = useRemote(loadPortal);
  const [message, setMessage] = useState('');
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewActivity, setReviewActivity] = useState('');
  if (!data)
    return (
      <PageContainer className="portal-page">
        <h1>{c.team}</h1>
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
      <h1>{c.team}</h1>
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
      <section id="students" className="content-card">
        <h2>{c.students}</h2>
        <div className="portal-table">
          <table>
            <thead>
              <tr>
                <th>{c.fullName}</th>
                <th>{c.email}</th>
                <th>{c.whatsapp}</th>
                <th>{c.major}</th>
              </tr>
            </thead>
            <tbody>
              {data.profiles
                .filter((p) => p.registered_at)
                .map((p) => (
                  <tr key={p.id}>
                    <td>{p.full_name}</td>
                    <td dir="ltr">{p.email}</td>
                    <td dir="ltr">{p.whatsapp}</td>
                    <td>{p.major}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <section id="activities" className="content-card">
        <h2>{c.manage}</h2>
        {topics.map((topic, i) => {
          const week = data.weeks.find((w) => w.week_number === i + 1);
          return (
            <div className="portal-actions" key={topic}>
              <span>
                {i + 1}. {arabic ? topicsAr[i] : topic} — {stateText(week?.status, c)}
              </span>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const result = week
                      ? await client()
                          .from('academy_weeks')
                          .update({ status: week.status === 'draft' ? 'published' : 'draft' })
                          .eq('id', week.id)
                      : await client()
                          .from('academy_weeks')
                          .insert({
                            week_number: i + 1,
                            kind: 'teaching',
                            title_ar: topicsAr[i]!,
                            title_en: topic,
                          });
                    if (result.error) throw result.error;
                    reload();
                  } catch {
                    setMessage(c.error);
                  }
                }}
              >
                {week ? (week.status === 'draft' ? c.publish : c.draftSave) : c.createWeek}
              </Button>
            </div>
          );
        })}
        <ActivityEditor data={data} reload={reload} />
        {data.activities.map((a) => (
          <details key={a.id}>
            <summary>
              {arabic ? a.title_ar : a.title_en} — {stateText(a.status, c)}
            </summary>
            <ActivityEditor activity={a} data={data} reload={reload} />
            <RubricEditor activity={a} data={data} reload={reload} />
          </details>
        ))}
        <p role="status">{message}</p>
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
      <Materials />
    </PageContainer>
  );
}
