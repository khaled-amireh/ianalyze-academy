import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { isOwnerTeamTransitionActor } from './owner-team-transition-access';
import { client } from './data';
import { usePortalCopy } from './copy';

type CheckState = 'checking' | 'pending' | 'none' | 'error' | 'complete';

export function OwnerTeamTransition() {
  const auth = useAuth();
  const { arabic } = usePortalCopy();
  const [state, setState] = useState<CheckState>('checking');
  const [busy, setBusy] = useState(true);
  const isOwner = isOwnerTeamTransitionActor(auth);

  const text = {
    title: arabic ? 'تأكيد تعيين الفريق المعتمد من المالك' : 'Owner-approved Team assignment',
    description: arabic
      ? 'يؤكد هذا الإجراء انتقال الحساب المحدد مسبقًا من طالب إلى فريق مرة واحدة.'
      : 'This confirms the single pre-approved Student-to-Team transition for the exact authorized account.',
    pending: arabic
      ? 'يوجد تعيين فريق معتمد من المالك وجاهز للتأكيد.'
      : 'An owner-approved Team assignment is ready for confirmation.',
    none: arabic
      ? 'لا يوجد تعيين فريق معتمد من المالك قيد الانتظار.'
      : 'No owner-approved Team assignment is pending.',
    checking: arabic ? 'جارٍ التحقق من حالة التعيين…' : 'Checking the approved assignment…',
    check: arabic ? 'التحقق من حالة التعيين' : 'Check assignment status',
    action: arabic ? 'تأكيد التعيين' : 'Confirm Team assignment',
    complete: arabic ? 'اكتمل تعيين الفريق المعتمد.' : 'The approved Team assignment is complete.',
    error: arabic
      ? 'تعذر التحقق من حالة التعيين. حاول مرة أخرى لاحقًا.'
      : 'The assignment status could not be verified. Try again later.',
  };

  const check = useCallback(async () => {
    if (!isOwner) return;
    setBusy(true);
    setState('checking');
    try {
      const result = await client().rpc('current_user_can_complete_hussein_team_transition');
      if (result.error) throw result.error;
      setState(result.data === true ? 'pending' : 'none');
    } catch {
      setState('error');
    } finally {
      setBusy(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner) return;
    let active = true;
    void (async () => {
      try {
        const result = await client().rpc('current_user_can_complete_hussein_team_transition');
        if (result.error) throw result.error;
        if (active) setState(result.data === true ? 'pending' : 'none');
      } catch {
        if (active) setState('error');
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isOwner]);

  if (!isOwner) return null;

  async function completeTransition() {
    if (state !== 'pending' || busy) return;
    setBusy(true);
    setState('checking');
    try {
      const result = await client().rpc('complete_owner_approved_hussein_team_transition');
      if (result.error) throw result.error;
      setState('complete');
    } catch {
      setState('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-card" dir={arabic ? 'rtl' : 'ltr'}>
      <h2>{text.title}</h2>
      {state === 'pending' && <p>{text.description}</p>}
      {state === 'checking' && <p role="status">{text.checking}</p>}
      {state === 'none' && <p role="status">{text.none}</p>}
      {state === 'complete' && <p role="status">{text.complete}</p>}
      {state === 'error' && <p role="alert">{text.error}</p>}
      {state === 'pending' ? (
        <Button type="button" disabled={busy} onClick={() => void completeTransition()}>
          {text.action}
        </Button>
      ) : (
        <Button type="button" variant="outline" disabled={busy} onClick={() => void check()}>
          {text.check}
        </Button>
      )}
    </section>
  );
}
