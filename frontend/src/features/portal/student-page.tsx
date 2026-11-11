import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/use-auth';
import { privacyApproved, registrationEnabled, submissionsEnabled } from '@/lib/academy-client';
import { loadOwnProfile, saveAcademyProfile } from '@/lib/academy-data';
import { changeLocale } from '@/lib/i18n';
import { majors, profilePatch, selectedMajor } from './profile-fields';
import { ProfileDetails } from './profile-details';
import { UniversityIdField } from './university-id-field';
import { useRegistrationDraft } from './use-registration-draft';
import { RegistrationDraftNotice } from './registration-draft-notice';
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

export function ProfileForm({
  profile,
  onSaved,
  onCancel,
}: {
  profile: Row<'profiles'>;
  onCancel?: () => void;
  onSaved: (profile: Row<'profiles'>, registered: boolean) => void;
}) {
  const { c, arabic } = usePortalCopy();
  const auth = useAuth();
  const id = useId(),
    inFlight = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<keyof PortalCopy | ''>('');
  const [busy, setBusy] = useState(false);
  const registering = !profile.registered_at && auth.role !== 'team';
  const required = (
    name:
      'full_name' | 'whatsapp' | 'major' | 'academic_year' | 'python_experience' | 'university_id',
  ) => registering || auth.role !== 'team' || Boolean(profile[name]);
  const formRef = useRef<HTMLFormElement>(null);
  const draft = useRegistrationDraft(registering ? { kind: 'profile', userId: profile.id } : null, {
    full_name: profile.full_name ?? '',
    whatsapp: profile.whatsapp ?? '',
    major: selectedMajor(profile.major),
    major_other: selectedMajor(profile.major) === 'other' ? (profile.major ?? '') : '',
    academic_year:
      registering && (profile.academic_year ?? 0) > 5 ? '' : String(profile.academic_year ?? ''),
    python_experience: profile.python_experience ?? '',
    university_id: profile.university_id ?? '',
    locale: registering ? (arabic ? 'ar' : 'en') : profile.locale,
  });
  const major = draft.values.major;
  const open = registrationEnabled && privacyApproved;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || (registering && !open)) return;
    const element = event.currentTarget,
      form = new FormData(element);
    const invalid = validateProfile(form, registering, profile, auth.role === 'team');
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
        profilePatch(form, profile, registering),
        registering,
      );
      if (registering) draft.complete();
      changeLocale(persisted.locale === 'en' ? 'en' : 'ar');
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
    <section className="content-card" dir={arabic ? 'rtl' : 'ltr'}>
      <h2>{registering ? c.academyRegistration : c.profile}</h2>
      <p dir="ltr">{profile.email}</p>
      <form
        ref={formRef}
        onSubmit={submit}
        noValidate
        aria-busy={busy}
        data-registration-draft={registering ? 'profile' : undefined}
      >
        <fieldset className="portal-grid" disabled={busy}>
          <FormField id={id + '-full_name'} label={c.fullName} error={error('full_name')}>
            <Input
              {...field('full_name')}
              name="full_name"
              autoComplete="name"
              maxLength={150}
              required={required('full_name')}
              {...draft.field('full_name')}
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
              required={required('whatsapp')}
              dir="ltr"
              {...draft.field('whatsapp')}
            />
          </FormField>
          <FormField id={id + '-major'} label={c.major} error={error('major')}>
            <select
              {...field('major')}
              name="major"
              required={required('major')}
              {...draft.field('major')}
            >
              <option value="">{c.select}</option>
              {majors.map((m) => (
                <option key={m.value} value={m.value}>
                  {arabic ? m.ar : m.value}
                </option>
              ))}
              <option value="other">{c.otherMajor}</option>
            </select>
          </FormField>
          {major === 'other' && (
            <FormField id={id + '-major_other'} label={c.majorOther} error={error('major_other')}>
              <Input
                {...field('major_other')}
                name="major_other"
                required
                maxLength={150}
                {...draft.field('major_other')}
              />
            </FormField>
          )}
          <FormField id={id + '-locale'} label={c.preferredLanguage}>
            <select id={id + '-locale'} name="locale" {...draft.field('locale')}>
              <option value="ar">{c.arabicLanguage}</option>
              <option value="en">{c.englishLanguage}</option>
            </select>
          </FormField>
          <FormField id={id + '-academic_year'} label={c.year} error={error('academic_year')}>
            <select
              {...field('academic_year')}
              name="academic_year"
              required={required('academic_year')}
              {...draft.field('academic_year')}
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
              required={required('python_experience')}
              {...draft.field('python_experience')}
            >
              <option value="">{c.select}</option>
              <option value="none">{c.none}</option>
              <option value="basic">{c.basic}</option>
              <option value="experienced">{c.experienced}</option>
            </select>
          </FormField>
          <UniversityIdField
            id={id + '-university_id'}
            {...draft.field('university_id')}
            required={required('university_id')}
            error={errors.university_id}
          />
        </fieldset>
        {registering && (
          <div>
            <label className="portal-check" htmlFor={id + '-consent'}>
              <input
                {...field('consent')}
                type="checkbox"
                name="consent"
                required
                disabled={busy || !open}
              />
              <span>
                {c.consent} <Link to="/privacy">{c.privacy}</Link>
              </span>
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
          {busy ? c.wait : registering ? c.complete : c.saveChanges}
        </Button>
        {registering && (
          <RegistrationDraftNotice
            disabled={busy}
            unavailable={draft.unavailable}
            onClear={() => {
              draft.clear();
              formRef.current?.reset();
              setErrors({});
              setMessage('draftCleared');
            }}
          />
        )}
        {onCancel && (
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {c.cancel}
          </Button>
        )}
        <FormNotice
          message={message ? c[message] : ''}
          kind={message === 'draftCleared' ? 'success' : 'error'}
        />
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
async function loadStudentProfile() {
  const result = await loadOwnProfile(client());
  if (result.error) throw result.error;
  return { profiles: [result.data] };
}

export function StudentPage() {
  const { c, arabic } = usePortalCopy();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailVerified = (location.state as { emailVerified?: boolean } | null)?.emailVerified;
  const { data, error, reload, update, refresh } = useRemote(loadStudentProfile);
  const [saved, setSaved] = useState<'registered' | 'saved' | null>(null);
  const [editing, setEditing] = useState(false);
  const onSaved = (profile: Row<'profiles'>, registered: boolean) => {
    update((current) => ({
      ...current,
      profiles: current.profiles.map((p) => (p.id === profile.id ? profile : p)),
    }));
    setSaved(registered ? 'registered' : 'saved');
    setEditing(false);
    // Revalidate without interrupting the immediately updated profile view.
    refresh();
    navigate(auth.role === 'team' ? '/workspace' : '/student', {
      replace: true,
      state: { profileSaved: registered ? 'registered' : 'saved' },
    });
  };
  if (!data)
    return (
      <PageContainer className="portal-page" dir={arabic ? 'rtl' : 'ltr'}>
        <h1 id="page-title" tabIndex={-1}>
          {c.dashboard}
        </h1>
        <p role="status">{error ? c.error : c.wait}</p>
        {error && <Button onClick={reload}>{c.tryAgain}</Button>}
      </PageContainer>
    );
  const profile = data.profiles.find((p) => p.id === auth.user?.id);
  if (profile && !profile.registered_at && auth.role !== 'team')
    return (
      <PageContainer className="portal-page" dir={arabic ? 'rtl' : 'ltr'}>
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
    <PageContainer className="portal-page" dir={arabic ? 'rtl' : 'ltr'} data-student-dashboard>
      <h1 id="page-title" tabIndex={-1}>
        {c.dashboard}
      </h1>
      <nav className="portal-actions">
        <Button onClick={() => void auth.signOut()}>{c.logout}</Button>
        {auth.role === 'team' && <Link to="/workspace">{c.team}</Link>}
        <Link to="/privacy">{c.privacy}</Link>
      </nav>
      <FormNotice message={saved ? c[saved] : emailVerified ? c.confirmed : ''} kind="success" />
      {error && <FormNotice message={c.error} kind="error" />}
      {profile && !editing && (
        <section className="content-card">
          <h2>{c.profile}</h2>
          <ProfileDetails profile={profile} />
          <Button
            onClick={() => {
              setSaved(null);
              setEditing(true);
            }}
          >
            {c.editProfile}
          </Button>
        </section>
      )}
      {profile && editing && (
        <ProfileForm
          key={profile.id}
          profile={profile}
          onSaved={onSaved}
          onCancel={() => setEditing(false)}
        />
      )}
    </PageContainer>
  );
}

// Retained for a future learning-plan launch; intentionally not mounted for students.
export function StudentLearningPlan({
  data,
  reload,
}: {
  data: Awaited<ReturnType<typeof loadPortal>>;
  reload: () => void;
}) {
  const { c, arabic } = usePortalCopy();
  const auth = useAuth();
  const profile = data.profiles.find((p) => p.id === auth.user?.id);
  const [message, setMessage] = useState<keyof PortalCopy | ''>('');
  return (
    <>
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
    </>
  );
}
