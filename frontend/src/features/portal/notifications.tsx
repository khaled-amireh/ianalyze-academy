import { useState } from 'react';
import { Link } from 'react-router';
import { academyClient } from '@/lib/academy-client';
import { PageContainer } from '@/components/shared/page-container';
import { Button } from '@/components/ui/button';
import { usePortalCopy } from './copy';
import { FormNotice } from './form-feedback';
import { useNotifications } from './use-notifications';

export function NotificationsPage() {
  const { c, arabic } = usePortalCopy();
  const { items, error, loading, reload } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function mark(key: string | null) {
    if (!academyClient || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const { error } = await academyClient.rpc('read_notification', {
        p_event_key: key ?? undefined,
      });
      if (error) throw error;
      window.dispatchEvent(new Event('academy-notifications-updated'));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageContainer className="portal-page">
      <h1 id="page-title" tabIndex={-1}>
        {c.notifications}
      </h1>
      <div className="portal-actions">
        <Button disabled={busy || !items.some((x) => !x.read_at)} onClick={() => void mark(null)}>
          {c.markAllRead}
        </Button>
        <Button variant="outline" onClick={reload}>
          {c.retry}
        </Button>
      </div>
      <FormNotice message={error || failed ? c.error : ''} kind="error" />
      {loading ? (
        <p role="status">{c.wait}</p>
      ) : !error && items.length === 0 ? (
        <p>{c.noNotifications}</p>
      ) : null}
      {items.map((item) => (
        <article className="content-card notification-item" key={item.event_key}>
          {!item.read_at && <span className="notification-unread">{c.unread}</span>}
          <h2 dir="auto">{arabic ? item.title_ar : item.title_en}</h2>
          <p className="notification-body" dir="auto">
            {arabic ? item.body_ar : item.body_en}
          </p>
          <time dateTime={item.created_at}>
            {new Intl.DateTimeFormat(arabic ? 'ar-JO' : 'en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Amman',
            }).format(new Date(item.created_at))}
          </time>
          <div className="portal-actions">
            {item.href === '/student' && <Link to="/student">{c.dashboard}</Link>}
            {!item.read_at && (
              <Button disabled={busy} variant="outline" onClick={() => void mark(item.event_key)}>
                {c.markRead}
              </Button>
            )}
          </div>
        </article>
      ))}
    </PageContainer>
  );
}
