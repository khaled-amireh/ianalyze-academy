import { useCallback, useEffect, useRef, useState } from 'react';
import { Expand, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/** One persistent iframe: changing viewing mode never moves or recreates the player. */
export function DriveVideo({ src, title }: { src: string; title: string }) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const nativeSession = useRef(false);
  const [expanded, setExpanded] = useState(false);

  const restoreInline = useCallback(() => {
    const element = dialog.current;
    if (!element?.isConnected || !element.matches(':modal')) return;
    nativeSession.current = false;
    // Switch the existing dialog back to modeless display without remounting its iframe.
    element.close();
    element.show();
    setExpanded(false);
  }, []);

  async function close() {
    if (document.fullscreenElement && viewport.current?.contains(document.fullscreenElement)) {
      try {
        await document.exitFullscreen();
      } catch {
        // The browser may already have exited fullscreen (for example through Escape).
      }
    }
    restoreInline();
  }

  function expand() {
    const element = dialog.current;
    const player = viewport.current;
    if (!element || !player || element.matches(':modal')) return;
    element.close();
    element.showModal();
    setExpanded(true);
    // The modal is already a useful fallback if the API is absent or the request is denied.
    // Request the child viewport: the Fullscreen API does not accept a dialog element.
    if (player.requestFullscreen && document.fullscreenEnabled) {
      void player.requestFullscreen().catch(() => {
        /* Keep the same player enlarged in the modal. */
      });
    }
  }

  useEffect(() => {
    const changed = () => {
      if (document.fullscreenElement && viewport.current?.contains(document.fullscreenElement)) {
        nativeSession.current = true;
      } else if (nativeSession.current && !document.fullscreenElement) {
        restoreInline();
      }
    };
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, [restoreInline]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    const scrollTop = window.scrollY;
    const returnFocus = trigger.current;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.scrollTo({ top: scrollTop, behavior: 'instant' });
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [expanded]);

  return (
    <>
      <dialog
        ref={dialog}
        open
        className="drive-video"
        aria-label={title}
        aria-modal={expanded || undefined}
        onCancel={(event) => {
          event.preventDefault();
          void close();
        }}
        onKeyDown={(event) => {
          if (expanded && event.key === 'Escape') {
            event.preventDefault();
            void close();
          }
          if (
            expanded &&
            event.key === 'Tab' &&
            event.shiftKey &&
            event.target === closeButton.current
          ) {
            event.preventDefault();
            iframe.current?.focus();
          }
        }}
      >
        <div ref={viewport} className="drive-video-viewport">
          <div className="drive-video-toolbar" hidden={!expanded}>
            <h3 className="resource-copy">{title}</h3>
            <Button ref={closeButton} variant="outline" size="sm" onClick={() => void close()}>
              <X aria-hidden="true" />
              {t('learning.closeVideo')}
            </Button>
          </div>
          <div className="drive-video-stage">
            <div className="s-video-frame">
              <iframe
                ref={iframe}
                src={src}
                title={title}
                loading="lazy"
                allow="fullscreen; encrypted-media"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </div>
        </div>
      </dialog>
      <Button
        ref={trigger}
        variant="outline"
        size="sm"
        className="drive-video-expand"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onClick={expand}
      >
        <Expand aria-hidden="true" />
        {t('learning.expandVideo')}
      </Button>
    </>
  );
}
