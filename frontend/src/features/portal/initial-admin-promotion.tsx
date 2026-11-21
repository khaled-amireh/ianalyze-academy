import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { client } from './data';
import { usePortalCopy } from './copy';

type Mode = 'checking' | 'hidden' | 'setup' | 'enroll-code' | 'challenge' | 'done';

export function InitialAdminPromotion() {
  const { arabic } = usePortalCopy();
  const [mode, setMode] = useState<Mode>('checking');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const pending = await client().rpc('current_user_has_initial_admin_promotion');
        if (pending.error) throw pending.error;
        if (!active || pending.data !== true) {
          if (active) setMode('hidden');
          return;
        }
        const factors = await client().auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        const verifiedTotp = factors.data.totp.find((factor) => factor.status === 'verified');
        if (verifiedTotp) {
          setFactorId(verifiedTotp.id);
          setMode('challenge');
        } else {
          setMode('setup');
        }
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
      const promoted = await client().rpc('promote_initial_academy_admin');
      if (promoted.error) throw promoted.error;
      setQrCode('');
      setMode('done');
    } catch {
      setCode('');
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const text = {
    title: arabic
      ? '\u0625\u0639\u062f\u0627\u062f \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629'
      : 'Complete approved Admin setup',
    description: arabic
      ? '\u062a\u062d\u0642\u0642 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0628\u062e\u0637\u0648\u062a\u064a\u0646 \u0645\u0637\u0644\u0648\u0628 \u0644\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062a\u0639\u064a\u064a\u0646.'
      : 'A verified authenticator challenge is required to complete this owner-approved promotion.',
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
    done: arabic
      ? '\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u0624\u0648\u0644.'
      : 'Admin setup completed.',
    error: arabic
      ? '\u062a\u0639\u0630\u0631 \u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062a\u062d\u0642\u0642. \u062a\u0623\u0643\u062f \u0645\u0646 \u0627\u0644\u0631\u0645\u0632 \u0648\u0627\u0644\u062d\u0633\u0627\u0628.'
      : 'Verification failed. Check the code and account, then try again.',
  };

  return (
    <section className="content-card" dir={arabic ? 'rtl' : 'ltr'}>
      <h2>{text.title}</h2>
      {mode === 'done' ? (
        <p role="status">{text.done}</p>
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
              <Button disabled={busy}>{text.submit}</Button>
            </form>
          )}
          {error && <p role="alert">{text.error}</p>}
        </>
      )}
    </section>
  );
}
