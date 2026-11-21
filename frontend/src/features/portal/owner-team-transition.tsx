import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { client } from './data';
import { usePortalCopy } from './copy';

export function OwnerTeamTransition() {
  const { arabic } = usePortalCopy();
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await client().rpc('current_user_can_complete_hussein_team_transition');
        if (active && !result.error) setPending(result.data === true);
      } catch {
        // Keep the owner-only control hidden if the check is unavailable.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!pending && !complete && !error) return null;

  const text = {
    title: arabic ? 'تأكيد تعيين الفريق' : 'Complete the approved Team assignment',
    description: arabic
      ? 'سيتم تعيين حساب الطالب المحدد مسبقاً إلى فريق الأكاديمية مرة واحدة.'
      : 'This completes the pre-approved one-time Student-to-Team transition for the exact authorized account.',
    action: arabic ? 'تأكيد التعيين' : 'Confirm Team assignment',
    complete: arabic ? 'اكتمل تعيين الفريق.' : 'The approved Team assignment is complete.',
    error: arabic
      ? 'تعذر إكمال التعيين. تحقق من الحساب أو اطلب من مالك المشروع مراجعة الحالة.'
      : 'The assignment could not be completed. Verify the signed-in account or contact the project owner.',
  };

  async function completeTransition() {
    setBusy(true);
    setError(false);
    try {
      const result = await client().rpc('complete_owner_approved_hussein_team_transition');
      if (result.error) throw result.error;
      setPending(false);
      setComplete(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-card" dir={arabic ? 'rtl' : 'ltr'}>
      <h2>{text.title}</h2>
      {complete ? (
        <p role="status">{text.complete}</p>
      ) : (
        <>
          {pending && <p>{text.description}</p>}
          {pending && (
            <Button type="button" disabled={busy} onClick={() => void completeTransition()}>
              {text.action}
            </Button>
          )}
          {error && <p role="alert">{text.error}</p>}
        </>
      )}
    </section>
  );
}
