import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { client } from './data';
import { usePortalCopy } from './copy';

type Mode = 'checking' | 'hidden' | 'setup' | 'enroll-code' | 'challenge' | 'done' | 'mfa-ready';
const initialAdminTarget = '79b1672a-b609-4ec4-814a-15ed209796af';

export function InitialAdminPromotion() {
  const { arabic } = usePortalCopy();
  const [mode, setMode] = useState<Mode>('checking');
  const [promotionPending, setPromotionPending] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const supabase = client();
        const [userResult, roleResult, adminResult, pendingResult] = await Promise.all([
          supabase.auth.getUser(),
          supabase.rpc('current_academy_role'),
          supabase.rpc('current_academy_is_admin'),
          supabase.rpc('current_user_has_initial_admin_promotion'),
        ]);
        if (
          userResult.error ||
          userResult.data.user?.id !== initialAdminTarget ||
          roleResult.error ||
          roleResult.data !== 'team' ||
          adminResult.error ||
          adminResult.data !== false ||
          pendingResult.error
        )
          throw new Error('Owner MFA setup is unavailable.');
        if (!active) return;
        const pending = pendingResult.data === true;
        setPromotionPending(pending);
        const factors = await supabase.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        const verifiedTotp = factors.data.totp.find((factor) => factor.status === 'verified');
        if (verifiedTotp) {
          setFactorId(verifiedTotp.id);
          setMode(pending ? 'challenge' : 'mfa-ready');
          return;
        }
        setMode('setup');
      } catch {
        if (active) {
          setError(true);
          setMode('hidden');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (mode === 'checking' || mode === 'hidden') return null;

  async function startTotpEnrollment() {
    setBusy(true);
    setError(false);
    try {
      const result = await client().auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Academy Admin',
      });
      if (result.error) throw result.error;
      setFactorId(result.data.id);
      setQrCode(result.data.totp.qr_code);
      setMode('enroll-code');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function completePromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || !/^\d{6,8}$/.test(code.trim())) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const challenge = await client().auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const verified = await client().auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verified.error) throw verified.error;
      setCode('');
      const assurance = await client().auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== 'aal2') throw assurance.error;
      setQrCode('');
      if (promotionPending) {
        const promoted = await client().rpc('promote_initial_academy_admin');
        if (promoted.error) throw promoted.error;
        setMode('done');
      } else {
        setMode('mfa-ready');
      }
    } catch {
      setCode('');
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const text = {
    title: arabic
      ? '\u0625\u0639\u062f\u0627\u062f \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0627\u0644\u0622\u0645\u0646\u0629'
      : promotionPending
        ? 'Complete approved Admin setup'
        : 'Prepare secure Admin authentication',
    description: arabic
      ? '\u062a\u062d\u0642\u0642 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0628\u062e\u0637\u0648\u062a\u064a\u0646 \u0645\u0637\u0644\u0648\u0628 \u0644\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062a\u0639\u064a\u064a\u0646.'
      : promotionPending
        ? 'A verified authenticator challenge is required to complete this owner-approved promotion.'
        : 'Set up and verify your authenticator now. Admin access will remain unchanged until a separate approval is consumed after deployment.',
    enroll: arabic
      ? '\u0625\u0639\u062f\u0627\u062f \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629'
      : 'Set up an authenticator',
    scan: arabic
      ? '\u0627\u0645\u0633\u062d \u0631\u0645\u0632 QR \u0628\u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u062b\u0645 \u0623\u062f\u062e\u0644 \u0627\u0644\u0631\u0645\u0632.'
      : 'Scan this QR code with your authenticator app, then enter its code.',
    code: arabic
      ? '\u0631\u0645\u0632 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629'
      : 'Authenticator code',
    submit: arabic
      ? '\u062a\u062d\u0642\u0642 \u0648\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062a\u0639\u064a\u064a\u0646'
      : 'Verify and complete promotion',
    verify: arabic
      ? '\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629'
      : 'Verify authenticator',
    done: arabic
      ? '\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u0624\u0648\u0644.'
      : 'Admin setup completed.',
    mfaReady: arabic
      ? '\u062a\u0645 \u062a\u062c\u0647\u064a\u0632 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629. \u0644\u0645 \u064a\u062a\u0645 \u0645\u0646\u062d \u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0627\u0644\u0645\u0633\u0624\u0648\u0644.'
      : 'Authenticator verified. No Admin access was granted.',
    error: arabic
      ? '\u062a\u0639\u0630\u0631 \u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062a\u062d\u0642\u0642. \u062a\u0623\u0643\u062f \u0645\u0646 \u0627\u0644\u0631\u0645\u0632 \u0648\u0627\u0644\u062d\u0633\u0627\u0628.'
      : 'Verification failed. Check the code and account, then try again.',
  };

  return (
    <section className="content-card" dir={arabic ? 'rtl' : 'ltr'}>
      <h2>{text.title}</h2>
      {mode === 'done' ? (
        <p role="status">{text.done}</p>
      ) : mode === 'mfa-ready' ? (
        <p role="status">{text.mfaReady}</p>
      ) : (
        <>
          <p>{text.description}</p>
          {mode === 'setup' && (
            <Button type="button" disabled={busy} onClick={startTotpEnrollment}>
              {text.enroll}
            </Button>
          )}
          {qrCode && (
            <>
              <p>{text.scan}</p>
              <img src={qrCode} alt={text.scan} />
            </>
          )}
          {(mode === 'challenge' || mode === 'enroll-code') && (
            <form className="portal-grid" onSubmit={completePromotion} aria-busy={busy}>
              <label>
                {text.code}
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6,8}"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
              <Button disabled={busy}>{promotionPending ? text.submit : text.verify}</Button>
            </form>
          )}
          {error && <p role="alert">{text.error}</p>}
        </>
      )}
    </section>
  );
}
