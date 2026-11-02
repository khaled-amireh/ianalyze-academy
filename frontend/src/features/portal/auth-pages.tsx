import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { academyClient, privacyApproved, registrationEnabled } from '@/lib/academy-client';
import { useAuth } from '@/features/auth/use-auth';
import { PageContainer } from '@/components/shared/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePortalCopy } from './copy';
import './portal.css';

export function AccountLink() {
  const auth = useAuth();
  const { c } = usePortalCopy();
  if (!academyClient) return null;
  return (
    <Link
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
export function AuthPage({ mode }: { mode: 'login' | 'signup' | 'recover' | 'reset' }) {
  const { c } = usePortalCopy();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!academyClient || !available || busy) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setBusy(true);
    setMessage('');
    try {
      const redirectTo = `${window.location.origin}/auth/callback${mode === 'recover' ? '?flow=recovery' : ''}`;
      if (mode === 'login') {
        const { error } = await academyClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await auth.refresh();
        navigate('/student', { replace: true });
      } else if (mode === 'signup') {
        const { error } = await academyClient.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        setMessage(c.sent);
      } else if (mode === 'recover') {
        await academyClient.auth.resetPasswordForEmail(email, { redirectTo });
        // Same response for existing and nonexistent accounts.
        setMessage(c.sent);
      } else {
        const { error } = await academyClient.auth.updateUser({ password });
        if (error) throw error;
        await auth.signOut();
        navigate('/login?reset=success', { replace: true });
      }
    } catch {
      setMessage(c.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageContainer className="portal-page">
      <section className="content-card portal-auth">
        <h1>{title}</h1>
        {!available ? (
          <p>{c.unavailable}</p>
        ) : (
          <form onSubmit={submit}>
            {mode !== 'reset' && (
              <label>
                {c.email}
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  dir="ltr"
                />
              </label>
            )}
            {mode !== 'recover' && (
              <label>
                {c.password}
                <Input
                  name="password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'login' ? 1 : 12}
                  maxLength={128}
                  required
                  dir="ltr"
                />
                <small>{c.passwordHint}</small>
              </label>
            )}
            {mode === 'signup' && (
              <label className="portal-check">
                <input type="checkbox" required />
                {c.consent} <Link to="/privacy">{c.privacy}</Link>
              </label>
            )}
            <Button disabled={busy} type="submit">
              {busy ? c.wait : mode === 'recover' ? c.send : title}
            </Button>
          </form>
        )}
        <p role="status">{message || (resetSucceeded ? c.saved : '')}</p>
        <nav className="portal-actions">
          <Link to="/login">{c.login}</Link>
          <Link to="/join">{c.signup}</Link>
          <Link to="/auth/recover">{c.recover}</Link>
        </nav>
        {mode === 'login' && academyClient && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              const email = String(new FormData(event.currentTarget).get('email') ?? '');
              setBusy(true);
              try {
                await academyClient!.auth.resend({
                  type: 'signup',
                  email,
                  options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
                });
                setMessage(c.sent);
              } catch {
                setMessage(c.sent);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>{c.confirmEmail}</p>
            <Input type="email" name="email" autoComplete="email" aria-label={c.email} required />
            <Button type="submit" variant="outline" disabled={busy}>
              {c.resend}
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
  const [callbackParams] = useState(() => new URLSearchParams(window.location.search));
  useEffect(() => {
    let current = true;
    const params = callbackParams;
    // Capture once for StrictMode, then scrub secrets even when validation fails.
    window.history.replaceState(null, '', '/auth/callback');
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
  }, [refresh, navigate, callbackParams]);
  return (
    <PageContainer className="portal-page">
      <h1>{c.login}</h1>
      <p role="status">{failed ? c.expired : c.wait}</p>
      {failed && <Link to="/login">{c.backLogin}</Link>}
    </PageContainer>
  );
}
