import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { academyClient, privacyApproved, registrationEnabled } from '@/lib/academy-client';
import { useAuth } from '@/features/auth/use-auth';
import { PageContainer } from '@/components/shared/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePortalCopy } from './copy';
import { FormField } from '@/components/shared/form-field';
import { FormNotice, PasswordField } from './form-feedback';
import {
  errorAttributes,
  focusFirstError,
  requestError,
  validateAuth,
  type AuthMode,
  type FieldErrors,
} from './form-validation';
import type { PortalCopy } from './copy';
import './portal.css';

export function AccountLink({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const auth = useAuth();
  const { c } = usePortalCopy();
  if (!academyClient) return null;
  return (
    <Link
      className={className}
      onClick={onNavigate}
      to={
        auth.status === 'signed-in' ? (auth.role === 'team' ? '/workspace' : '/student') : '/login'
      }
    >
      {auth.status === 'signed-in' ? c.dashboard : c.login}
    </Link>
  );
}
export function ProtectedPortal({ team = false }: { team?: boolean }) {
  const auth = useAuth();
  const { c } = usePortalCopy();
  if (auth.status === 'loading')
    return (
      <PageContainer>
        <p role="status">{c.wait}</p>
      </PageContainer>
    );
  if (auth.status !== 'signed-in') return <Navigate to="/login" replace />;
  if (team && auth.role !== 'team') return <Navigate to="/student" replace />;
  return <Outlet />;
}
export function AuthPage({ mode }: { mode: AuthMode }) {
  return <AuthForm key={mode} mode={mode} />;
}
function AuthForm({ mode }: { mode: AuthMode }) {
  const { c } = usePortalCopy();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const id = useId();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [resendErrors, setResendErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ key: keyof PortalCopy; kind: 'error' | 'success' } | null>(
    null,
  );
  const resetSucceeded =
    mode === 'login' && new URLSearchParams(location.search).get('reset') === 'success';
  const title =
    c[
      mode === 'login'
        ? 'login'
        : mode === 'signup'
          ? 'signup'
          : mode === 'recover'
            ? 'recover'
            : 'reset'
    ];
  const available =
    Boolean(academyClient) && (mode !== 'signup' || (registrationEnabled && privacyApproved));
  useEffect(() => {
    if ((mode === 'login' || mode === 'signup') && auth.status === 'signed-in')
      navigate(auth.role === 'team' ? '/workspace' : '/student', { replace: true });
  }, [mode, auth.status, auth.role, navigate]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!academyClient || !available || inFlight.current) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const invalid = validateAuth(form, mode);
    setErrors(invalid);
    setNotice(null);
    if (Object.keys(invalid).length) {
      setNotice({ key: 'validationSummary', kind: 'error' });
      focusFirstError(element, invalid);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const redirectTo = `${window.location.origin}/auth/callback${mode === 'recover' ? '?flow=recovery' : ''}`;
    try {
      if (mode === 'login') {
        const { error } = await academyClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await auth.refresh();
      } else if (mode === 'signup') {
        const { data, error } = await academyClient.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        for (const name of ['password', 'confirmation'])
          (element.elements.namedItem(name) as HTMLInputElement).value = '';
        if (data.session) await auth.refresh();
        else setNotice({ key: 'verificationSent', kind: 'success' });
      } else if (mode === 'recover') {
        const { error } = await academyClient.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        setNotice({ key: 'sent', kind: 'success' });
      } else {
        const { error } = await academyClient.auth.updateUser({ password });
        if (error) throw error;
        await auth.signOut();
        navigate('/login?reset=success', { replace: true });
      }
    } catch (error) {
      setNotice({ key: requestError(error), kind: 'error' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!academyClient || inFlight.current) return;
    const element = event.currentTarget,
      form = new FormData(element);
    const invalid = validateAuth(form, 'recover');
    setResendErrors(invalid);
    setNotice(null);
    if (Object.keys(invalid).length) {
      setNotice({ key: 'validationSummary', kind: 'error' });
      focusFirstError(element, invalid);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const { error } = await academyClient.auth.resend({
        type: 'signup',
        email: String(form.get('email')).trim(),
        options: { emailRedirectTo: window.location.origin + '/auth/callback' },
      });
      if (error) throw error;
      setNotice({ key: 'resendSent', kind: 'success' });
    } catch (error) {
      setNotice({ key: requestError(error), kind: 'error' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const shown =
    notice ??
    (auth.status === 'error'
      ? { key: 'sessionExpired' as const, kind: 'error' as const }
      : resetSucceeded
        ? { key: 'saved' as const, kind: 'success' as const }
        : null);
  return (
    <PageContainer className="portal-page">
      <section className="content-card portal-auth">
        <h1 id="page-title" tabIndex={-1}>
          {title}
        </h1>
        {!available ? (
          <p>{c.unavailable}</p>
        ) : (
          <form onSubmit={submit} noValidate aria-busy={busy}>
            <fieldset disabled={busy} className="portal-fields">
              {mode !== 'reset' && (
                <FormField
                  id={id + '-email'}
                  label={c.email}
                  error={errors.email ? c[errors.email] : undefined}
                >
                  <Input
                    {...errorAttributes(id + '-email', errors.email)}
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    dir="ltr"
                  />
                </FormField>
              )}
              {mode !== 'recover' && (
                <PasswordField
                  id={id + '-password'}
                  name="password"
                  label={c.password}
                  error={errors.password}
                  c={c}
                  current={mode === 'login'}
                  hint={mode !== 'login'}
                />
              )}
              {(mode === 'signup' || mode === 'reset') && (
                <PasswordField
                  id={id + '-confirmation'}
                  name="confirmation"
                  label={c.confirmPassword}
                  error={errors.confirmation}
                  c={c}
                />
              )}
              {mode === 'signup' && (
                <div>
                  <label className="portal-check" htmlFor={id + '-consent'}>
                    <input
                      {...errorAttributes(id + '-consent', errors.consent)}
                      name="consent"
                      type="checkbox"
                      required
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
                </div>
              )}
            </fieldset>
            <Button disabled={busy} type="submit">
              {busy ? c.wait : mode === 'recover' ? c.send : title}
            </Button>
          </form>
        )}
        <FormNotice message={shown ? c[shown.key] : ''} kind={shown?.kind} />
        {notice?.key === 'verificationSent' && <p>{c.registrationNext}</p>}
        <nav className="portal-actions">
          <Link to="/login">{c.login}</Link>
          <Link to="/join">{c.signup}</Link>
          <Link to="/auth/recover">{c.recover}</Link>
        </nav>
        {mode === 'login' && academyClient && (
          <form id="resend-confirmation" onSubmit={resend} noValidate aria-busy={busy}>
            <p>{c.confirmEmail}</p>
            <FormField
              id={id + '-resend-email'}
              label={c.email}
              error={resendErrors.email ? c[resendErrors.email] : undefined}
            >
              <Input
                {...errorAttributes(id + '-resend-email', resendErrors.email)}
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
                disabled={busy}
                dir="ltr"
              />
            </FormField>
            <Button type="submit" variant="outline" disabled={busy}>
              {busy ? c.wait : c.resend}
            </Button>
          </form>
        )}
      </section>
    </PageContainer>
  );
}

// Single-use email codes must not be exchanged twice under React StrictMode.
const exchanges = new Map<string, Promise<boolean>>();
export function AuthCallback() {
  const { c } = usePortalCopy();
  const auth = useAuth();
  const refresh = auth.refresh;
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  // Legacy links can verify email at Auth and return an implicit fragment. Do not
  // trust fragment credentials or label successful verification as an expired link.
  const [legacyReturn] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).has('access_token'),
  );
  const [callbackParams] = useState(() => new URLSearchParams(window.location.search));
  useEffect(() => {
    let current = true;
    const params = callbackParams;
    // Capture once for StrictMode, then scrub secrets even when validation fails.
    window.history.replaceState(null, '', '/auth/callback');
    if (legacyReturn) return;
    const code = params.get('code');
    const hash = params.get('token_hash');
    const type = params.get('type');
    const key = code ?? hash;
    if (
      !academyClient ||
      !key ||
      params.has('error') ||
      (hash && type !== 'signup' && type !== 'recovery')
    ) {
      Promise.resolve().then(() => {
        if (current) setFailed(true);
      });
      return;
    }
    if (!exchanges.has(key))
      exchanges.set(
        key,
        (async () => {
          const result = code
            ? await academyClient!.auth.exchangeCodeForSession(code)
            : await academyClient!.auth.verifyOtp({
                token_hash: hash!,
                type: type as 'signup' | 'recovery',
              });
          return !result.error;
        })().catch(() => false),
      );
    void exchanges.get(key)!.then(async (success) => {
      if (!current) return;
      // Remove credentials from browser history before leaving the callback.
      window.history.replaceState(null, '', '/auth/callback');
      if (!success) {
        setFailed(true);
        return;
      }
      await refresh();
      if (current)
        navigate(
          type === 'recovery' || params.get('flow') === 'recovery' ? '/auth/reset' : '/student',
          { replace: true },
        );
    });
    return () => {
      current = false;
    };
  }, [refresh, navigate, callbackParams, legacyReturn]);
  return (
    <PageContainer className="portal-page">
      <h1 id="page-title" tabIndex={-1}>
        {c.login}
      </h1>
      <FormNotice
        message={legacyReturn ? c.confirmationLoginHelp : failed ? c.expired : c.wait}
        kind={failed ? 'error' : 'info'}
      />
      {(failed || legacyReturn) && <Link to="/login">{c.backLogin}</Link>}
      {failed && <p>{c.confirmationLoginHelp}</p>}
    </PageContainer>
  );
}
