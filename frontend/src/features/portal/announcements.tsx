import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { client, useRemote } from './data';
import { usePortalCopy } from './copy';
import { FormNotice } from './form-feedback';

async function loadAnnouncements() {
  const { data, error } = await client()
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export function AnnouncementManager() {
  const { c } = usePortalCopy();
  const { data, error, reload } = useRemote(loadAnnouncements);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const element = event.currentTarget,
      form = new FormData(element);
    setBusy(true);
    setFailed(false);
    try {
      const { error } = await client()
        .from('announcements')
        .insert({
          title_ar: String(form.get('title_ar')).trim(),
          title_en: String(form.get('title_en')).trim(),
          body_ar: String(form.get('body_ar')).trim(),
          body_en: String(form.get('body_en')).trim(),
          status: 'published',
        });
      if (error) throw error;
      element.reset();
      reload();
      window.dispatchEvent(new Event('academy-notifications-updated'));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card">
      <h2>{c.announcements}</h2>
      <form onSubmit={publish}>
        <fieldset className="portal-grid" disabled={busy}>
          <label lang="ar" dir="rtl">
            عنوان الإعلان بالعربية
            <Input name="title_ar" required maxLength={200} />
          </label>
          <label lang="en" dir="ltr">
            Announcement title in English
            <Input name="title_en" required maxLength={200} />
          </label>
          <label lang="ar" dir="rtl">
            نص الإعلان بالعربية
            <textarea name="body_ar" required maxLength={5000} />
          </label>
          <label lang="en" dir="ltr">
            Announcement in English
            <textarea name="body_en" required maxLength={5000} />
          </label>
        </fieldset>
        <Button disabled={busy}>{c.publishAnnouncement}</Button>
      </form>
      <FormNotice message={failed || error ? c.error : ''} kind="error" />
      {data?.map((a) => (
        <article key={a.id}>
          <h3 dir="auto">
            {a.title_ar} / {a.title_en}
          </h3>
          <p dir="auto">{a.body_ar}</p>
          <p dir="auto">{a.body_en}</p>
          <Button
            disabled={busy}
            variant="outline"
            onClick={async () => {
              setBusy(true);
              setFailed(false);
              try {
                const { error } = await client()
                  .from('announcements')
                  .update({ status: a.status === 'published' ? 'draft' : 'published' })
                  .eq('id', a.id);
                if (error) throw error;
                reload();
                window.dispatchEvent(new Event('academy-notifications-updated'));
              } catch {
                setFailed(true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {a.status === 'published' ? c.unpublish : c.publish}
          </Button>
        </article>
      ))}
    </section>
  );
}
