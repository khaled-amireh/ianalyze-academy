import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormNotice } from '@/features/portal/form-feedback';
import { client } from '@/features/portal/data';
import { isConflict, loadWeek1Student, requireWrite, type StudentWeek1 } from './data';
import { isKaggleDataset } from './domain';
import { formatTime, useWeek1Copy } from './copy';
import { DatasetDetails } from './dataset-details';
import { notifyWeek1 } from './use-week1-sync';
import { useAssignmentCopy } from '@/features/assignments/copy';
import { DraftForm, completeFormDraft } from '@/features/drafts';

export function DatasetInstructions() {
  const { c } = useWeek1Copy();
  return (
    <section className="content-card">
      <p>{c.examples}</p>
      <a href="https://www.kaggle.com/datasets" target="_blank" rel="noopener noreferrer">
        Kaggle Datasets ↗
      </a>
      <ol className="week1-instructions">
        {c.instructions.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ol>
    </section>
  );
}
export function DatasetActivity({
  data,
  studentId,
  update,
}: {
  data: StudentWeek1;
  studentId: string;
  update: (data: StudentWeek1) => void;
}) {
  const { c, arabic } = useWeek1Copy();
  const { c: assignmentCopy } = useAssignmentCopy();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const [notice, setNotice] = useState<'saved' | 'error' | 'conflict' | ''>('');
  const attempt = data.dataset;
  async function reload() {
    update(await loadWeek1Student(studentId, 'dataset'));
  }
  async function begin() {
    if (flight.current || !attempt) return;
    flight.current = true;
    setBusy(true);
    setNotice('');
    try {
      requireWrite(
        await client().rpc('week1_start_dataset_attempt', { p_previous_id: attempt.id }),
      );
      await reload();
      setExpanded(false);
    } catch (e) {
      setNotice(isConflict(e) ? 'conflict' : 'error');
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const history = data.datasetAttempts.filter(
    (item) => item.status === 'submitted' && item.id !== attempt?.id,
  );
  return (
    <>
      <DatasetInstructions />
      {data.participationPoints !== null && (
        <FormNotice message={assignmentCopy.participationApproved} kind="success" />
      )}
      {attempt?.status === 'submitted' ? (
        <section className="content-card week1-attempt-summary" aria-busy={busy}>
          <FormNotice message={c.datasetSubmitted} kind="success" />
          <p>
            {c.status}: <strong>{c.submitted}</strong>
          </p>
          <p>
            {c.timestamp}:{' '}
            <time dateTime={attempt.submitted_at!}>
              {formatTime(attempt.submitted_at!, arabic)}
            </time>
          </p>
          <p>
            {c.attemptReference}: <bdi>{attempt.id}</bdi>
          </p>
          <div className="portal-actions">
            <Button
              variant="outline"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls="dataset-readonly-submission"
            >
              {c.viewSubmission}
            </Button>
            <Button disabled={busy} onClick={() => void begin()}>
              {c.submitAgain}
            </Button>
          </div>
          {expanded && (
            <div id="dataset-readonly-submission">
              <DatasetDetails attempt={attempt} />
            </div>
          )}
        </section>
      ) : (
        <DatasetForm
          key={attempt?.id ?? 'new-attempt'}
          data={data}
          onSaved={async (submitted) => {
            await reload();
            setNotice(submitted ? '' : 'saved');
            if (submitted) notifyWeek1('dataset');
          }}
        />
      )}
      <FormNotice
        message={notice ? c[notice] : ''}
        kind={notice === 'saved' ? 'success' : 'error'}
      />
      {history.length > 0 && (
        <section className="content-card">
          <h2>{c.datasetHistory}</h2>
          {history.map((item) => (
            <details key={item.id}>
              <summary>
                <bdi dir="auto">{item.title}</bdi> · {formatTime(item.submitted_at!, arabic)}
              </summary>
              <DatasetDetails attempt={item} />
            </details>
          ))}
        </section>
      )}
    </>
  );
}
function DatasetForm({
  data,
  onSaved,
}: {
  data: StudentWeek1;
  onSaved: (submitted: boolean) => Promise<void>;
}) {
  const { c } = useWeek1Copy();
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [version, setVersion] = useState(data.dataset?.version ?? 0);
  const flight = useRef(false);
  const [notice, setNotice] = useState<'error' | 'conflict' | 'invalidUrl' | ''>('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current) return;
    const form = new FormData(event.currentTarget);
    const element = event.currentTarget;
    const values = Object.fromEntries(
      Object.keys(c.fields).map((key) => [key, String(form.get(key) ?? '').trim()]),
    );
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    values.status = submitter?.getAttribute('value') === 'submitted' ? 'submitted' : 'draft';
    if ((values.url || values.status === 'submitted') && !isKaggleDataset(values.url ?? '')) {
      setNotice('invalidUrl');
      return;
    }
    flight.current = true;
    setBusy(true);
    setNotice('');
    try {
      requireWrite(
        await client().rpc('week1_save_dataset', {
          p_data: values,
          p_version: version,
          ...(data.dataset ? { p_attempt_id: data.dataset.id } : {}),
        }),
      );
      await completeFormDraft(element);
      setVersion((v) => v + 1);
      setDirty(false);
      await onSaved(values.status === 'submitted');
    } catch (e) {
      setNotice(isConflict(e) ? 'conflict' : 'error');
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <DraftForm
      draftKey={`dataset:${data.dataset?.id ?? 'new'}`}
      baseVersion={String(data.dataset?.version ?? 0)}
      className="content-card"
      onSubmit={save}
      onChange={() => setDirty(true)}
      aria-busy={busy}
    >
      <p>
        {c.status}: {c.draft}
      </p>
      <fieldset disabled={busy} className="portal-fields">
        <div className="portal-grid">
          {(Object.keys(c.fields) as (keyof typeof c.fields)[]).map((key) => (
            <label key={key}>
              {c.fields[key]}
              {key === 'description' || key === 'question' ? (
                <textarea
                  name={key}
                  rows={4}
                  required
                  maxLength={key === 'description' ? 3000 : 1000}
                  defaultValue={data.dataset?.[key] ?? ''}
                />
              ) : (
                <Input
                  name={key}
                  required
                  type={key === 'url' ? 'url' : 'text'}
                  dir={key === 'url' ? 'ltr' : undefined}
                  maxLength={key === 'url' ? 500 : key === 'title' ? 200 : 150}
                  defaultValue={data.dataset?.[key] ?? ''}
                />
              )}
            </label>
          ))}
        </div>
      </fieldset>
      {dirty && <p role="status">{c.unsaved}</p>}
      <div className="portal-actions">
        <Button name="status" value="draft" formNoValidate disabled={busy} variant="outline">
          {c.saveDraft}
        </Button>
        <Button name="status" value="submitted" disabled={busy}>
          {c.submit}
        </Button>
      </div>
      <FormNotice message={notice ? c[notice] : ''} kind="error" />
    </DraftForm>
  );
}
