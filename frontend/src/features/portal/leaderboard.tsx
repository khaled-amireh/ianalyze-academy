import { useCallback, useEffect, useRef, useState } from 'react';
import { PageContainer } from '@/components/shared/page-container';
import { Button } from '@/components/ui/button';
import { FormNotice } from './form-feedback';
import { checked, client, useRemote } from './data';
import { useWeek1Sync } from '@/features/week1/use-week1-sync';
import { useAssignmentCopy } from '@/features/assignments/copy';
import '@/features/assignments/assignments.css';
type Ranking = {
  rank: number;
  alias: string;
  points: number;
  activities: number;
  original_rank: number;
  original_points: number;
  adjustment_points: number;
};
type Period = {
  week: number;
  start: string;
  end: string;
  state: 'upcoming' | 'current' | 'closed';
};
type Rankings = {
  view: 'all' | 'current' | 'archive';
  server_time: string;
  period: Period;
  periods: Period[];
  rows: Ranking[];
  revision: number;
  privacy_updates: number;
  adjustments: { alias: string; delta: number; at: string; kind: string }[];
};
export function LiveLeaderboard() {
  const { c, arabic } = useAssignmentCopy();
  const [weekly, setWeekly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [original, setOriginal] = useState(false);
  const [pendingStamp, setPendingStamp] = useState('');
  const view = !weekly ? 'all' : selectedWeek === null ? 'current' : 'archive';
  const load = useCallback(
    async () =>
      checked(
        await client().rpc('academy_rankings', {
          p_view: view,
          ...(selectedWeek === null ? {} : { p_week: selectedWeek }),
        }),
      ) as unknown as Rankings,
    [view, selectedWeek],
  );
  const remote = useRemote(load);
  useWeek1Sync(remote.refresh, 'assignments');
  const refresh = useRef(remote.refresh);
  useEffect(() => {
    refresh.current = remote.refresh;
  }, [remote.refresh]);
  const packet = remote.data;
  const stamp = packet?.server_time;
  const delay = packet
    ? Date.parse(packet.period.state === 'upcoming' ? packet.period.start : packet.period.end) -
      Date.parse(packet.server_time)
    : null;
  useEffect(() => {
    if (!weekly || selectedWeek !== null || delay === null || !stamp) return;
    const timer = window.setTimeout(
      () => {
        setPendingStamp(stamp);
        refresh.current();
      },
      Math.max(0, delay) + 100,
    );
    return () => window.clearTimeout(timer);
  }, [weekly, selectedWeek, delay, stamp]);
  const data =
    packet?.view === view &&
    (view !== 'archive' || packet.period.week === selectedWeek) &&
    packet.server_time !== pendingStamp
      ? packet
      : undefined;
  const rows = data
    ? [...data.rows]
        .map((row) =>
          original && view === 'archive'
            ? { ...row, rank: row.original_rank, points: row.original_points }
            : row,
        )
        .sort((a, b) => a.rank - b.rank)
    : [];
  const number = new Intl.NumberFormat(arabic ? 'ar-JO' : 'en-GB', { maximumFractionDigits: 2 });
  const time = (value: string) =>
    new Intl.DateTimeFormat(arabic ? 'ar-JO' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Amman',
    }).format(new Date(value));
  return (
    <PageContainer className="portal-page" dir={arabic ? 'rtl' : 'ltr'}>
      <h1 id="page-title" tabIndex={-1}>
        {c.leaderboard}
      </h1>
      <div className="portal-actions" role="group" aria-label={c.leaderboard}>
        <Button
          variant={weekly ? 'outline' : 'default'}
          aria-pressed={!weekly}
          onClick={() => {
            setWeekly(false);
            setSelectedWeek(null);
            setOriginal(false);
            setVisibleCount(20);
          }}
        >
          {c.allTime}
        </Button>
        <Button
          variant={weekly ? 'default' : 'outline'}
          aria-pressed={weekly}
          onClick={() => {
            setWeekly(true);
            setSelectedWeek(null);
            setOriginal(false);
            setVisibleCount(20);
          }}
        >
          {c.thisWeek}
        </Button>
      </div>
      {weekly && (
        <label className="ranking-period-selector">
          {c.chooseWeek}
          <select
            name="ranking_period"
            value={selectedWeek ?? 'current'}
            onChange={(event) => {
              setSelectedWeek(event.target.value === 'current' ? null : Number(event.target.value));
              setOriginal(false);
              setVisibleCount(20);
            }}
          >
            <option value="current">{c.currentWeek}</option>
            {(packet?.periods ?? []).map((period) => (
              <option key={period.week} value={period.week}>
                {c.weekLabel} {number.format(period.week)}: {time(period.start)} -{' '}
                {time(period.end)}
              </option>
            ))}
          </select>
        </label>
      )}
      {weekly && data && (
        <section className="s-card ranking-period" aria-label={c.scoringPeriod}>
          <h2>
            {c.weekLabel} {number.format(data.period.week)}
          </h2>
          <p>
            <time dateTime={data.period.start}>{time(data.period.start)}</time> -{' '}
            <time dateTime={data.period.end}>{time(data.period.end)}</time> ({c.timezone})
          </p>
          <p>{c.periodBoundary}</p>
          {data.period.state === 'upcoming' && <p role="status">{c.scoringUpcoming}</p>}
          {view === 'archive' && (
            <>
              <p>
                {c.archiveRevision} {number.format(data.revision)}
              </p>
              <label className="portal-check">
                <input
                  name="archive_original"
                  type="checkbox"
                  checked={original}
                  onChange={(e) => {
                    setOriginal(e.target.checked);
                    setVisibleCount(20);
                  }}
                />
                {c.originalStandings}
              </label>
              <p>{c.archivePolicy}</p>
              {data.privacy_updates > 0 && <p>{c.archivePrivacy}</p>}
              {data.adjustments.length > 0 && (
                <details className="ranking-adjustments">
                  <summary>
                    {c.adjustments} ({number.format(data.adjustments.length)})
                  </summary>
                  <ul>
                    {data.adjustments.map((change, i) => (
                      <li key={i}>
                        <bdi>{change.alias}</bdi>: {number.format(change.delta)} {c.points} -{' '}
                        {time(change.at)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </section>
      )}
      <details>
        <summary>{c.rankingMethod}</summary>
        <p>{c.rankingRules}</p>
      </details>
      {remote.error && <FormNotice message={c.error} kind="error" />}
      {!data ? (
        remote.error ? (
          <Button onClick={remote.refresh}>{c.retry}</Button>
        ) : (
          <p role="status">{c.loading}</p>
        )
      ) : (
        <>
          {!rows.length && <p role="status">{c.noRankings}</p>}
          <div className="ranking-podium">
            {rows.slice(0, 3).map((row) => (
              <article className="s-card" key={row.rank}>
                <p>
                  {c.rank} {number.format(row.rank)}
                </p>
                <h2 dir="auto">{row.alias}</h2>
                <strong>{number.format(row.points)}</strong>
                <p>{c.points}</p>
              </article>
            ))}
          </div>
          {rows.length > 3 && (
            <div className="portal-table" tabIndex={0} role="region" aria-label={c.leaderboard}>
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>{c.rank}</th>
                    <th>{c.name}</th>
                    <th>{c.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(3, 3 + visibleCount).map((row) => (
                    <tr key={row.rank}>
                      <td>{number.format(row.rank)}</td>
                      <td>
                        <bdi>{row.alias}</bdi>
                      </td>
                      <td>{number.format(row.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 3 + visibleCount && (
            <Button variant="outline" onClick={() => setVisibleCount((count) => count + 20)}>
              {c.moreRankings}
            </Button>
          )}
        </>
      )}
    </PageContainer>
  );
}
