import { useCallback, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/use-auth';
import { client, useRemote, type Row } from '@/features/portal/data';
import { FormNotice } from '@/features/portal/form-feedback';
import type { Json } from '@/types/database';
import { isConflict, requireWrite } from './data';
import { useWeek1Copy } from './copy';
import { notifyWeek1, useWeek1Sync } from './use-week1-sync';
import { safeLinks, type SessionTopic } from './domain';
import { parsePublicSessionTopics } from './session-public-content';

type ApiResult = { data: unknown; error: unknown };
type SessionApi = {
  from: (table: 'session_public_content') => {
    select: (columns: 'week_number,published,topics') => {
      eq: (
        column: 'week_number' | 'published',
        value: number | boolean,
      ) => {
        eq: (
          column: 'week_number' | 'published',
          value: number | boolean,
        ) => {
          maybeSingle: () => Promise<ApiResult>;
        };
        maybeSingle: () => Promise<ApiResult>;
      };
    };
  };
  rpc: (
    name: 'save_session_content',
    args: { p_week: number; p_topics: Json; p_published: boolean; p_version: number },
  ) => Promise<{ error: unknown }>;
};

function sessionApi() {
  // This legacy, RLS-protected projection remains in production but its source
  // migration also contains the intentionally excluded assignment/scoring
  // stack. Keep this narrow compatibility boundary untyped and select only
  // the three approved projection columns; the database policy is authoritative.
  return client() as unknown as SessionApi;
}

export function SessionContent() {
  const auth = useAuth();
  return auth.status === 'signed-in' && auth.role === 'team' ? <PrivateSession /> : null;
}

function PrivateSession() {
  const { c } = useWeek1Copy();
  const load = useCallback(async () => {
    const [sessionResult, publicationResult] = await Promise.all([
      client().from('week1_session').select('*').eq('id', 1).maybeSingle(),
      sessionApi()
        .from('session_public_content')
        .select('week_number,published,topics')
        .eq('week_number', 1)
        .maybeSingle(),
    ]);
    requireWrite(sessionResult);
    requireWrite(publicationResult);
    if (!sessionResult.data) throw new Error('session_unavailable');
    const row = sessionResult.data as Row<'week1_session'>;
    const publication = publicationResult.data as { published?: unknown; topics?: unknown } | null;
    return {
      row,
      published: publication?.published === true,
      topics: (row.topics as SessionTopic[]) ?? [],
    };
  }, []);
  const remote = useRemote(load);
  const [saved, setSaved] = useState(false);
  return (
    <section className="content-card" aria-labelledby="week1-session">
      <h2 id="week1-session">{c.session}</h2>
      <p>{c.sessionHelp}</p>
      {saved && <FormNotice message={c.saved} kind="success" />}
      {remote.error && <FormNotice message={c.error} kind="error" />}
      {remote.data ? (
        <SessionEditor
          key={remote.data.row.version}
          row={remote.data.row}
          initialTopics={remote.data.topics}
          initialPublished={remote.data.published}
          onSaved={() => {
            setSaved(true);
            remote.refresh();
            notifyWeek1('session');
          }}
        />
      ) : remote.error ? (
        <Button onClick={remote.refresh}>{c.retry}</Button>
      ) : (
        <p role="status">{c.loading}</p>
      )}
    </section>
  );
}

function SessionEditor({
  row,
  initialTopics,
  initialPublished,
  onSaved,
}: {
  row: Row<'week1_session'>;
  initialTopics: SessionTopic[];
  initialPublished: boolean;
  onSaved: () => void;
}) {
  const { c, arabic } = useWeek1Copy();
  const [topics, setTopics] = useState<SessionTopic[]>(initialTopics);
  const [published, setPublished] = useState(initialPublished);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const flight = useRef(false);
  function edit(i: number, key: keyof SessionTopic, value: string | boolean) {
    setTopics((all) => all.map((topic, j) => (i === j ? { ...topic, [key]: value } : topic)));
    setDirty(true);
    setNotice('');
  }
  function move(i: number, offset: number) {
    setTopics((all) => {
      const next = [...all];
      [next[i], next[i + offset]] = [next[i + offset]!, next[i]!];
      return next;
    });
    setDirty(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setNotice('');
    try {
      if (!topics.every((topic) => safeLinks(topic.links))) throw new Error('invalid_links');
      requireWrite(
        await sessionApi().rpc('save_session_content', {
          p_week: 1,
          p_topics: topics as unknown as Json,
          p_published: published,
          p_version: row.version,
        }),
      );
      setDirty(false);
      onSaved();
    } catch (error) {
      setNotice(isConflict(error) ? c.conflict : c.invalidLinks);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} aria-busy={busy}>
      <fieldset disabled={busy} className="week1-fieldset">
        <label className="portal-check">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => {
              setPublished(event.target.checked);
              setDirty(true);
            }}
          />
          {c.sessionVisibility}
        </label>
        <p role="status">
          {published ? c.sessionShown : c.sessionHidden}
          {published && !topics.some((topic) => topic.visible) && ` ${c.noSelectedTopics}`}
        </p>
        {topics.map((topic, i) => (
          <article className="week1-topic" key={topic.id} data-topic-id={topic.id}>
            <label className="portal-check">
              <input
                type="checkbox"
                checked={topic.status === 'completed'}
                onChange={(event) =>
                  edit(i, 'status', event.target.checked ? 'completed' : 'planned')
                }
              />
              <strong>{arabic ? topic.title_ar : topic.title_en}</strong>
              <span>{c.completed}</span>
            </label>
            <details open={!topic.title_en || !topic.title_ar}>
              <summary>{c.edit}</summary>
              <div className="portal-grid">
                <label>
                  {c.titleEn}
                  <Input
                    dir="ltr"
                    value={topic.title_en}
                    required
                    maxLength={200}
                    onChange={(event) => edit(i, 'title_en', event.target.value)}
                  />
                </label>
                <label>
                  {c.titleAr}
                  <Input
                    dir="rtl"
                    value={topic.title_ar}
                    required
                    maxLength={200}
                    onChange={(event) => edit(i, 'title_ar', event.target.value)}
                  />
                </label>
              </div>
              <label>
                {c.topicDescription}
                <textarea
                  rows={2}
                  maxLength={10000}
                  value={topic.description}
                  onChange={(event) => edit(i, 'description', event.target.value)}
                />
              </label>
              <label>
                {c.links}
                <textarea
                  rows={2}
                  maxLength={5000}
                  dir="ltr"
                  value={topic.links}
                  onChange={(event) => edit(i, 'links', event.target.value)}
                />
              </label>
              <label>
                {c.notes}
                <textarea
                  rows={2}
                  maxLength={10000}
                  value={topic.notes}
                  onChange={(event) => edit(i, 'notes', event.target.value)}
                />
              </label>
            </details>
            <div className="portal-actions">
              <Button
                type="button"
                variant="outline"
                aria-pressed={!!topic.visible}
                onClick={() => edit(i, 'visible', !topic.visible)}
              >
                {topic.visible ? c.hide : c.show}
              </Button>
              <span>
                {topic.visible
                  ? published
                    ? c.topicVisibility
                    : c.waitingForSession
                  : c.hiddenTopic}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={i === 0}
                aria-label={`${c.up}: ${arabic ? topic.title_ar : topic.title_en}`}
                onClick={() => move(i, -1)}
              >
                {c.up}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={i === topics.length - 1}
                aria-label={`${c.down}: ${arabic ? topic.title_ar : topic.title_en}`}
                onClick={() => move(i, 1)}
              >
                {c.down}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (window.confirm(c.confirmDelete)) {
                    setTopics((all) => all.filter((item) => item.id !== topic.id));
                    setDirty(true);
                  }
                }}
              >
                {c.remove}
              </Button>
            </div>
          </article>
        ))}
        <div className="portal-actions">
          <Button
            type="button"
            variant="outline"
            disabled={topics.length >= 100}
            onClick={() => {
              setTopics((all) => [
                ...all,
                {
                  id: crypto.randomUUID(),
                  title_en: '',
                  title_ar: '',
                  description: '',
                  links: '',
                  notes: '',
                  status: 'planned',
                  visible: false,
                },
              ]);
              setDirty(true);
            }}
          >
            {c.addTopic}
          </Button>
          <Button disabled={busy || !dirty}>{c.save}</Button>
        </div>
      </fieldset>
      {dirty && <p role="status">{c.unsaved}</p>}
      <FormNotice message={notice} kind="error" />
    </form>
  );
}

export function PublicSessionContent({ week = 1 }: { week?: number }) {
  const auth = useAuth();
  return auth.status === 'signed-in' && auth.role === 'student' ? (
    <PublishedSession week={week} />
  ) : null;
}

function PublishedSession({ week }: { week: number }) {
  const { c, arabic } = useWeek1Copy();
  const load = useCallback(async () => {
    const result = await sessionApi()
      .from('session_public_content')
      .select('week_number,published,topics')
      .eq('week_number', week)
      .eq('published', true)
      .maybeSingle();
    requireWrite(result);
    if (!result.data) return null;
    const publication = result.data as { topics?: unknown };
    const topics = parsePublicSessionTopics(publication.topics);
    if (!topics) throw new Error('session_content_invalid');
    return topics;
  }, [week]);
  const remote = useRemote(load);
  useWeek1Sync(remote.refresh, 'session');
  if (!remote.data?.length)
    return remote.error ? <FormNotice message={c.error} kind="error" /> : null;
  const number = new Intl.NumberFormat(arabic ? 'ar-JO' : 'en-GB');
  return (
    <section className="content-card" id="published-session">
      <h2>{c.publicSession}</h2>
      <div className="session-resources-grid">
        {remote.data.map((topic) => (
          <article className="s-card week1-resource-card" key={topic.id}>
            <h3>{arabic ? topic.title_ar : topic.title_en}</h3>
            <p>{topic.description}</p>
            {topic.links
              .split('\n')
              .filter((link) => link.trim() && safeLinks(link))
              .map((link) => (
                <p key={link}>
                  <a href={link.trim()} target="_blank" rel="noopener noreferrer" dir="ltr">
                    {link} ↗
                  </a>
                </p>
              ))}
            <small>
              {c.week} {number.format(week)} ·{' '}
              {topic.status === 'completed' ? c.completed : c.planned}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
