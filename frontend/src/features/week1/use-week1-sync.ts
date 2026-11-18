import { useEffect, useRef } from 'react';
type Scope = 'dataset' | 'bingo' | 'assignments';
export function notifyWeek1(scope: Scope) {
  window.dispatchEvent(new CustomEvent('week1-data-changed', { detail: scope }));
}
// One visible-tab interval per view; hidden tabs do no polling. Focus/online
// recovery and confirmed local writes keep views current without Refresh buttons.
export function useWeek1Sync(refresh: () => void, scope: Scope, listenForChanges = false) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);
  useEffect(() => {
    let last = 0;
    const sync = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 1000) return;
      last = Date.now();
      latest.current();
    };
    const changed = (event: Event) => {
      if (
        listenForChanges &&
        (event as CustomEvent).detail === scope &&
        document.visibilityState === 'visible'
      )
        latest.current();
    };
    const timer = window.setInterval(sync, 15000);
    window.addEventListener('focus', sync);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('week1-data-changed', changed);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sync);
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('week1-data-changed', changed);
    };
  }, [scope, listenForChanges]);
}
