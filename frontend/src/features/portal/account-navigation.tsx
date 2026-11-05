import { Link } from 'react-router';
import { DropdownMenu } from 'radix-ui';
import { UserRound, Bell } from 'lucide-react';
import { useAuth } from '@/features/auth/use-auth';
import { useTranslation } from 'react-i18next';
import { useOwnProfile } from './use-own-profile';
import { usePortalCopy } from './copy';
import { useNotifications } from './use-notifications';

export function JoinNavigation({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const auth = useAuth();
  const { profile } = useOwnProfile();
  const { t } = useTranslation();
  const { c } = usePortalCopy();
  if (auth.status === 'signed-in') {
    if (!profile || profile.registered_at) return null;
    return (
      <Link className={className} to="/student" onClick={onNavigate}>
        {c.complete}
      </Link>
    );
  }
  if (auth.status === 'loading' || auth.status === 'error') return null;
  return (
    <Link className={className} to="/join" onClick={onNavigate}>
      {t('nav.join')}
    </Link>
  );
}

export function ProfileNavigation() {
  const auth = useAuth();
  const { c } = usePortalCopy();
  if (auth.status !== 'signed-in') return null;
  const dashboard = auth.role === 'team' ? '/workspace' : '/student';
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="account-icon" aria-label={c.profile}>
        <UserRound aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="account-menu" align="end" sideOffset={8}>
          <DropdownMenu.Item asChild>
            <Link to="/profile">{c.profile}</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link to="/profile/edit">{c.editProfile}</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link to={dashboard}>{c.dashboard}</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => void auth.signOut()}>{c.logout}</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
export function NotificationBell() {
  const auth = useAuth();
  const { c } = usePortalCopy();
  const { items } = useNotifications();
  if (auth.status !== 'signed-in') return null;
  const unread = items.filter((x) => !x.read_at).length;
  return (
    <Link
      className="account-icon notification-bell"
      to="/notifications"
      aria-label={`${c.notifications}${unread ? ` (${unread} ${c.unread})` : ''}`}
    >
      <Bell aria-hidden="true" />
      {unread > 0 && (
        <span className="notification-count" aria-hidden="true">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
