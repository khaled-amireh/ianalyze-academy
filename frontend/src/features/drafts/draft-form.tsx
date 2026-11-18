import { controllers, hasLocalFormDraft } from './bridge';
import './drafts.css';
import { useEffect, useRef, useState, type ComponentProps, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/use-auth';
import { client } from '@/features/portal/data';
import { Button } from '@/components/ui/button';
import type { Json } from '@/types/database';
import { captureFields, restoreFields, draftEqual, type FormPayload } from './fields';
import { cacheKey, readCache, writeCache } from './cache';
type Props = ComponentProps<'form'> & {
  draftKey: string;
  baseVersion: string;
  persist?: boolean;
  extra?: Json;
  restoreExtra?: (value: Json) => void;
};
type State = 'loading' | 'ready' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict';
export function DraftForm(props: Props) {
  const auth = useAuth();
  if (props.persist === false || auth.status !== 'signed-in' || !auth.user)
    return <form {...plain(props)} />;
  return (
    <OwnedDraftForm
      key={auth.user.id + ':' + props.draftKey + ':' + props.baseVersion}
      {...props}
      owner={auth.user.id}
    />
  );
}
function plain({
  draftKey: _key,
  baseVersion: _base,
  extra: _extra,
  restoreExtra: _restore,
  persist: _persist,
  ...props
}: Props) {
  void _key;
  void _base;
  void _extra;
  void _restore;
  void _persist;
  return props;
}
function OwnedDraftForm({
  draftKey,
  baseVersion,
  extra = null,
  restoreExtra,
  onSubmit,
  onChange,
  ref: externalRef,
  persist: _persist,
  ...props
}: Props & { owner: string }) {
  void _persist;
  const { owner, ...formProps } = props;
  const { t } = useTranslation();
  const form = useRef<HTMLFormElement>(null);
  const latest = useRef({ extra, restoreExtra, t });
  const [state, setState] = useState<State>('loading');
  const [hasWork, setHasWork] = useState(false);
  const [reselected, setReselected] = useState(false);
  const control = useRef<{ change: () => void; discard: () => Promise<void> } | null>(null);
  useEffect(() => {
    latest.current = { extra, restoreExtra, t };
  });
  useEffect(() => {
    const element = form.current!;
    let active = true,
      ready = false,
      stopped = false,
      blocked = false,
      restoring = false,
      revision = 0,
      generation = 0,
      dirty = false,
      secret: CryptoKey | undefined,
      timer: number | undefined;
    let baseline = '',
      pending = Promise.resolve(),
      local = Promise.resolve();
    let lastPayload: FormPayload | undefined;
    const id = owner + ':' + draftKey;
    const defaults = JSON.parse(JSON.stringify(latest.current.extra)) as Json;
    const defaultFields = captureFields(element, defaults).fields;
    let cachedGeneration = 0;
    const flag = (open: boolean) => {
      try {
        localStorage.setItem('ianalyze.draft-open.' + id, String(open));
      } catch {
        /* This flag contains no form values. */
      }
    };
    const status = (value: State) => {
      if (active) setState(value);
    };
    const remember = (payload: unknown) => {
      local = local
        .catch(() => {})
        .then(async () => {
          if (!secret) throw Error('Recovery unavailable');
          await writeCache(id, secret, payload);
        });
      return local;
    };
    async function open() {
      const result = await client().rpc('open_form_draft', {
        p_owner: owner,
        p_form: draftKey,
        p_base: baseVersion,
      });
      if (result.error) throw result.error;
      return result.data as unknown as {
        draft: { payload: Partial<FormPayload>; base_version: string; revision: number };
        cache_key: string;
      };
    }
    async function write(payload: Json, base = baseVersion) {
      const result = await client().rpc('write_form_draft', {
        p_owner: owner,
        p_form: draftKey,
        p_base: base,
        p_payload: payload,
        p_revision: revision,
      });
      if (result.error) throw result.error;
      revision = result.data!;
    }
    async function apply(payload: FormPayload) {
      restoring = true;
      latest.current.restoreExtra?.(payload.extra);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (!active) return;
      restoreFields(element, payload.fields);
      setReselected(payload.fileSelected);
      restoring = false;
    }
    function changed() {
      if (!ready || stopped || blocked || restoring) return;
      const payload = captureFields(element, latest.current.extra);
      const encoded = JSON.stringify(payload);
      if (encoded === baseline) return;
      baseline = encoded;
      lastPayload = payload;
      dirty = true;
      if (payload.fileSelected) setReselected(false);
      const version = ++generation;
      setHasWork(true);
      flag(true);
      status('saving');
      void remember({ payload, base: baseVersion, revision, pending: true })
        .then(() => {
          cachedGeneration = version;
          if (!navigator.onLine) status('offline');
        })
        .catch(() => status('error'));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => flush(payload, version), 700);
    }
    function flush(payload = lastPayload, version = generation) {
      if (!payload || stopped || blocked) return;
      pending = pending
        .catch(() => {})
        .then(async () => {
          if (stopped || blocked) return;
          try {
            await write(payload as unknown as Json);
            if (version === generation) {
              dirty = false;
              await remember({ payload, base: baseVersion, revision, pending: false }).catch(
                () => {},
              );
              status('saved');
            }
          } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === '40001') {
              blocked = true;
              status('conflict');
            } else status(!navigator.onLine && cachedGeneration >= version ? 'offline' : 'error');
          }
        });
    }
    async function start() {
      try {
        const result = await open();
        if (!active) return;
        revision = result.draft.revision;
        secret = await cacheKey(result.cache_key);
        let cached;
        try {
          cached = await readCache(id, secret);
        } catch {
          /* Server persistence still works if browser storage is blocked. */
        }
        let payload = result.draft.payload as FormPayload;
        const has = (value: unknown): value is FormPayload =>
          !!value && typeof value === 'object' && 'fields' in value;
        if (cached?.complete) {
          if (draftEqual(result.draft.payload, cached.original)) {
            try {
              await write({});
              payload = {} as FormPayload;
            } catch {
              /* A concurrent draft is never cleared without matching its revision. */
            }
          }
        } else if (cached?.pending && has(cached.payload)) {
          payload = cached.payload;
          if (cached.base === baseVersion && draftEqual(cached.payload, result.draft.payload))
            cached.pending = false;
          else if (cached.base !== baseVersion || cached.revision !== revision) {
            blocked = true;
            status('conflict');
          }
        }
        if (has(payload)) {
          setHasWork(true);
          if (result.draft.base_version !== baseVersion) {
            blocked = true;
            status('conflict');
          }
          await apply(payload);
        }
        if (!active) return;
        ready = true;
        baseline = JSON.stringify(captureFields(element, latest.current.extra));
        lastPayload = has(payload) ? payload : undefined;
        if (!blocked) {
          status(has(payload) ? 'saved' : 'ready');
          if (cached?.pending && has(payload)) {
            baseline = '';
            changed();
          }
        }
      } catch {
        if (active) {
          status('error');
          ready = true;
        }
      }
    }
    async function complete() {
      stopped = true;
      flag(false);
      window.clearTimeout(timer);
      await pending.catch(() => {});
      await remember({
        complete: true,
        original: lastPayload ?? captureFields(element, latest.current.extra),
        base: baseVersion,
        revision,
        pending: true,
      }).catch(() => {});
      try {
        await write({});
        await remember({ complete: true, base: baseVersion, revision, pending: false }).catch(
          () => {},
        );
      } catch {
        /* Final persistence already succeeded; stale drafts cannot overwrite the confirmed source record. */
      }
    }
    async function discard() {
      if (!window.confirm(latest.current.t('drafts.confirmDiscard'))) return;
      window.clearTimeout(timer);
      await pending.catch(() => {});
      try {
        await write({});
        await remember({ complete: true, base: baseVersion, revision, pending: false }).catch(
          () => {},
        );
        blocked = false;
        stopped = false;
        flag(false);
        setHasWork(false);
        restoring = true;
        element.reset();
        latest.current.restoreExtra?.(defaults);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        // Native reset alone cannot restore React-controlled fields: React
        // updates their DOM defaultValue as the user types. Restore the source
        // values through the same input events used for draft recovery.
        restoreFields(element, defaultFields);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        restoring = false;
        lastPayload = undefined;
        baseline = JSON.stringify(captureFields(element, latest.current.extra));
        setReselected(false);
        status('ready');
      } catch {
        status('conflict');
      }
    }
    controllers.set(element, { complete });
    control.current = { change: changed, discard };
    const recover = () => {
      if (!ready || !secret) {
        void start();
        return;
      }
      if (lastPayload && dirty && !blocked) flush();
    };
    const leave = () => {
      if (lastPayload && dirty && !stopped && !blocked) flush();
    };
    let started = false;
    const details: HTMLDetailsElement[] = [];
    for (let parent = element.parentElement; parent; parent = parent.parentElement)
      if (parent instanceof HTMLDetailsElement) details.push(parent);
    const begin = () => {
      if (started || details.some((detail) => !detail.open)) return;
      started = true;
      void start();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) begin();
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    if (hasLocalFormDraft(owner, draftKey)) begin();
    details.forEach((detail) => detail.addEventListener('toggle', begin));
    element.addEventListener('focusin', begin);
    window.addEventListener('online', recover);
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', leave);
    return () => {
      window.clearTimeout(timer);
      leave();
      active = false;
      observer.disconnect();
      details.forEach((detail) => detail.removeEventListener('toggle', begin));
      element.removeEventListener('focusin', begin);
      control.current = null;
      controllers.delete(element);
      window.removeEventListener('online', recover);
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', leave);
    };
  }, [owner, draftKey, baseVersion]);
  const extraEncoded = JSON.stringify(extra);
  useEffect(() => {
    control.current?.change();
  }, [extraEncoded]);
  function submit(event: SubmitEvent<HTMLFormElement>) {
    if (state === 'loading' || state === 'conflict') {
      event.preventDefault();
      return;
    }
    onSubmit?.(event);
  }
  return (
    <>
      <div className="form-draft-status" role="status" aria-live="polite">
        <small>{state === 'ready' ? '' : t(`drafts.${state}`)}</small>
        {reselected && <small>{t('drafts.reselectFile')}</small>}
        {hasWork && (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => void control.current?.discard()}
          >
            {t('drafts.discard')}
          </Button>
        )}
      </div>
      <form
        {...formProps}
        ref={(node) => {
          form.current = node;
          if (typeof externalRef === 'function') externalRef(node);
          else if (externalRef) externalRef.current = node;
        }}
        onSubmit={submit}
        onChange={(event) => {
          onChange?.(event);
          control.current?.change();
        }}
        data-draft-state={state}
        inert={state === 'loading' || state === 'conflict'}
      />
    </>
  );
}
