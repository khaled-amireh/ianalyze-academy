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
