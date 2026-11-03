import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/use-auth';
import { privacyApproved, registrationEnabled, submissionsEnabled } from '@/lib/academy-client';
import { saveAcademyProfile } from '@/lib/academy-data';
import { normalizeJordanianMobile } from '@/lib/jordanian-phone';
import { academicYears, academicYearLabel } from './academic-years';
import { PageContainer } from '@/components/shared/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { stateText, usePortalCopy } from './copy';
import { MixedText } from '@/components/shared/mixed-text';
import { FormField } from '@/components/shared/form-field';
import { FormNotice } from './form-feedback';
import type { PortalCopy } from './copy';
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
  onSaved,
}: {
  profile: Row<'profiles'>;
  onSaved: (profile: Row<'profiles'>, registered: boolean) => void;
}) {
  const { c, arabic } = usePortalCopy();
  const id = useId(),
    inFlight = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<keyof PortalCopy | ''>('');
  const [busy, setBusy] = useState(false);
  const registering = !profile.registered_at;
  const open = registrationEnabled && privacyApproved;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || (registering && !open)) return;
    const element = event.currentTarget,
      form = new FormData(element);
    const invalid = validateProfile(form, registering, profile);
    setErrors(invalid);
    setMessage('');
    if (Object.keys(invalid).length) {
      setMessage('validationSummary');
      focusFirstError(element, invalid);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const persisted = await saveAcademyProfile(
        client(),
        {
          full_name: String(form.get('full_name')).trim(),
          ...(String(form.get('whatsapp')).trim() !== profile.whatsapp
            ? { whatsapp: normalizeJordanianMobile(String(form.get('whatsapp')))! }
            : {}),
          major: String(form.get('major')).trim(),
          academic_year: Number(form.get('academic_year')),
          python_experience: String(form.get('python_experience')),
          university_id: String(form.get('university_id') ?? '').trim() || null,
          locale: arabic ? 'ar' : 'en',
        },
        registering,
      );
      onSaved(persisted, registering);
    } catch (error) {
      setMessage(requestError(error));
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
              inputMode="tel"
              maxLength={64}
              placeholder="07XXXXXXXX"
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
              defaultValue={
                registering && (profile.academic_year ?? 0) > 5 ? '' : (profile.academic_year ?? '')
              }
            >
              <option value="">{c.select}</option>
              {!registering && profile.academic_year !== null && profile.academic_year > 5 && (
                <option value={profile.academic_year} hidden>
                  {academicYearLabel(profile.academic_year, arabic)}
                </option>
              )}
              {academicYears.map((year) => (
                <option key={year} value={year}>
                  {academicYearLabel(year, arabic)}
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
        <FormNotice message={message ? c[message] : ''} kind="error" />
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
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<keyof PortalCopy | ''>('');
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !open) return;
    const file = new FormData(event.currentTarget).get('notebook');
    if (!(file instanceof File)) return;
    if (!file.name.endsWith('.ipynb') || file.size > 262144 || file.size === 0) {
      setMessage('uploadHint');
      return;
    }
    inFlight.current = true;
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
      setMessage('submitted');
      reload();
    } catch {
      setMessage('error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={upload} aria-busy={busy}>
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
      <FormNotice
        message={message ? c[message] : ''}
        kind={message === 'saved' || message === 'submitted' ? 'success' : 'error'}
      />
    </form>
  );
}
export function StudentPage() {
  const { c, arabic } = usePortalCopy();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailVerified = (location.state as { emailVerified?: boolean } | null)?.emailVerified;
  const { data, error, reload, update, refresh } = useRemote(loadPortal);
  const [message, setMessage] = useState<keyof PortalCopy | ''>('');
  const [saved, setSaved] = useState<'registered' | 'saved' | null>(null);
  const [editing, setEditing] = useState(false);
  const onSaved = (profile: Row<'profiles'>, registered: boolean) => {
    update((current) => ({
      ...current,
      profiles: current.profiles.map((p) => (p.id === profile.id ? profile : p)),
    }));
    setSaved(registered ? 'registered' : 'saved');
    setEditing(false);
    // Registration changes which learning records RLS releases to this session.
    refresh();
    navigate(auth.role === 'team' ? '/workspace' : '/student', {
      replace: true,
      state: { profileSaved: registered ? 'registered' : 'saved' },
    });
  };
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
        <FormNotice message={emailVerified ? c.confirmed : ''} kind="success" />
        <ProfileForm profile={profile} onSaved={onSaved} />
      </PageContainer>
    );
  return (
    <PageContainer className="portal-page" data-student-dashboard>
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
      <FormNotice message={saved ? c[saved] : emailVerified ? c.confirmed : ''} kind="success" />
      {error && <FormNotice message={c.error} kind="error" />}
      {profile && !editing && (
        <Button variant="outline" onClick={() => setEditing(true)}>
          {c.editProfile}
        </Button>
      )}
      {profile && editing && <ProfileForm key={profile.id} profile={profile} onSaved={onSaved} />}
      <h2>{c.activities}</h2>
      {topics.map((topic, index) => {
        const week = data.weeks.find((w) => w.week_number === index + 1);
        const activities = data.activities.filter((a) => a.week_id === week?.id);
        return (
          <section className="content-card" key={topic}>
            <h3>
              <bdi>{new Intl.NumberFormat(arabic ? 'ar-JO' : 'en-GB').format(index + 1)}</bdi>.{' '}
              <MixedText>
                {week
                  ? arabic
                    ? week.title_ar
                    : week.title_en
                  : arabic
                    ? topicsAr[index]!
                    : topic}
              </MixedText>
            </h3>
            {week && (arabic ? week.description_ar : week.description_en) && (
              <p>
                <MixedText>{arabic ? week.description_ar : week.description_en}</MixedText>
              </p>
            )}
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
                  <h3>
                    <MixedText>{arabic ? activity.title_ar : activity.title_en}</MixedText>
                  </h3>
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
                            void downloadNotebook(s.object_path!).catch(() => setMessage('error'))
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
      <FormNotice
        message={message ? c[message] : ''}
        kind={message === 'saved' || message === 'submitted' ? 'success' : 'error'}
      />
    </PageContainer>
  );
}
