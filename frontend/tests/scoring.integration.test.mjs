import test from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { scoringFixture } from '../scripts/scoring-test-fixture.mjs';
import { week1TestTarget } from '../scripts/week1-test-target.mjs';
test(
  'real isolated scoring rollover, archives, late reviews, membership, Bingo isolation and independent review connections',
  { skip: process.env.RUN_LOCAL_SUPABASE_TESTS !== '1' },
  async (t) => {
    const f = await scoringFixture();
    t.after(() => f.cleanup());
    const a = await f.account('Sarah'),
      b = await f.account('Khaled'),
      c = await f.account('Ahmad'),
      names = new Set(['Sarah', 'Khaled', 'Ahmad']),
      own = (p) => p.rows.filter((r) => names.has(r.alias));
    const first = await f.assignment('2026-11-19T00:00+03'),
      subs = [];
    for (const [user, points] of [
      [a, 40],
      [b, 30],
      [c, 10],
    ]) {
      const id = await f.submission(user, first);
      subs.push(id);
      await f.review(id, points);
    }
    await f.clock('2026-11-20T00:00+03');
    assert.ok((await f.packet('current')).rows.every((r) => r.points === 0));
    assert.deepEqual(
      own(await f.packet('archive', 1)).map((r) => [r.alias, r.points]),
      [
        ['Sarah', 40],
        ['Khaled', 30],
        ['Ahmad', 10],
      ],
    );
    const second = await f.assignment('2026-11-20T00:00+03');
    for (const [user, points] of [
      [c, 50],
      [b, 20],
      [a, 0],
    ])
      await f.review(await f.submission(user, second), points);
    assert.deepEqual(
      own(await f.packet('all')).map((r) => [r.alias, r.points]),
      [
        ['Ahmad', 60],
        ['Khaled', 50],
        ['Sarah', 40],
      ],
    );
    await f.clock('2026-11-27T00:00+03');
    assert.ok((await f.packet('current')).rows.every((r) => r.points === 0));
    assert.equal((await f.packet('archive', 2)).period.state, 'closed');
    const late = await f.assignment('2026-11-19T15:00+03');
    await f.review(await f.submission(a, late), 5);
    await f.review(subs[0], 38, 1);
    const history = await f.packet('archive', 1);
    assert.equal(history.revision, 3);
    assert.deepEqual(
      own(history).map((r) => [r.alias, r.points, r.original_points]),
      [
        ['Sarah', 43, 40],
        ['Khaled', 30, 30],
        ['Ahmad', 10, 10],
      ],
    );
    assert.deepEqual(
      history.adjustments.filter((r) => names.has(r.alias)).map((r) => r.delta),
      [5, -2],
    );
    const later = await f.account('Late member');
    assert.ok(!(await f.packet('archive', 1)).rows.some((r) => r.alias === later.alias));
    assert.ok(
      (await f.packet('current')).rows.some((r) => r.alias === later.alias && r.points === 0),
    );
    const conns = [
      postgres(week1TestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database'), { max: 1 }),
      postgres(week1TestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database'), { max: 1 }),
    ];
    try {
      const pids = await Promise.all(
        conns.map(async (db) => (await db`select pg_backend_pid() id`)[0].id),
      );
      assert.equal(new Set(pids).size, 2);
      const outcomes = await Promise.allSettled(
        conns.map((db, i) =>
          db.begin(async (tx) => {
            await tx`set local role authenticated`;
            await tx`select set_config('request.jwt.claim.sub',${f.team.id},true)`;
            await tx`select public.review_assignment(${subs[0]},${35 + i},'Concurrent correction',2)`;
          }),
        ),
      );
      assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(outcomes.find((r) => r.status === 'rejected').reason.code, '40001');
    } finally {
      await Promise.all(conns.map((db) => db.end()));
    }
    assert.equal(
      (
        await f.db`select count(*)::int n from public.point_awards where submission_id=${subs[0]}`
      )[0].n,
      1,
    );
    const text = JSON.stringify(await f.packet('archive', 1));
    for (const secret of ['PRIVATE', ...f.users.map((u) => u.id), ...f.users.map((u) => u.email)])
      assert.ok(!text.includes(secret));
    await assert.rejects(
      f.db.begin(async (tx) => {
        await tx`set local role authenticated`;
        await tx`select app_private.scoring_now()`;
      }),
      (e) => e.code === '42501',
    );
    const boardA = await a.api.rpc('week1_start_bingo'),
      boardB = await b.api.rpc('week1_start_bingo');
    assert.ifError(boardA.error);
    assert.ifError(boardB.error);
    const boards = new Map();
    for (const owner of [a, b]) {
      const board = (await owner.api.from('week1_bingo_boards').select('*').single()).data;
      for (const challenge of board.board_order.slice(0, 4)) {
        assert.ifError(
          (
            await owner.api.rpc('week1_mark_bingo', {
              p_challenge: challenge,
              p_completed: true,
              p_version: board.version,
              p_round_id: board.id,
            })
          ).error,
        );
        board.version++;
      }
      assert.ifError((await owner.api.rpc('week1_claim_bingo', { p_round_id: board.id })).error);
      const claim = (
        await owner.api.from('week1_bingo_claims').select('*').eq('round_id', board.id).single()
      ).data;
      assert.ok(claim);
      assert.ifError(
        (
          await f.team.api.rpc('week1_review_bingo', {
            p_id: claim.id,
            p_status: 'rejected',
            p_reason: 'Ignored by organizer.',
          })
        ).error,
      );
      assert.ifError((await owner.api.rpc('week1_play_again', { p_round_id: board.id })).error);
      boards.set(
        owner.id,
        (await owner.api.from('week1_bingo_boards').select('id').is('retired_at', null).single())
          .data.id,
      );
    }
    for (const [owner, other] of [
      [a, b],
      [b, a],
    ]) {
      const rows = await owner.api.from('week1_bingo_boards').select('*');
      assert.ifError(rows.error);
      assert.equal(rows.data.length, 2);
      assert.ok(rows.data.every((row) => row.student_id === owner.id));
      const direct = await owner.api
        .from('week1_bingo_boards')
        .select('*')
        .eq('student_id', other.id);
      assert.deepEqual(direct.data, []);
      const claims = await owner.api
        .from('week1_bingo_claims')
        .select('*')
        .eq('student_id', other.id);
      assert.deepEqual(claims.data, []);
      const ownClaims = await owner.api.from('week1_bingo_claims').select('*');
      assert.equal(ownClaims.data.length, 1);
      assert.ok(ownClaims.data.every((claim) => claim.student_id === owner.id));
      const otherBoard = boards.get(other.id);
      assert.ok((await owner.api.rpc('week1_play_again', { p_round_id: otherBoard })).error);
    }
    console.log(
      'Real Supabase: 40/30/10 -> Week 2 zeros -> All-Time 60/50/40; cutoff originals retained, late adjustments dated; independent connections admit one correction; two students cannot retrieve other boards/history/claims.',
    );
  },
);
