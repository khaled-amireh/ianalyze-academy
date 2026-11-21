import { useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowRight, Search, Users } from 'lucide-react';
import { useAuth } from '@/features/auth/use-auth';
import { PageContainer } from '@/components/shared/page-container';
import { BrandLogo, ParentLogo } from '@/components/layout/brand-logo';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/features/portal/form-feedback';
import { client, useRemote } from '@/features/portal/data';
import { bingoLine, isIgnoredClaim } from './domain';
import { ClaimDetails } from './claim-details';
import { InlineBingoVerification } from './inline-verification';
import { DatasetSubmissions } from './dataset-submissions';
import { isConflict, loadWeek1Student, requireWrite, type StudentWeek1 } from './data';
import { SessionContent, PublicSessionContent } from './session-content';
import { useWeek1Copy } from './copy';
import { BingoBoard } from './bingo-board';
import { NotFoundPage } from '@/pages/public/not-found-page';
import { DatasetActivity, DatasetInstructions } from './dataset-activity';
import { useWeek1Sync } from './use-week1-sync';
import './week1.css';

export function Week1Page() {
  const { c, arabic } = useWeek1Copy();
  const auth = useAuth();
  const { activity } = useParams();
  const validActivity = activity === 'dataset' || activity === 'bingo';
  if (activity && !validActivity) return <NotFoundPage />;
  return (
    <PageContainer className="week1-page" dir={arabic ? 'rtl' : 'ltr'}>
      <nav className="s-actions" aria-label={c.studyPlan}>
        <Link to="/eda">{c.studyPlan}</Link>
        {activity && <Link to="/eda/week-1">{c.back}</Link>}
      </nav>
      <header className="s-page-head">
        <p className="s-eyebrow">{c.studyPlan}</p>
        <h1 id="page-title" tabIndex={-1}>
          {validActivity ? c[activity] : c.title}
        </h1>
        <p>
          <time dateTime="2026-11-19">{c.date}</time> · {c.time}
        </p>
        <p className="s-lede">{c.description}</p>
      </header>
      {!validActivity && (
        <section aria-labelledby="week1-activities-title">
          <h2 id="week1-activities-title" className="mt-8 text-2xl font-extrabold">
            {c.activities}
          </h2>
          <div className="s-cards">
            {(
              [
                { id: 'dataset', Icon: Search },
                { id: 'bingo', Icon: Users },
              ] as const
            ).map(({ id, Icon }) => (
              <article className="s-card week1-activity-card" key={id}>
                <Icon className="s-card-icon" aria-hidden="true" />
                <h2>{c[id]}</h2>
                <p>{id === 'dataset' ? c.datasetSummary : c.bingoSummary}</p>
                <div className="s-actions">
                  <Button asChild>
                    <Link to={`/eda/week-1/${id}`}>
                      {c.openActivity}
                      <ArrowRight aria-hidden="true" className={arabic ? 'rotate-180' : ''} />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {!activity && <PublicSessionContent week={1} />}
      {(validActivity || (auth.status === 'signed-in' && auth.role === 'team')) && (
        <div className="portal-page">
          {validActivity &&
            (auth.status === 'loading' ? (
              <p role="status">{c.loading}</p>
            ) : auth.status === 'signed-in' && auth.user ? (
              <StudentActivity
                key={`${auth.user.id}-${activity}`}
                studentId={auth.user.id}
                activity={activity}
              />
            ) : (
              <>
                {activity === 'bingo' ? <BingoIntro /> : <DatasetInstructions />}
                <Button asChild>
                  <Link to="/login">{c.login}</Link>
                </Button>
              </>
            ))}
          {activity === 'bingo' && <InlineBingoVerification />}
          {activity === 'dataset' && <DatasetSubmissions />}
          {!activity && auth.status === 'signed-in' && auth.role === 'team' && <SessionContent />}
        </div>
      )}
    </PageContainer>
  );
}
function StudentActivity({
  studentId,
  activity,
}: {
  studentId: string;
  activity: 'dataset' | 'bingo';
}) {
  const { c } = useWeek1Copy();
  const load = useCallback(() => loadWeek1Student(studentId, activity), [studentId, activity]);
  const remote = useRemote(load);
  useWeek1Sync(remote.refresh, activity);
  if (!remote.data)
    return (
      <>
        <FormNotice
          message={remote.error ? c.unavailable : c.loading}
          kind={remote.error ? 'error' : 'info'}
        />
      </>
    );
  if (!remote.data.registered)
    return (
      <>
        <FormNotice message={c.registration} />
        <Link to="/profile/edit">{c.profile}</Link>
      </>
    );
  return (
    <>
      {remote.error && <FormNotice message={c.unavailable} kind="error" />}
      {activity === 'dataset' ? (
        <DatasetActivity
          data={remote.data}
          studentId={studentId}
          update={(next) => remote.update(() => next)}
        />
      ) : (
        <BingoGame
          data={remote.data}
          refresh={remote.refresh}
          update={(next) => remote.update(() => next)}
          studentId={studentId}
        />
      )}
    </>
  );
}
function BingoIntro() {
  const { c } = useWeek1Copy();
  return (
    <section className="content-card">
      <div className="week1-logos">
        <BrandLogo />
        <ParentLogo />
      </div>
      <p>{c.bingoIntro}</p>
      <p>{c.boardHelp}</p>
    </section>
  );
}
function BingoGame({
  data,
  refresh,
  update,
  studentId,
}: {
  data: StudentWeek1;
  refresh: () => void;
  update: (data: StudentWeek1) => void;
  studentId: string;
}) {
  const { c, arabic } = useWeek1Copy();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [notice, setNotice] = useState<'error' | 'conflict' | ''>('');
  const board = data.board;
  const order = (board?.board_order ?? []) as number[];
  const completed = (board?.completed ?? []) as number[];
  const line = bingoLine(order, completed);
  const locked =
    data.claim?.status === 'pending' ||
    data.claim?.status === 'verified' ||
    isIgnoredClaim(data.claim);
  const state =
    data.claim?.status === 'verified'
      ? 'verified'
      : data.claim?.status === 'pending'
        ? 'pending'
        : data.claim?.status === 'rejected'
          ? 'rejected'
          : line
            ? 'achieved'
            : board
              ? 'inProgress'
              : 'notStarted';
  async function act(action: 'start' | 'claim' | 'mark' | 'again', id?: number) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice('');
    try {
      const result =
        action === 'start'
          ? await client().rpc('week1_start_bingo')
          : action === 'again'
            ? await client().rpc('week1_play_again', { p_round_id: board!.id })
            : action === 'claim'
              ? await client().rpc('week1_claim_bingo', { p_round_id: board!.id })
              : await client().rpc('week1_mark_bingo', {
                  p_challenge: id!,
                  p_completed: !completed.includes(id!),
                  p_version: board!.version,
                  p_round_id: board!.id,
                });
      requireWrite(result);
      // Await the saved state before accepting another action.
      update(await loadWeek1Student(studentId, 'bingo'));
    } catch (e) {
      setNotice(isConflict(e) ? 'conflict' : 'error');
      refresh();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <BingoIntro />
      <section className="content-card" aria-busy={busy}>
        <p role="status">
          {c.status}: <strong>{isIgnoredClaim(data.claim) ? c.ignored : c.states[state]}</strong>
        </p>
        {!board ? (
          <Button disabled={busy} onClick={() => void act('start')}>
            {c.start}
          </Button>
        ) : (
          <>
            <BingoBoard
              order={order}
              completed={completed}
              challenges={c.challenges}
              label={c.bingo}
              disabled={busy || locked}
              onMark={(id) => void act('mark', id)}
            />
            {line && !locked && (
              <div className="week1-celebration" role="status">
                <strong>✦ {c.achieved} ✦</strong>
                <p>{c.unverified}</p>
              </div>
            )}
            {!locked && (
              <Button disabled={!line || busy} onClick={() => void act('claim')}>
                {c.claim}
              </Button>
            )}
            {data.claim && <ClaimDetails claim={data.claim} />}
            {(data.claim?.status === 'verified' || data.claim?.status === 'rejected') && (
              <div className="portal-actions">
                <Button disabled={busy} onClick={() => void act('again')}>
                  {c.playAgain}
                </Button>
                <p>{c.newRoundHelp}</p>
              </div>
            )}
          </>
        )}
        <FormNotice message={notice ? c[notice] : ''} kind="error" />
      </section>
      {data.previousRounds.length > 0 && (
        <section className="content-card">
          <h2>{c.roundHistory}</h2>
          {data.previousRounds.map(({ board: previous, claims, number }) => (
            <details key={previous.id}>
              <summary>
                {c.round} {new Intl.NumberFormat(arabic ? 'ar-JO' : 'en-GB').format(number)}
              </summary>
              <BingoBoard
                order={previous.board_order as number[]}
                completed={previous.completed as number[]}
                challenges={c.challenges}
                label={c.bingo}
                disabled
                onMark={() => {}}
              />
              {claims.map((claim) => (
                <ClaimDetails key={claim.id} claim={claim} />
              ))}
            </details>
          ))}
        </section>
      )}
    </>
  );
}
