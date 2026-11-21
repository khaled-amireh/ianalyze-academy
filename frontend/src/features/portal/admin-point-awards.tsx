import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormNotice } from './form-feedback';
import { client } from './data';
import { usePortalCopy } from './copy';

type StudentOption = { id: string; full_name: string | null; email: string | null };
type Award = {
  id: string;
  student_id: string;
  admin_id: string;
  points: number;
  reason: string;
  created_at: string;
};
type PendingAward = { student: string; points: number; reason: string; key: string };

export function AdminPointAwards() {
  const { c, arabic } = usePortalCopy();
  const pending = useRef<PendingAward | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAal2, setHasAal2] = useState(false);
  const [mfaMode, setMfaMode] = useState<'loading' | 'code' | 'enroll' | 'enroll-code'>('loading');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<Award[]>([]);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const access = await client().rpc('current_academy_is_admin');
        if (access.error) throw access.error;
        if (!active || access.data !== true) return;
        setIsAdmin(true);
        const assurance = await client().auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance.error) throw assurance.error;
        if (assurance.data.currentLevel !== 'aal2') {
          const factors = await client().auth.mfa.listFactors();
          if (factors.error) throw factors.error;
          const verifiedTotp = factors.data.totp.find((factor) => factor.status === 'verified');
          if (verifiedTotp) {
            setMfaFactorId(verifiedTotp.id);
            setMfaMode('code');
          } else {
            setMfaMode('enroll');
          }
          return;
        }
        setHasAal2(true);
        const result = await client().rpc('admin_award_students');
        if (result.error) throw result.error;
        if (active) setStudents((result.data ?? []) as unknown as StudentOption[]);
      } catch {
        if (active) setIsAdmin(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function startTotpEnrollment() {
    setMfaBusy(true);
    setMfaError(false);
    try {
      const result = await client().auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Academy Admin',
      });
      if (result.error) throw result.error;
      setMfaFactorId(result.data.id);
      setMfaQrCode(result.data.totp.qr_code);
      setMfaMode('enroll-code');
    } catch {
      setMfaError(true);
    } finally {
      setMfaBusy(false);
    }
  }

  async function verifyAdminMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaFactorId || !/^\d{6,8}$/.test(mfaCode.trim())) {
      setMfaError(true);
      return;
    }
    setMfaBusy(true);
    setMfaError(false);
    try {
      const challenge = await client().auth.mfa.challenge({ factorId: mfaFactorId });
      if (challenge.error) throw challenge.error;
      const verified = await client().auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.data.id,
        code: mfaCode.trim(),
      });
      if (verified.error) throw verified.error;
      setMfaCode('');
      const assurance = await client().auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== 'aal2') throw assurance.error;
      const access = await client().rpc('current_academy_is_admin');
      if (access.error || access.data !== true) throw access.error;
      const result = await client().rpc('admin_award_students');
      if (result.error) throw result.error;
      setStudents((result.data ?? []) as unknown as StudentOption[]);
      setMfaQrCode('');
      setHasAal2(true);
    } catch {
      setMfaCode('');
      setMfaError(true);
    } finally {
      setMfaBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (!isAdmin || !studentId) {
      return () => {
        active = false;
      };
    }
    void (async () => {
      try {
        const result = await client().rpc('admin_award_history', { p_student_id: studentId });
        if (result.error) throw result.error;
        if (active) setHistory((result.data ?? []) as unknown as Award[]);
      } catch {
        if (active) setHistory([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [isAdmin, studentId]);

  if (!isAdmin) return null;
  if (!hasAal2) {
    const title = arabic
      ? '\u062a\u0623\u0643\u064a\u062f \u062c\u0644\u0633\u0629 \u0627\u0644\u0645\u062f\u064a\u0631'
      : 'Verify your Admin session';
    const description = arabic
      ? '\u064a\u0644\u0632\u0645 \u0631\u0645\u0632 \u0645\u062d\u0642\u0642 \u0645\u0646 \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0644\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0633\u0629.'
      : 'A verified authenticator code is required for sensitive Admin actions.';
    const codeLabel = arabic
      ? '\u0631\u0645\u0632 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629'
      : 'Authenticator code';
    const scanHint = arabic
      ? '\u0627\u0645\u0633\u062d \u0631\u0645\u0632 QR \u0628\u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629\u060c \u062b\u0645 \u0623\u062f\u062e\u0644 \u0627\u0644\u0631\u0645\u0632.'
      : 'Scan this QR code with your authenticator app, then enter its code.';
    return (
      <section className="content-card" dir={arabic ? 'rtl' : 'ltr'}>
        <h2>{title}</h2>
        <p>{description}</p>
        {mfaMode === 'loading' && <p>{c.uploading}</p>}
        {mfaMode === 'enroll' && (
          <Button type="button" disabled={mfaBusy} onClick={startTotpEnrollment}>
            {arabic
              ? '\u0625\u0639\u062f\u0627\u062f \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629'
              : 'Set up an authenticator'}
          </Button>
        )}
        {mfaQrCode && (
          <>
            <p>{scanHint}</p>
            <img src={mfaQrCode} alt={scanHint} />
          </>
        )}
        {(mfaMode === 'code' || mfaMode === 'enroll-code') && (
          <form onSubmit={verifyAdminMfa} className="portal-grid">
            <label>
              {codeLabel}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                required
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
              />
            </label>
            <Button disabled={mfaBusy}>
              {mfaBusy
                ? c.uploading
                : arabic
                  ? '\u062a\u062d\u0642\u0642 \u0648\u062a\u0627\u0628\u0639'
                  : 'Verify and continue'}
            </Button>
          </form>
        )}
        {mfaError && (
          <FormNotice
            message={
              arabic
                ? '\u0641\u0634\u0644 \u0627\u0644\u062a\u062d\u0642\u0642. \u062a\u0623\u0643\u062f \u0645\u0646 \u0627\u0644\u0631\u0645\u0632 \u0648\u062d\u0627\u0648\u0644 \u0645\u062c\u062f\u062f\u0627\u064b.'
                : 'Admin verification failed. Check the code and try again.'
            }
            kind="error"
          />
        )}
      </section>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = Number(points);
    const cleanReason = reason.trim();
    if (
      !studentId ||
      !Number.isSafeInteger(count) ||
      count <= 0 ||
      cleanReason.length < 1 ||
      cleanReason.length > 500
    ) {
      setStatus('error');
      return;
    }
    if (
      !pending.current ||
      pending.current.student !== studentId ||
      pending.current.points !== count ||
      pending.current.reason !== cleanReason
    ) {
      pending.current = {
        student: studentId,
        points: count,
        reason: cleanReason,
        key: crypto.randomUUID(),
      };
    }
    setBusy(true);
    setStatus(null);
    try {
      const result = await client().rpc('admin_award_points', {
        p_student_id: studentId,
        p_points: count,
        p_reason: cleanReason,
        p_idempotency_key: pending.current.key,
      });
      if (result.error) throw result.error;
      pending.current = null;
      setStatus('saved');
      setPoints('');
      setReason('');
      try {
        const refreshed = await client().rpc('admin_award_history', { p_student_id: studentId });
        if (!refreshed.error) setHistory((refreshed.data ?? []) as unknown as Award[]);
      } catch {
        // The award was already accepted; a history refresh must never invite a duplicate retry.
      }
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-card" dir={arabic ? 'rtl' : 'ltr'}>
      <h2>{c.adminAwardsTitle}</h2>
      <form onSubmit={submit} aria-busy={busy} className="portal-grid">
        <label>
          {c.adminAwardsStudent}
          <select
            required
            value={studentId}
            onChange={(event) => {
              setStudentId(event.target.value);
              setHistory([]);
            }}
          >
            <option value="">{c.select}</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.full_name || c.notProvided} ({student.email || c.notProvided})
              </option>
            ))}
          </select>
        </label>
        <label>
          {c.adminAwardsPoints}
          <input
            type="number"
            min="1"
            step="1"
            required
            value={points}
            onChange={(event) => setPoints(event.target.value)}
          />
        </label>
        <label>
          {c.adminAwardsReason}
          <textarea
            required
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <Button disabled={busy}>{busy ? c.uploading : c.adminAwardsSubmit}</Button>
      </form>
      <FormNotice
        message={status ? c[status] : ''}
        kind={status === 'saved' ? 'success' : 'error'}
      />
      <h3>{c.adminAwardsHistory}</h3>
      {studentId && history.length === 0 && <p>{c.adminAwardsEmpty}</p>}
      {history.map((award) => (
        <p key={award.id}>
          {award.points} · {award.reason} ·{' '}
          <time dateTime={award.created_at}>{new Date(award.created_at).toLocaleString()}</time>
        </p>
      ))}
    </section>
  );
}
