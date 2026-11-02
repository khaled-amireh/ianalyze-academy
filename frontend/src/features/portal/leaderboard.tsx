import { PageContainer } from '@/components/shared/page-container';
import { usePortalCopy } from './copy';
import { checked, client, useRemote } from './data';
type Ranking = { rank: number; alias: string; points: number; activities: number };
async function load() {
  return checked(await client().rpc('academy_leaderboard')) as unknown as Ranking[];
}
export function LiveLeaderboard() {
  const { c } = usePortalCopy();
  const { data, error } = useRemote(load);
  return (
    <PageContainer className="portal-page">
      <h1>{c.leaderboard}</h1>
      <p>{c.rules}</p>
      <div className="portal-table">
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
            {data?.map((row) => (
              <tr key={row.rank}>
                <td>{row.rank}</td>
                <td>
                  <bdi>{row.alias}</bdi>
                </td>
                <td>{row.points}</td>
                <td>{row.activities}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p role="status">{error ? c.error : !data ? c.wait : !data.length ? c.noRecords : ''}</p>
    </PageContainer>
  );
}
