import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { academyClient, privacyApproved, registrationEnabled } from '@/lib/academy-client';
import { useAuth } from '@/features/auth/use-auth';
import { createEmailExchangeDeduplicator, readEmailCallback } from '@/features/auth/email-callback';
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
import { authPersistence } from '@/lib/auth-storage';

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
  if (auth.status === 'error')
    return (
      <PageContainer className="portal-page">
        <h1 id="page-title" tabIndex={-1}>
          {team ? c.team : c.dashboard}
        </h1>
        <FormNotice message={c.sessionVerificationError} kind="error" />
        <Button onClick={() => void auth.refresh()}>{c.retry}</Button>
        <Link to="/login">{c.login}</Link>
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
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [nextEmailAt, setNextEmailAt] = useState(0);
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
        authPersistence.setRememberMe(form.get('remember') === 'on');
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
        else {
          setVerificationEmail(email);
          setNextEmailAt(Date.now() + 60_000);
          setNotice({ key: 'verificationSent', kind: 'success' });
        }
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
        ) : verificationEmail ? (
          <p>{c.registrationNext}</p>
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
              {mode === 'login' && (
                <label className="portal-check">
                  <input type="checkbox" name="remember" />
                  {c.rememberMe}
                </label>
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
                      {c.privacyConsentBefore}
                      <Link className="privacy-link" to="/privacy">
                        {c.privacy}
                      </Link>
                      {c.privacyConsentAfter}
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
        {mode === 'login' && (
          <p className="auth-privacy-note">
            {c.loginPrivacyBefore}
            <Link className="privacy-link" to="/privacy">
              {c.privacy}
            </Link>
            {c.loginPrivacyAfter}
          </p>
        )}
        <nav className="portal-actions">
          <Link to="/login">{c.login}</Link>
          <Link to="/join">{c.signup}</Link>
          <Link to="/auth/recover">{c.recover}</Link>
        </nav>
        {(mode === 'login' || verificationEmail !== null) && academyClient && (
          <ResendVerification
            email={verificationEmail ?? ''}
            initialNextEmailAt={nextEmailAt}
            disabled={busy}
          />
        )}
      </section>
    </PageContainer>
  );
}

// A local cooldown supplements Supabase's authoritative email rate limits.
function ResendVerification({
  email = '',
  initialNextEmailAt = 0,
  disabled = false,
}: {
  email?: string;
  initialNextEmailAt?: number;
  disabled?: boolean;
}) {
  const { c } = usePortalCopy();
  const id = useId();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ key: keyof PortalCopy; kind: 'error' | 'success' } | null>(
    null,
  );
  const [nextEmailAt, setNextEmailAt] = useState(initialNextEmailAt);
  const [now, setNow] = useState(Date.now);
  const coolingDown = now < nextEmailAt;
  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [coolingDown]);
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!academyClient || disabled || inFlight.current || Date.now() < nextEmailAt) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const invalid = validateAuth(form, 'recover');
    setErrors(invalid);
    setNotice(null);
    if (Object.keys(invalid).length) {
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
      setNextEmailAt(Date.now() + 60_000);
      setNow(Date.now());
      setNotice({ key: 'resendSent', kind: 'success' });
    } catch (error) {
      const key = requestError(error);
      if (key === 'rateLimited') {
        setNextEmailAt(Date.now() + 60_000);
        setNow(Date.now());
      }
      setNotice({ key, kind: 'error' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <form id="resend-confirmation" onSubmit={resend} noValidate aria-busy={busy}>
      <p>{c.verificationHelp}</p>
      <FormField
        id={id + '-email'}
        label={c.email}
        error={errors.email ? c[errors.email] : undefined}
      >
        <Input
          {...errorAttributes(id + '-email', errors.email)}
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={busy || disabled}
          dir="ltr"
          defaultValue={email}
        />
      </FormField>
      <Button
        type="submit"
        variant="outline"
        disabled={busy || disabled || coolingDown}
        aria-describedby={coolingDown ? id + '-cooldown' : undefined}
      >
        {busy ? c.wait : c.resend}
      </Button>
      {coolingDown && <p id={id + '-cooldown'}>{c.resendWait}</p>}
      <FormNotice message={notice ? c[notice.key] : ''} kind={notice?.kind} />
    </form>
  );
}

// Share only pending exchanges under StrictMode; completed tokens are never cached.
const exchangeOnce = createEmailExchangeDeduplicator();
export function AuthCallback() {
  const { c } = usePortalCopy();
  const auth = useAuth();
  const refresh = auth.refresh;
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [callback] = useState(() =>
    readEmailCallback(window.location.search, window.location.hash),
  );
  useEffect(() => {
    let current = true;
    window.history.replaceState(null, '', '/auth/callback');
    if (!academyClient || callback.kind === 'invalid' || callback.kind === 'legacy') {
      Promise.resolve().then(() => {
        if (current) setFailed(true);
      });
      return () => {
        current = false;
      };
    }
    const key =
      callback.kind === 'code' ? 'code:' + callback.code : callback.type + ':' + callback.tokenHash;
    void exchangeOnce(key, async () => {
      const result =
        callback.kind === 'code'
          ? await academyClient!.auth.exchangeCodeForSession(callback.code)
          : await academyClient!.auth.verifyOtp({
              token_hash: callback.tokenHash,
              type: callback.type,
            });
      return !result.error && Boolean(result.data.session);
    })
      .then(async (success) => {
        if (!current) return;
        if (!success) {
          setFailed(true);
          return;
        }
        // Navigation waits for server-verified identity and authoritative role.
        await refresh();
        if (current) setProcessed(true);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [refresh, callback]);
  useEffect(() => {
    if (!processed || auth.status !== 'signed-in' || !('recovery' in callback)) return;
    navigate(callback.recovery ? '/auth/reset' : auth.role === 'team' ? '/workspace' : '/student', {
      replace: true,
      state: { emailVerified: !callback.recovery },
    });
  }, [processed, auth.status, auth.role, callback, navigate]);
  const verificationError = processed && auth.status !== 'signed-in' && auth.status !== 'loading';
  return (
    <PageContainer className="portal-page">
      <section className="content-card portal-auth">
        <h1 id="page-title" tabIndex={-1}>
          {c.verifyEmail}
        </h1>
        <FormNotice
          message={
            callback.kind === 'legacy'
              ? c.confirmationLoginHelp
              : failed
                ? c.expired
                : verificationError
                  ? c.sessionVerificationError
                  : c.wait
          }
          kind={failed || verificationError ? 'error' : 'info'}
        />
        {verificationError && <Button onClick={() => void refresh()}>{c.retry}</Button>}
        {(failed || verificationError) && (
          <>
            <nav className="portal-actions">
              <Link to="/login">{c.backLogin}</Link>
              <Link to="/auth/recover">{c.recover}</Link>
              {auth.status === 'signed-in' && (
                <Link to={auth.role === 'team' ? '/workspace' : '/student'}>{c.dashboard}</Link>
              )}
            </nav>
            {callback.kind === 'code' && <p>{c.confirmationLoginHelp}</p>}
            {academyClient && <ResendVerification />}
          </>
        )}
      </section>
    </PageContainer>
  );
}
