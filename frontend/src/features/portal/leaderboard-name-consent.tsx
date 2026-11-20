import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { FormNotice } from './form-feedback';
import { client, type Row } from './data';
import { usePortalCopy } from './copy';

export function LeaderboardNameConsent({
  profile,
  canOptIn,
}: {
  profile: Row<'profiles'>;
  canOptIn: boolean;
}) {
  const { c, arabic } = usePortalCopy();
  const auth = useAuth();
  const [consented, setConsented] = useState(profile.public_full_name_consent);
  const [serverConsented, setServerConsented] = useState(profile.public_full_name_consent);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);
  const [busy, setBusy] = useState(false);
  if (!profile.registered_at || auth.role !== 'student') return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const result = await client().rpc('set_public_full_name_consent', {
        p_consented: consented,
      });
      if (result.error) throw result.error;
      setServerConsented(consented);
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-card" dir={arabic ? 'rtl' : 'ltr'}>
      <h2>{c.publicNameConsentTitle}</h2>
      <p>{c.publicNameConsentDescription}</p>
      <p role="status">{serverConsented ? c.publicNameConsentOn : c.publicNameConsentOff}</p>
      <form onSubmit={submit} aria-busy={busy}>
        <label>
          <input
            type="checkbox"
            checked={consented}
            disabled={!canOptIn && !serverConsented}
            onChange={(event) => setConsented(event.currentTarget.checked)}
          />{' '}
          {c.publicNameConsentCheckbox}
        </label>
        <div className="portal-actions">
          <Button disabled={busy || consented === serverConsented || (consented && !canOptIn)}>
            {c.publicNameConsentSave}
          </Button>
        </div>
      </form>
      <FormNotice
        message={status === 'error' ? c.error : status === 'saved' ? c.saved : ''}
        kind={status === 'saved' ? 'success' : 'error'}
      />
    </section>
  );
}
