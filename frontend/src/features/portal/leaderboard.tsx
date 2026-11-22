import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { Medal } from 'lucide-react';
import { PageContainer } from '@/components/shared/page-container';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { usePortalCopy } from './copy';
import { checked, client, useRemote } from './data';
import { weeklyPeriodForDisplay } from './date-time';

type Ranking = {
  rank: number;
  alias: string;
  points: number;
  activities: number;
  is_you?: boolean;
};
type Period = { start: string; end: string; timezone: 'Asia/Amman'; period: number | null };
async function load(weekly: boolean) {
  const db = client();
  const [ranking, period] = await Promise.all([
    db.rpc('academy_leaderboard', { p_weekly: weekly }),
    db.rpc('academy_leaderboard_period'),
  ]);
  if (ranking.error) throw ranking.error;
  return {
    rows: checked(ranking) as unknown as Ranking[],
    period: period.error ? null : (period.data as unknown as Period),
  };
}

export function LiveLeaderboard() {
  const { c, arabic } = usePortalCopy();
  const auth = useAuth();
  const [weekly, setWeekly] = useState(false);
  const loadView = useCallback(() => load(weekly), [weekly]);
  const { data, error } = useRemote(loadView);
  const rows = data?.rows ?? [];
  const topThree = rows.filter((row) => row.rank <= 3);
  const period =
    weekly && data?.period ? weeklyPeriodForDisplay(data.period.start, data.period.end) : null;
  const date = (value: string) =>
    new Intl.DateTimeFormat(arabic ? 'ar-JO' : 'en-GB', {
      dateStyle: 'medium',
      timeZone: 'Asia/Amman',
    }).format(new Date(value));
  return (
    <PageContainer className="portal-page" dir={arabic ? 'rtl' : 'ltr'}>
      <h1 id="page-title" tabIndex={-1}>
        {c.leaderboard}
      </h1>
      <p>{c.rules}</p>
      <div className="portal-actions" role="group" aria-label={c.currentPeriod}>
        <Button
          variant={weekly ? 'outline' : 'default'}
          aria-pressed={!weekly}
          onClick={() => setWeekly(false)}
        >
          {c.allTime}
        </Button>
        <Button
          variant={weekly ? 'default' : 'outline'}
          aria-pressed={weekly}
          onClick={() => setWeekly(true)}
        >
          {c.weekly}
        </Button>
      </div>
      {period && (
        <p className="leaderboard-period">
          {c.currentPeriod}:{' '}
          <bdi dir="ltr">
            {date(period.start)} – {date(period.end)}
          </bdi>
        </p>
      )}
      {topThree.length > 0 && (
        <ol className="leaderboard-podium" aria-label={c.topThree}>
          {topThree.map((row, index) => (
            <li
              key={`${row.rank}:${index}`}
              className={`leaderboard-podium-place leaderboard-place-${row.rank}`}
            >
              <span className="leaderboard-podium-rank">
                <Medal
                  className={`leaderboard-medal leaderboard-medal-${row.rank}`}
                  aria-hidden="true"
                />
                #{row.rank}
              </span>
              <bdi className="leaderboard-podium-name" dir="auto">
                {row.alias}
              </bdi>
              <strong>
                {row.points} {c.points}
              </strong>
              <span>
                {row.activities} {c.activities}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="portal-table" role="region" aria-label={c.leaderboard} tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>{c.rank}</th>
              <th>{c.alias}</th>
              <th>{c.total}</th>
              <th>{c.activities}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.rank}:${index}`} aria-current={row.is_you ? 'true' : undefined}>
                <td>
                  <bdi>#{row.rank}</bdi>
                </td>
                <td>
                  <bdi dir="auto">{row.alias}</bdi>
                  {row.is_you && <span className="leaderboard-you-badge">{c.you}</span>}
                </td>
                <td>{row.points}</td>
                <td>{row.activities}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {auth.role === 'student' && auth.user && !rows.some((row) => row.is_you) && (
        <p className="leaderboard-own-status">
          {c.notRanked} <Link to="/student">{c.profile}</Link>
        </p>
      )}
      <p role="status">{error ? c.error : !data ? c.wait : !rows.length ? c.noRecords : ''}</p>
    </PageContainer>
  );
}
