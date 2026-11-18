import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/use-auth';
import { client, useRemote, type Row } from '@/features/portal/data';
import { FormNotice } from '@/features/portal/form-feedback';
import type { Json } from '@/types/database';
import { useAssignmentCopy } from '@/features/assignments/copy';
import { useWeek1Sync } from './use-week1-sync';
import { DraftForm, completeFormDraft } from '@/features/drafts';
import { isConflict, requireWrite } from './data';
import { safeLinks, type SessionTopic } from './domain';

// The week parameter reuses the same model for later sessions. The historical
// private table remains private; students query only its whitelisted projection.
export function SessionContent({ week = 1 }: { week?: number }) {
  const auth = useAuth();
  const { c } = useAssignmentCopy();
  const [selectedWeek, setSelectedWeek] = useState(week);
  return auth.status === 'signed-in' && auth.role === 'team' ? (
    <>
      <label>
        {c.sessionWeek}
        <Input
          type="number"
          name="session_week"
          min={1}
          max={999}
          value={selectedWeek}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (Number.isInteger(value) && value >= 1 && value <= 999) setSelectedWeek(value);
          }}
        />
      </label>
      <PrivateSession key={selectedWeek} week={selectedWeek} />
    </>
  ) : null;
}
function PrivateSession({ week }: { week: number }) {
  const { c } = useAssignmentCopy();
  const load = useCallback(async () => {
    const [privateRow, publicRow] = await Promise.all([
      client().from('week1_session').select('*').eq('id', week).maybeSingle(),
      client().from('session_public_content').select('*').eq('week_number', week).maybeSingle(),
    ]);
    requireWrite(privateRow);
    requireWrite(publicRow);
    return { session: privateRow.data, published: publicRow.data?.published ?? false };
  }, [week]);
  const remote = useRemote(load);
  const [saved, setSaved] = useState(false);
  return (
    <section className="content-card" aria-labelledby="week1-session">
      <h2 id="week1-session">{c.session}</h2>
      <p>{c.privateHelp}</p>
      {saved && <FormNotice message={c.sessionSaved} kind="success" />}
      {remote.error && <FormNotice message={c.error} kind="error" />}
      {remote.data ? (
        <SessionEditor
          key={`${week}-${remote.data.session?.version ?? 0}`}
          week={week}
          row={remote.data.session}
          published={remote.data.published}
          onSaved={() => {
            setSaved(true);
            remote.refresh();
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
  week,
  row,
  published,
  onSaved,
}: {
  week: number;
  row: Row<'week1_session'> | null;
  published: boolean;
  onSaved: () => void;
}) {
  const { c, arabic } = useAssignmentCopy();
  const { t } = useTranslation();
  const [topics, setTopics] = useState<SessionTopic[]>((row?.topics as SessionTopic[]) ?? []);
  const [visible, setVisible] = useState(published);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const flight = useRef(false);
  function edit(i: number, key: keyof SessionTopic, value: string | boolean) {
    setTopics((all) => all.map((topic, j) => (i === j ? { ...topic, [key]: value } : topic)));
    setNotice('');
  }
  function move(i: number, offset: number) {
    setTopics((all) => {
      const next = [...all];
      [next[i], next[i + offset]] = [next[i + offset]!, next[i]!];
      return next;
    });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setNotice('');
    const element = e.currentTarget as HTMLFormElement;
    try {
      if (!topics.every((topic) => safeLinks(topic.links))) throw Error();
      requireWrite(
        await client().rpc('save_session_content', {
          p_week: week,
          p_topics: topics as unknown as Json,
          p_published: visible,
          p_version: row?.version ?? 0,
        }),
      );
      await completeFormDraft(element);
      onSaved();
    } catch (e) {
      setNotice(isConflict(e) ? c.error : c.error);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <DraftForm
      draftKey={`session:${week}`}
      baseVersion={String(row?.version ?? 0)}
      extra={{ topics, visible }}
      restoreExtra={(value) => {
        const data = value as { topics?: SessionTopic[]; visible?: boolean };
        if (Array.isArray(data.topics)) setTopics(data.topics);
        if (typeof data.visible === 'boolean') setVisible(data.visible);
      }}
      onSubmit={save}
      aria-busy={busy}
    >
      <fieldset disabled={busy} className="week1-fieldset">
        <label className="portal-check">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          {c.sessionVisibility}
        </label>
        <p className="session-visibility-status" role="status">
          {visible ? c.sessionShown : c.sessionHidden}
          {visible && !topics.some((topic) => topic.visible) && ` ${c.noSelectedTopics}`}
        </p>
        <p role="status">
          {t('assignments.progress', {
            completed: topics.filter((topic) => topic.status === 'completed').length,
            total: topics.length,
          })}
        </p>
        {topics.map((topic, i) => (
          <article className="week1-topic" key={topic.id} data-topic-id={topic.id}>
            <label className="portal-check">
              <input
                type="checkbox"
                checked={topic.status === 'completed'}
                onChange={(e) => edit(i, 'status', e.target.checked ? 'completed' : 'planned')}
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
                    onChange={(e) => edit(i, 'title_en', e.target.value)}
                  />
                </label>
                <label>
                  {c.titleAr}
                  <Input
                    dir="rtl"
                    value={topic.title_ar}
                    required
                    maxLength={200}
                    onChange={(e) => edit(i, 'title_ar', e.target.value)}
                  />
                </label>
              </div>
              <label>
                {c.description}
                <textarea
                  rows={2}
                  maxLength={10000}
                  value={topic.description}
                  onChange={(e) => edit(i, 'description', e.target.value)}
                />
              </label>
              <label>
                {c.usefulLinks}
                <textarea
                  rows={2}
                  maxLength={5000}
                  dir="ltr"
                  value={topic.links}
                  onChange={(e) => edit(i, 'links', e.target.value)}
                />
              </label>
              <label>
                {c.notes}
                <textarea
                  rows={2}
                  maxLength={10000}
                  value={topic.notes}
                  onChange={(e) => edit(i, 'notes', e.target.value)}
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
                  ? visible
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
                  if (window.confirm(c.confirmDelete))
                    setTopics((all) => all.filter((x) => x.id !== topic.id));
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
            onClick={() =>
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
              ])
            }
          >
            {c.addTopic}
          </Button>
          <Button disabled={busy}>{c.save}</Button>
        </div>
      </fieldset>
      <FormNotice message={notice} kind="error" />
    </DraftForm>
  );
}
export function PublicSessionContent({ week }: { week: number }) {
  const auth = useAuth();
  return auth.status === 'signed-in' && auth.role === 'student' ? (
    <PublishedSession week={week} />
  ) : null;
}
function PublishedSession({ week }: { week: number }) {
  const { c, arabic } = useAssignmentCopy();
  const load = useCallback(async () => {
    const result = await client()
      .from('session_public_content')
      .select('*')
      .eq('week_number', week)
      .eq('published', true)
      .maybeSingle();
    requireWrite(result);
    return result.data;
  }, [week]);
  const remote = useRemote(load);
  useWeek1Sync(remote.refresh, 'assignments');
  if (!remote.data) return remote.error ? <FormNotice message={c.error} kind="error" /> : null;
  const topics = remote.data.topics as Omit<SessionTopic, 'notes'>[];
  if (!topics.length) return null;
  return (
    <section className="content-card" id="published-session">
      <h2>{c.publicSession}</h2>
      <div className="session-resources-grid">
        {topics.map((topic) => (
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
          </article>
        ))}
      </div>
    </section>
  );
}
