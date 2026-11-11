import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router';
import { PageContainer } from '@/components/shared/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { academyClient } from '@/lib/academy-client';
import { usePortalCopy } from './copy';
import { useAuth } from '@/features/auth/use-auth';
import { ProfileDetails } from './profile-details';
import { ProfileForm } from './student-page';
import { useOwnProfile } from './use-own-profile';
import { FormNotice } from './form-feedback';

export function ProfilePage({ edit = false }: { edit?: boolean }) {
  const { c, arabic } = usePortalCopy();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, error, updateProfile } = useOwnProfile();
  const saved = !edit && (location.state as { profileSaved?: boolean } | null)?.profileSaved;
  if (!profile)
    return (
      <PageContainer className="portal-page" dir={arabic ? 'rtl' : 'ltr'}>
        <h1 id="page-title" tabIndex={-1}>
          {c.profile}
        </h1>
        <p role="status">{error ? c.error : c.wait}</p>
      </PageContainer>
    );
  if (!profile.registered_at && auth.role !== 'team') return <Navigate to="/student" replace />;
  return (
    <PageContainer className="portal-page" dir={arabic ? 'rtl' : 'ltr'}>
      <h1 id="page-title" tabIndex={-1}>
        {edit ? c.editProfile : c.profile}
      </h1>
      <FormNotice message={saved ? c.saved : ''} kind="success" />
      {edit ? (
        <ProfileForm
          key={profile.id}
          profile={profile}
          onSaved={(persisted) => {
            updateProfile(persisted);
            navigate('/profile', { replace: true, state: { profileSaved: true } });
          }}
          onCancel={() => navigate('/profile')}
        />
      ) : (
        <section className="content-card">
          <ProfileDetails profile={profile} />
          <Link to="/profile/edit">{c.editProfile}</Link>
        </section>
      )}
      {edit && <AccountSecurity />}
    </PageContainer>
  );
}
function AccountSecurity() {
  const { c } = usePortalCopy();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<'sent' | 'error' | null>(null);
  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!academyClient || busy) return;
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await academyClient.auth.updateUser(
        { email },
        { emailRedirectTo: window.location.origin + '/auth/callback' },
      );
      if (error) throw error;
      setMessage('sent');
    } catch {
      setMessage('error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card">
      <h2>{c.emailChange}</h2>
      <form onSubmit={change}>
        <label>
          {c.email}
          <Input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            dir="ltr"
            disabled={busy}
          />
        </label>
        <Button disabled={busy}>{c.emailChange}</Button>
      </form>
      <FormNotice
        message={message === 'sent' ? c.emailChangeSent : message ? c.error : ''}
        kind={message === 'sent' ? 'success' : 'error'}
      />
      <Link to="/auth/recover">{c.recover}</Link>
    </section>
  );
}
