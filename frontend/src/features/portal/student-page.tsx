import { useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/use-auth';
import { privacyApproved, registrationEnabled, submissionsEnabled } from '@/lib/academy-client';
import { updateOwnProfile } from '@/lib/academy-data';
import { PageContainer } from '@/components/shared/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { stateText, usePortalCopy } from './copy';
import { FormField } from '@/components/shared/form-field';
import { FormNotice } from './form-feedback';
import {
  errorAttributes,
  focusFirstError,
  requestError,
  validateProfile,
  type FieldErrors,
} from './form-validation';
import {
  client,
  downloadNotebook,
  loadPortal,
  topics,
  topicsAr,
  useRemote,
  type Row,
} from './data';

function ProfileForm({
  profile,
  reload,
  onSaved,
}: {
  profile: Row<'profiles'>;
  reload: () => void;
  onSaved: (registered: boolean) => void;
}) {
  const { c, arabic } = usePortalCopy();
  const id = useId(),
    inFlight = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const registering = !profile.registered_at;
  const open = registrationEnabled && privacyApproved;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || (registering && !open)) return;
    const element = event.currentTarget,
      form = new FormData(element);
    const invalid = validateProfile(form, registering);
    setErrors(invalid);
    setMessage('');
    if (Object.keys(invalid).length) {
      setMessage(c.validationSummary);
      focusFirstError(element, invalid);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const updated = await updateOwnProfile(client(), {
        full_name: String(form.get('full_name')).trim(),
        whatsapp: String(form.get('whatsapp')).trim(),
        major: String(form.get('major')).trim(),
        academic_year: Number(form.get('academic_year')),
        python_experience: String(form.get('python_experience')),
        university_id: String(form.get('university_id') ?? '').trim() || null,
        locale: arabic ? 'ar' : 'en',
      });
      if (updated.error) throw updated.error;
      if (registering) {
        const result = await client().rpc('complete_registration', {
          p_consent_version: 'registration-v1',
        });
        if (result.error) throw result.error;
      }
      onSaved(registering);
      reload();
    } catch (error) {
      setMessage(c[requestError(error)]);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const field = (name: string) => errorAttributes(id + '-' + name, errors[name]);
  const error = (name: string) => (errors[name] ? c[errors[name]] : undefined);
  return (
    <section className="content-card">
      <h2>{registering ? c.academyRegistration : c.profile}</h2>
      <p dir="ltr">{profile.email}</p>
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <fieldset className="portal-grid" disabled={busy}>
          <FormField id={id + '-full_name'} label={c.fullName} error={error('full_name')}>
            <Input
              {...field('full_name')}
              name="full_name"
              autoComplete="name"
              maxLength={150}
              required
              defaultValue={profile.full_name ?? ''}
            />
          </FormField>
          <FormField id={id + '-whatsapp'} label={c.whatsapp} error={error('whatsapp')}>
            <Input
              {...field('whatsapp')}
              name="whatsapp"
              type="tel"
              autoComplete="tel"
              pattern="\+[1-9][0-9]{6,14}"
              placeholder="+962790000001"
              required
              dir="ltr"
              defaultValue={profile.whatsapp ?? ''}
            />
          </FormField>
          <FormField id={id + '-major'} label={c.major} error={error('major')}>
            <Input
              {...field('major')}
              name="major"
              required
              maxLength={150}
              defaultValue={profile.major ?? ''}
            />
          </FormField>
          <FormField id={id + '-academic_year'} label={c.year} error={error('academic_year')}>
            <select
              {...field('academic_year')}
              name="academic_year"
              required
              defaultValue={profile.academic_year ?? ''}
            >
              <option value="">{c.select}</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((year) => (
                <option key={year} value={year}>
                  {new Intl.NumberFormat(arabic ? 'ar' : 'en').format(year)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            id={id + '-python_experience'}
            label={c.python}
            error={error('python_experience')}
          >
            <select
              {...field('python_experience')}
              name="python_experience"
              required
              defaultValue={profile.python_experience ?? ''}
            >
              <option value="">{c.select}</option>
              <option value="none">{c.none}</option>
              <option value="basic">{c.basic}</option>
              <option value="experienced">{c.experienced}</option>
            </select>
          </FormField>
          <FormField
            id={id + '-university_id'}
            label={c.universityId}
            error={error('university_id')}
          >
            <Input
              {...field('university_id')}
              name="university_id"
              maxLength={50}
              defaultValue={profile.university_id ?? ''}
            />
          </FormField>
        </fieldset>
        {registering && (
          <div>
            <p>
              <Link to="/privacy">{c.privacy}</Link>
            </p>
            <label className="portal-check" htmlFor={id + '-consent'}>
              <input
                {...field('consent')}
                type="checkbox"
                name="consent"
                required
                disabled={busy || !open}
              />
              {c.consent}
            </label>
            {errors.consent && (
              <p className="field-error" id={id + '-consent-error'}>
                {c[errors.consent]}
              </p>
            )}
            {!open && <p>{c.unavailable}</p>}
          </div>
        )}
        <Button type="submit" disabled={busy || (registering && !open)}>
          {busy ? c.wait : registering ? c.complete : c.save}
        </Button>
        <FormNotice message={message} kind="error" />
      </form>
    </section>
  );
}
function NotebookUpload({
  activity,
  open,
  reload,
}: {
  activity: string;
  open: boolean;
  reload: () => void;
}) {
  const { c } = usePortalCopy();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !open) return;
    const file = new FormData(event.currentTarget).get('notebook');
    if (!(file instanceof File)) return;
    if (!file.name.endsWith('.ipynb') || file.size > 262144 || file.size === 0) {
      setMessage(c.uploadHint);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const bytes = await file.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (v) =>
        v.toString(16).padStart(2, '0'),
      ).join('');
      const identityResult = await client().auth.getUser();
      const identity = identityResult.data.user;
      if (identityResult.error || !identity) throw new Error('Identity required');
      const requestKey = `ianalyze.submission.${identity.id}.${activity}.${hash}`;
      // Retain only the idempotency ID, never notebook bytes or credentials.
      let requestId: string | null = null;
      try {
        requestId = sessionStorage.getItem(requestKey);
      } catch {
        /* storage may be restricted */
      }
      requestId ??= crypto.randomUUID();
      try {
        sessionStorage.setItem(requestKey, requestId);
      } catch {
        /* retry remains possible in this request */
      }
      const result = await client().functions.invoke('notebook-submit', {
        body: bytes,
        headers: {
          'Content-Type': 'application/x-ipynb+json',
          'X-Activity-ID': activity,
          'X-Request-ID': requestId,
          'X-Filename': encodeURIComponent(file.name),
        },
      });
      if (result.error) throw result.error;
      setMessage(c.submitted);
      reload();
    } catch {
      setMessage(c.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={upload}>
      <p>{c.uploadHint}</p>
      {!open && <p>{c.uploadClosed}</p>}
      <Input
        type="file"
        name="notebook"
        accept=".ipynb"
        aria-label={c.upload}
        disabled={!open || busy}
        required
      />
      <Button disabled={!open || busy}>{busy ? c.uploading : c.upload}</Button>
      <p role="status">{message}</p>
    </form>
  );
}
export function StudentPage() {
  const { c, arabic } = usePortalCopy();
  const auth = useAuth();
  const { data, error, reload } = useRemote(loadPortal);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState<'registered' | 'saved' | null>(null);
  const onSaved = (registered: boolean) => setSaved(registered ? 'registered' : 'saved');
  if (!data)
    return (
      <PageContainer className="portal-page">
        <h1 id="page-title" tabIndex={-1}>
          {c.dashboard}
        </h1>
        <p role="status">{error ? c.error : c.wait}</p>
        <Button onClick={reload}>{c.retry}</Button>
      </PageContainer>
    );
  const profile = data.profiles.find((p) => p.id === auth.user?.id);
  if (profile && !profile.registered_at)
    return (
      <PageContainer className="portal-page">
        <h1 id="page-title" tabIndex={-1}>
          {c.academyRegistration}
        </h1>
        <nav className="portal-actions">
          <Button onClick={() => void auth.signOut()}>{c.logout}</Button>
        </nav>
        <ProfileForm profile={profile} reload={reload} onSaved={onSaved} />
      </PageContainer>
    );
  return (
    <PageContainer className="portal-page">
      <h1 id="page-title" tabIndex={-1}>
        {c.dashboard}
      </h1>
      <nav className="portal-actions">
        <Button onClick={() => void auth.signOut()}>{c.logout}</Button>
        <Button variant="outline" onClick={reload}>
          {c.retry}
        </Button>
        {auth.role === 'team' && <Link to="/workspace">{c.team}</Link>}
        <Link to="/privacy">{c.privacy}</Link>
      </nav>
      <FormNotice message={saved ? c[saved] : ''} kind="success" />
      {profile && (
        <ProfileForm key={profile.id} profile={profile} reload={reload} onSaved={onSaved} />
      )}
      <h2>{c.activities}</h2>
      {topics.map((topic, index) => {
        const week = data.weeks.find((w) => w.week_number === index + 1);
        const activities = data.activities.filter((a) => a.week_id === week?.id);
        return (
          <section className="content-card" key={topic}>
            <h3>
              {index + 1}. {arabic ? topicsAr[index] : topic}
            </h3>
            {activities.length === 0 && <p>{c.unpublished}</p>}
            {activities.map((activity) => {
              const rubric = data.rubrics
                .filter((r) => r.activity_id === activity.id && r.status === 'published')
                .at(-1);
              const mine = data.submissions.filter(
                (s) => s.activity_id === activity.id && s.student_id === auth.user?.id,
              );
              return (
                <article key={activity.id}>
                  <h3>{arabic ? activity.title_ar : activity.title_en}</h3>
                  <pre>{arabic ? activity.instructions_ar : activity.instructions_en}</pre>
                  <p>
                    {c.deadline}:{' '}
                    {activity.due_at
                      ? new Intl.DateTimeFormat(arabic ? 'ar-JO' : 'en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'Asia/Amman',
                        }).format(new Date(activity.due_at))
                      : c.noDeadline}
                  </p>
                  {rubric && (
                    <>
                      <h4>{c.rubric}</h4>
                      <ul>
                        {data.criteria
                          .filter((x) => x.rubric_id === rubric.id)
                          .map((x) => (
                            <li key={x.id}>
                              {arabic ? x.label_ar : x.label_en}: {x.max_points}
                            </li>
                          ))}
                      </ul>
                    </>
                  )}
                  {profile?.registered_at && (
                    <NotebookUpload
                      activity={activity.id}
                      open={Boolean(submissionsEnabled && data.capabilities.submissions && rubric)}
                      reload={reload}
                    />
                  )}
                  {mine.map((s) => (
                    <div key={s.id}>
                      <p>
                        {c.submissions} #{s.attempt} — {stateText(s.status, c)}
                      </p>
                      {s.status !== 'uploading' && s.object_path && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            void downloadNotebook(s.object_path!).catch(() => setMessage(c.error))
                          }
                        >
                          {c.download}
                        </Button>
                      )}
                      {data.grades
                        .filter((g) => g.submission_id === s.id && g.status === 'published')
                        .map((g) => (
                          <section key={g.id}>
                            <h4>
                              {c.grades}:{' '}
                              {data.scores
                                .filter((x) => x.grade_id === g.id)
                                .reduce((sum, x) => sum + Number(x.points), 0)}{' '}
                              / {activity.max_score}
                            </h4>
                            <p>{c.feedback}</p>
                            <pre>{g.feedback}</pre>
                          </section>
                        ))}
                    </div>
                  ))}
                </article>
              );
            })}
          </section>
        );
      })}
      <p role="status">{message}</p>
    </PageContainer>
  );
}
