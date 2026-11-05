import { useId, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { Megaphone, Pencil, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { fetchAll } from '@/lib/fetch-all';
import { checked, client, useRemote, type Row } from './data';
import { stateText, usePortalCopy, type PortalCopy } from './copy';
import { FormNotice } from './form-feedback';
import { requestError } from './form-validation';
import {
  emptyAnnouncement,
  validateAnnouncement,
  type AnnouncementValues,
} from './announcement-validation';
import './announcements.css';

async function loadAnnouncements() {
  return fetchAll((start, end) =>
    client()
      .from('announcements')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id')
      .range(start, end),
  );
}

export function AnnouncementManager() {
  const { c, arabic } = usePortalCopy();
  const { data, error, reload, update } = useRemote(loadAnnouncements);
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);
  const [values, setValues] = useState<AnnouncementValues>(emptyAnnouncement);
  const [editing, setEditing] = useState<Row<'announcements'> | null>(null);
  const [previewLanguage, setPreviewLanguage] = useState<'ar' | 'en' | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateAnnouncement>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ key: keyof PortalCopy; kind: 'error' | 'success' } | null>(
    null,
  );
  const language = previewLanguage ?? (arabic ? 'ar' : 'en');
  const previewTitle = values[`title_${language}`].trim();
  const previewBody = values[`body_${language}`].trim();

  function resetComposer() {
    setEditing(null);
    setValues({ ...emptyAnnouncement });
    setErrors({});
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const invalid = validateAnnouncement(values);
    setErrors(invalid);
    setNotice(null);
    if (Object.keys(invalid).length) {
      const first = event.currentTarget.elements.namedItem(Object.keys(invalid)[0] ?? '');
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    const trimmed = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim()]),
    ) as AnnouncementValues;
    try {
      // Returning a row detects RLS-denied/stale updates instead of reporting false success.
      const result = editing
        ? await client()
            .from('announcements')
            .update(trimmed)
            .eq('id', editing.id)
            .select('*')
            .single()
        : await client()
            .from('announcements')
            .insert({ ...trimmed, status: 'published' })
            .select('*')
            .single();
      const saved = checked(result);
      if (editing) update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      else update((items) => [saved, ...items]);
      setNotice({
        key: editing ? 'announcementUpdated' : 'announcementPublished',
        kind: 'success',
      });
      if (!editing) window.dispatchEvent(new Event('academy-notifications-updated'));
      resetComposer();
    } catch (error) {
      setNotice({ key: requestError(error), kind: 'error' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function changePublication(item: Row<'announcements'>) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const saved = checked(
        await client()
          .from('announcements')
          .update({ status: item.status === 'published' ? 'draft' : 'published' })
          .eq('id', item.id)
          .select('*')
          .single(),
      );
      update((items) => items.map((entry) => (entry.id === saved.id ? saved : entry)));
      if (editing?.id === item.id) setEditing(saved);
      setNotice({
        key: saved.status === 'published' ? 'announcementPublished' : 'announcementUnpublished',
        kind: 'success',
      });
      window.dispatchEvent(new Event('academy-notifications-updated'));
      if (saved.status === 'draft')
        requestAnimationFrame(() => document.getElementById(id + '-published')?.focus());
      return true;
    } catch (error) {
      setNotice({ key: requestError(error), kind: 'error' });
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="content-card announcement-center" aria-labelledby={id + '-heading'}>
      <header className="announcement-heading">
        <span className="announcement-icon">
          <Megaphone aria-hidden="true" size={24} />
        </span>
        <div>
          <h2 id={id + '-heading'}>{c.announcements}</h2>
          <p>{c.announcementSubtitle}</p>
        </div>
      </header>
      <form ref={formRef} onSubmit={save} noValidate aria-busy={busy}>
        {editing && (
          <p className="announcement-editing" role="status">
            {c.editingAnnouncement}: <bdi>{arabic ? editing.title_ar : editing.title_en}</bdi>
          </p>
        )}
        <fieldset className="announcement-languages" disabled={busy}>
          {(['ar', 'en'] as const).map((lang) => (
            <div
              className="announcement-language"
              lang={lang}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              key={lang}
            >
              <h3>{lang === 'ar' ? 'العربية' : 'English'}</h3>
              {(['title', 'body'] as const).map((kind) => {
                const name = `${kind}_${lang}` as keyof AnnouncementValues;
                const fieldId = id + '-' + name;
                const props = {
                  id: fieldId,
                  name,
                  value: values[name],
                  required: true,
                  maxLength: kind === 'title' ? 200 : 5000,
                  'aria-invalid': errors[name] ? (true as const) : undefined,
                  'aria-describedby': errors[name] ? fieldId + '-error' : undefined,
                  placeholder:
                    lang === 'ar'
                      ? kind === 'title'
                        ? 'مثال: موعد اللقاء القادم'
                        : 'اكتب تفاصيل الإعلان للطلاب…'
                      : kind === 'title'
                        ? 'e.g. Our next academy session'
                        : 'Write the announcement details for students…',
                  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                    setValues((current) => ({ ...current, [name]: event.target.value }));
                    setErrors((current) => ({ ...current, [name]: undefined }));
                  },
                };
                return (
                  <FormField
                    key={name}
                    id={fieldId}
                    label={
                      lang === 'ar'
                        ? kind === 'title'
                          ? 'عنوان الإعلان'
                          : 'نص الإعلان'
                        : kind === 'title'
                          ? 'Announcement title'
                          : 'Announcement body'
                    }
                    error={errors[name] ? c[errors[name]] : undefined}
                  >
                    {kind === 'title' ? <Input {...props} /> : <textarea {...props} rows={6} />}
                  </FormField>
                );
              })}
            </div>
          ))}
        </fieldset>
        <section className="announcement-preview" aria-labelledby={id + '-preview'}>
          <div className="announcement-toolbar">
            <h3 id={id + '-preview'}>{c.announcementPreview}</h3>
            <div
              className="announcement-language-switch"
              role="group"
              aria-label={c.previewLanguage}
            >
              {(['ar', 'en'] as const).map((lang) => (
                <Button
                  type="button"
                  size="sm"
                  key={lang}
                  variant={language === lang ? 'secondary' : 'ghost'}
                  aria-pressed={language === lang}
                  lang={lang}
                  onClick={() => setPreviewLanguage(lang)}
                >
                  {lang === 'ar' ? 'العربية' : 'English'}
                </Button>
              ))}
            </div>
          </div>
          <p className="announcement-help">{c.previewOnly}</p>
          <article
            className="content-card notification-item"
            lang={language}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          >
            {previewTitle || previewBody ? (
              <>
                {previewTitle && <h3>{previewTitle}</h3>}
                {previewBody && <p className="notification-body">{previewBody}</p>}
              </>
            ) : (
              <p>
                {language === 'ar'
                  ? 'أضف عنوان الإعلان ونصه بالعربية لعرض المعاينة هنا.'
                  : 'Add an English title and body to preview your announcement here.'}
              </p>
            )}
          </article>
        </section>
        <div className="announcement-toolbar">
          <Button type="submit" disabled={busy || !data || error}>
            {busy ? c.wait : editing ? c.saveAnnouncement : c.publishAnnouncement}
          </Button>
          {editing && (
            <Button type="button" variant="outline" disabled={busy} onClick={resetComposer}>
              {c.cancelAnnouncementEdit}
            </Button>
          )}
        </div>
      </form>
      <FormNotice message={notice ? c[notice.key] : ''} kind={notice?.kind} />
      <section
        className="announcement-list"
        aria-labelledby={id + '-published'}
        aria-busy={!data && !error}
      >
        <h2 id={id + '-published'} tabIndex={-1}>
          {c.publishedAnnouncements}
        </h2>
        {error ? (
          <>
            <FormNotice message={c.error} kind="error" />
            <Button variant="outline" disabled={busy} onClick={reload}>
              {c.retry}
            </Button>
          </>
        ) : !data ? (
          <p role="status">{c.wait}</p>
        ) : data.length === 0 ? (
          <p className="announcement-empty">{c.noAnnouncements}</p>
        ) : null}
        {data?.map((item) => (
          <article
            key={item.id}
            className="announcement-item"
            aria-label={arabic ? item.title_ar : item.title_en}
          >
            <div className="announcement-toolbar">
              <span className="announcement-status">{stateText(item.status, c)}</span>
              <time dateTime={item.created_at}>
                {new Intl.DateTimeFormat(arabic ? 'ar-JO' : 'en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Asia/Amman',
                }).format(new Date(item.created_at))}
              </time>
            </div>
            <h3 dir="auto">{arabic ? item.title_ar : item.title_en}</h3>
            <p className="notification-body announcement-excerpt" dir="auto">
              {arabic ? item.body_ar : item.body_en}
            </p>
            <div className="announcement-toolbar">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setEditing(item);
                  setValues({
                    title_ar: item.title_ar,
                    title_en: item.title_en,
                    body_ar: item.body_ar,
                    body_en: item.body_en,
                  });
                  setErrors({});
                  setNotice(null);
                  const form = formRef.current;
                  form?.scrollIntoView({ block: 'start' });
                  (
                    form?.elements.namedItem(arabic ? 'title_ar' : 'title_en') as HTMLElement | null
                  )?.focus({ preventScroll: true });
                }}
              >
                <Pencil aria-hidden="true" />
                {c.editAnnouncement}
              </Button>
              {item.status === 'published' ? (
                <UnpublishAnnouncement item={item} busy={busy} onConfirm={changePublication} />
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void changePublication(item)}
                >
                  {c.publishAnnouncement}
                </Button>
              )}
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}

function UnpublishAnnouncement({
  item,
  busy,
  onConfirm,
}: {
  item: Row<'announcements'>;
  busy: boolean;
  onConfirm: (item: Row<'announcements'>) => Promise<boolean>;
}) {
  const { c, arabic } = usePortalCopy();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setOpen(next);
          setFailed(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={busy}>
          <Archive aria-hidden="true" />
          {c.unpublish}
        </Button>
      </DialogTrigger>
      <DialogContent
        closeLabel={c.cancelAnnouncementEdit}
        dir={arabic ? 'rtl' : 'ltr'}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogTitle>{c.unpublishAnnouncementTitle}</DialogTitle>
        <DialogDescription>{c.unpublishAnnouncementHelp}</DialogDescription>
        <p dir="auto">{arabic ? item.title_ar : item.title_en}</p>
        <FormNotice message={failed ? c.error : ''} kind="error" />
        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            {c.cancelAnnouncementEdit}
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (await onConfirm(item)) setOpen(false);
              else setFailed(true);
            }}
          >
            {busy ? c.wait : c.unpublish}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
