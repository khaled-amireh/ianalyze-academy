import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormNotice } from './form-feedback';
import { client } from './data';
import { useAssignmentCopy } from '@/features/assignments/copy';

type Student = { student_id: string; full_name: string; points: number };
type Award = {
  id: string;
  actor_name: string;
  student_id: string;
  student_name: string;
  amount: number;
  reason: string;
  created_at: string;
};

export function AdminPointAwards() {
  const { c, arabic } = useAssignmentCopy();
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [history, setHistory] = useState<Award[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (search = query) => {
      const [found, awards] = await Promise.all([
        client().rpc('admin_search_students', { p_query: search }),
        client().rpc('admin_point_award_history', { p_student: selected?.student_id }),
      ]);
      if (found.error || awards.error) throw new Error('Admin data unavailable');
      setStudents(found.data as Student[]);
      setSelected((current) =>
        current
          ? ((found.data as Student[]).find(
              (student) => student.student_id === current.student_id,
            ) ?? current)
          : null,
      );
      setHistory(awards.data as Award[]);
    },
    [query, selected?.student_id],
  );
  useEffect(() => {
    let active = true;
    void client()
      .rpc('current_academy_is_admin')
      .then(({ data, error }) => {
        if (active && !error && data === true) setIsAdmin(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setTimeout(() => void refresh(query).catch(() => setNotice(c.error)), 200);
    return () => window.clearTimeout(timer);
  }, [isAdmin, c.error, query, refresh]);

  async function award(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || !selected || inFlight.current) return;
    if (!/^[1-9][0-9]{0,14}$/.test(amount)) {
      setNotice(c.awardInvalidAmount);
      return;
    }
    const numericAmount = Number(amount);
    if (numericAmount > 999999999999999 || !Number.isSafeInteger(numericAmount)) {
      setNotice(c.awardInvalidAmount);
      return;
    }
    if (!reason.trim() || reason.trim().length > 1000) {
      setNotice(c.awardInvalidReason);
      return;
    }
    if (
      !window.confirm(
        c.awardConfirm.replace('{student}', selected.full_name).replace('{amount}', amount),
      )
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setNotice('');
    const key = pendingKey ?? crypto.randomUUID();
    setPendingKey(key);
    try {
      const result = await client().rpc('admin_award_points', {
        p_student: selected.student_id,
        p_amount: numericAmount,
        p_reason: reason.trim(),
        p_idempotency_key: key,
      });
      if (result.error) throw result.error;
      setNotice(c.awardSaved);
      setAmount('');
      setReason('');
      setPendingKey(null);
      await refresh();
    } catch {
      setNotice(c.error);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!isAdmin) return null;
  const number = new Intl.NumberFormat(arabic ? 'ar-JO' : 'en-GB', { maximumFractionDigits: 0 });
  return (
    <section
      className="content-card"
      aria-labelledby="admin-awards-title"
      dir={arabic ? 'rtl' : 'ltr'}
    >
      <h2 id="admin-awards-title">{c.manualAwards}</h2>
      <label>
        {c.awardSearch}
        <Input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={150} />
      </label>
      <label>
        {c.awardStudent}
        <select
          value={selected?.student_id ?? ''}
          disabled={busy || pendingKey !== null}
          onChange={(event) =>
            setSelected(
              students.find((student) => student.student_id === event.target.value) ?? null,
            )
          }
        >
          <option value="">{c.awardChooseStudent}</option>
          {students.map((student) => (
            <option key={student.student_id} value={student.student_id}>
              {student.full_name} — {number.format(student.points)}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <p>
          {c.awardCurrentTotal}: {number.format(selected.points)}
        </p>
      )}
      <form onSubmit={award}>
        <label>
          {c.awardAmount}
          <Input
            type="text"
            inputMode="numeric"
            pattern="[1-9][0-9]{0,14}"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setPendingKey(null);
            }}
            disabled={busy || pendingKey !== null}
            required
          />
        </label>
        <label>
          {c.awardReason}
          <Input
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setPendingKey(null);
            }}
            maxLength={1000}
            disabled={busy || pendingKey !== null}
            required
          />
        </label>
        <Button type="submit" disabled={busy || !selected || pendingKey !== null}>
          {busy ? c.loading : c.awardSubmit}
        </Button>
        {pendingKey && !busy && (
          <Button type="submit" variant="outline">
            {c.retry}
          </Button>
        )}
      </form>
      <FormNotice message={notice} kind={notice === c.awardSaved ? 'success' : 'error'} />
      <h3>{c.awardHistory}</h3>
      {!history.length && <p>{c.awardHistoryEmpty}</p>}
      <ul>
        {history.map((award) => (
          <li key={award.id}>
            {award.actor_name} → {award.student_name} — {number.format(award.amount)} —{' '}
            {award.reason} —{' '}
            {new Intl.DateTimeFormat(arabic ? 'ar-JO' : 'en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(award.created_at))}
          </li>
        ))}
      </ul>
    </section>
  );
}
