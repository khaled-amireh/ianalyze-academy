import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, asUser, migrations } from '../scripts/database-fixture.mjs';
const A = '00000000-0000-4000-8000-000000000101',
  B = '00000000-0000-4000-8000-000000000102',
  T = '00000000-0000-4000-8000-000000000103',
  O = '00000000-0000-4000-8000-000000000104',
  U = '00000000-0000-4000-8000-000000000105';
const payload = {
  title: 'Football',
  url: 'https://www.kaggle.com/datasets/example/football',
  topic: 'Sport',
  description: 'Match results',
  column1: 'team',
  column2: 'goals',
  column3: 'date',
  question: 'Which team scored the most?',
  status: 'submitted',
};
async function setup(t) {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'a@example.test',now()),($2,'b@example.test',now()),($3,'leader@example.test',now()),($4,'organizer@example.test',now()),($5,'unverified@example.test',null)",
    [A, B, T, O, U],
  );
  await db.query(
    "update app_private.user_roles set role='team',grant_reason='Local test only' where user_id in ($1,$2)",
    [T, O],
  );
  const q = (id, sql, args = []) => asUser(db, id, () => db.query(sql, args));
  for (const id of [A, B, T, O]) {
    await q(
      id,
      "update public.profiles set full_name='Week1 Test',whatsapp='+962790000001',major='Software Engineering',university='Another University',academic_year=2,python_experience='none' where id=$1",
      [id],
    );
    await q(id, "select public.complete_registration('registration-v1')");
  }
  return { db, q };
}
const denied = (e) => e.code === '42501';
test('dataset attempt migration preserves submitted and draft data without resetting timestamps', async (t) => {
  const all = migrations(),
    idx = all.findIndex((sql) => sql.includes('-- Dataset attempts only.'));
  const db = await createDatabase(all.slice(0, idx));
  t.after(() => db.close());
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'legacy-a@example.test',now()),($2,'legacy-b@example.test',now())",
    [A, B],
  );
  for (const id of [A, B])
    await db.query(
      "insert into public.week1_datasets(student_id,title,url,topic,description,column1,column2,column3,question,status,submitted_at) values($1,'Football','https://www.kaggle.com/datasets/a/b','Sport','Legacy description','a','b','c','Legacy question',$2,case when $2='submitted' then now() end)",
      [id, id === A ? 'submitted' : 'draft'],
    );
  const before = (
    await db.query('select to_jsonb(t) as data from public.week1_datasets t order by student_id')
  ).rows;
  await db.exec(all[idx]);
  assert.deepEqual(
    (
      await db.query(
        "select to_jsonb(t)-'id' as data from public.week1_datasets t order by student_id",
      )
    ).rows,
    before,
  );
  assert.equal(
    (await db.query('select count(distinct id)::int as n from public.week1_datasets')).rows[0].n,
    2,
  );
});
test('dataset attempts are immutable, idempotent, owner-scoped and exclude drafts from submitted statistics', async (t) => {
  const { q } = await setup(t);
  const first = (await q(A, 'select public.week1_save_dataset($1,0) as id', [payload])).rows[0].id;
  const snapshot = (await q(A, 'select * from public.week1_datasets where id=$1', [first])).rows[0];
  assert.equal(
    (await q(A, 'select public.week1_save_dataset($1,0) as id', [payload])).rows[0].id,
    first,
  );
  assert.deepEqual(
    (await q(A, 'select * from public.week1_datasets where id=$1', [first])).rows[0],
    snapshot,
  );
  await assert.rejects(
    q(A, 'select public.week1_save_dataset($1,1,$2)', [{ ...payload, title: 'Overwrite' }, first]),
    denied,
  );
  const draft = (await q(A, 'select public.week1_start_dataset_attempt($1) as id', [first])).rows[0]
    .id;
  assert.notEqual(draft, first);
  assert.equal(
    (await q(A, 'select public.week1_start_dataset_attempt($1) as id', [first])).rows[0].id,
    draft,
  );
  assert.equal(
    (await q(A, 'select * from public.week1_datasets where id=$1', [draft])).rows[0].title,
    '',
  );
  await assert.rejects(q(B, 'select public.week1_save_dataset($1,1,$2)', [payload, draft]), denied);
  await assert.rejects(q(B, 'select public.week1_start_dataset_attempt($1)', [first]), denied);
  await q(A, 'select public.week1_save_dataset($1,1,$2)', [{ ...payload, title: 'Second' }, draft]);
  await q(A, 'select public.week1_start_dataset_attempt($1)', [draft]);
  await q(B, 'select public.week1_save_dataset($1,0)', [payload]);
  const stats = (
    await q(
      T,
      "select count(*)::int as total,count(distinct student_id)::int as students from public.week1_datasets where status='submitted'",
    )
  ).rows[0];
  assert.deepEqual(stats, { total: 3, students: 2 });
  assert.equal((await q(T, 'select * from public.week1_datasets')).rows.length, 4);
  assert.equal(
    (await q(B, 'select * from public.week1_datasets where student_id=$1', [A])).rows.length,
    0,
  );
  await assert.rejects(q(U, 'select public.week1_start_dataset_attempt(null)'), denied);
});
test('round migration preserves existing board progress and verified claim history', async (t) => {
  const all = migrations(),
    roundIndex = all.findIndex((sql) =>
      sql.includes('create unique index week1_bingo_current_round'),
    ),
    db = await createDatabase(all.slice(0, roundIndex));
  t.after(() => db.close());
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'legacy@example.test',now()),($2,'reviewer@example.test',now())",
    [A, T],
  );
  await db.query(
    "insert into public.week1_bingo_boards(student_id,board_order,completed) values($1,'[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]','[0,1,2,3]')",
    [A],
  );
  await db.query(
    "insert into public.week1_bingo_claims(student_id,board_snapshot,completed_snapshot,winning_line,challenges,status,reviewed_by,reviewed_at) select student_id,board_order,completed,'[0,1,2,3]','[0,1,2,3]','verified',$2,now() from public.week1_bingo_boards where student_id=$1",
    [A, T],
  );
  const before = (await db.query('select * from public.week1_bingo_claims')).rows[0];
  await db.exec(all[roundIndex]);
  const { round_id, ...after } = (await db.query('select * from public.week1_bingo_claims'))
    .rows[0];
  assert.deepEqual(after, before);
  const board = (await db.query('select * from public.week1_bingo_boards')).rows[0];
  assert.equal(round_id, board.id);
  assert.deepEqual(board.completed, [0, 1, 2, 3]);
  assert.equal(board.retired_at, null);
});

test('multiple rounds retain verification history, block pending restarts and protect ownership', async (t) => {
  const { q } = await setup(t);
  await q(A, 'select public.week1_start_bingo()');
  let board = (await q(A, 'select * from public.week1_bingo_boards where retired_at is null'))
    .rows[0];
  await assert.rejects(q(A, 'select public.week1_play_again($1)', [board.id]), denied);
  for (let i = 0; i < 4; i++)
    await q(A, 'select public.week1_mark_bingo($1,true,$2,$3)', [
      board.board_order[i],
      i + 1,
      board.id,
    ]);
  await q(A, 'select public.week1_claim_bingo($1)', [board.id]);
  const claim = (await q(A, 'select * from public.week1_bingo_claims')).rows[0];
  assert.equal((await q(T, 'select * from public.week1_bingo_claims')).rows.length, 1);
  assert.equal((await q(B, 'select * from public.week1_bingo_claims')).rows.length, 0);
  await assert.rejects(q(A, 'select public.week1_play_again($1)', [board.id]), denied);
  await q(T, "select public.week1_review_bingo($1,'verified','')", [claim.id]);
  const verified = (await q(A, 'select * from public.week1_bingo_claims')).rows[0];
  await q(A, 'select public.week1_play_again($1)', [board.id]);
  const next = (await q(A, 'select * from public.week1_bingo_boards where retired_at is null'))
    .rows[0];
  assert.notEqual(next.id, board.id);
  assert.notDeepEqual(next.board_order, board.board_order);
  assert.deepEqual(next.completed, []);
  assert.deepEqual(
    (await q(A, 'select * from public.week1_bingo_claims where id=$1', [claim.id])).rows[0],
    verified,
  );
  await assert.rejects(
    q(A, 'select public.week1_play_again($1)', [board.id]),
    (e) => e.code === '40001',
  );
  await assert.rejects(
    q(A, 'select public.week1_mark_bingo(0,true,1,$1)', [board.id]),
    (e) => e.code === '40001',
  );
  await assert.rejects(q(B, 'select public.week1_claim_bingo($1)', [next.id]));
  for (let i = 0; i < 4; i++)
    await q(A, 'select public.week1_mark_bingo($1,true,$2,$3)', [
      next.board_order[i],
      i + 1,
      next.id,
    ]);
  await q(A, 'select public.week1_claim_bingo($1)', [next.id]);
  const second = (await q(T, "select * from public.week1_bingo_claims where status='pending'"))
    .rows[0];
  assert.equal(second.round_id, next.id);
  await q(O, "select public.week1_review_bingo($1,'rejected','Try a fresh round')", [second.id]);
  await q(A, 'select public.week1_play_again($1)', [next.id]);
  assert.equal((await q(A, 'select * from public.week1_bingo_boards')).rows.length, 3);
  assert.equal(
    (await q(A, 'select * from public.week1_bingo_boards where retired_at is null')).rows.length,
    1,
  );
  assert.equal((await q(T, 'select * from public.week1_bingo_claims')).rows.length, 2);
  assert.equal((await q(B, 'select * from public.week1_bingo_claims')).rows.length, 0);
});
test('dataset validation, unique student ownership, stale updates, organizer review, no direct writes', async (t) => {
  const { q } = await setup(t);
  for (const field of Object.keys(payload)) {
    if (field === 'status') continue;
    await assert.rejects(
      q(A, 'select public.week1_save_dataset($1,0)', [{ ...payload, [field]: '' }]),
    );
  }
  for (const url of [
    'https://kaggle.com.evil.test/datasets/a/b',
    'http://kaggle.com/datasets/a/b',
    'https://kaggle.com/datasets',
    'https://user@kaggle.com/datasets/a/b',
  ])
    await assert.rejects(q(A, 'select public.week1_save_dataset($1,0)', [{ ...payload, url }]));
  await q(A, 'select public.week1_save_dataset($1,0)', [payload]);
  assert.equal((await q(A, 'select * from public.week1_datasets')).rows[0].title, 'Football');
  assert.equal((await q(B, 'select * from public.week1_datasets')).rows.length, 0);
  for (const id of [T, O])
    assert.equal((await q(id, 'select * from public.week1_datasets')).rows.length, 1);
  await q(B, 'select public.week1_save_dataset($1,0)', [{ ...payload, title: 'Other student' }]);
  await assert.rejects(
    q(A, 'select public.week1_save_dataset($1,1)', [
      { ...payload, title: 'Forbidden edit', status: 'draft' },
    ]),
    denied,
  );
  const original = (await q(A, 'select * from public.week1_datasets')).rows[0];
  const id = (await q(A, 'select public.week1_start_dataset_attempt($1) as id', [original.id]))
    .rows[0].id;
  await q(A, 'select public.week1_save_dataset($1,1,$2)', [
    { ...payload, title: 'Editable draft', status: 'draft' },
    id,
  ]);
  await assert.rejects(
    q(A, 'select public.week1_save_dataset($1,1,$2)', [payload, id]),
    (e) => e.code === '40001',
  );
  const rows = (await q(T, 'select * from public.week1_datasets')).rows;
  assert.equal(rows.length, 3);
  assert.equal(rows.find((x) => x.student_id === B).title, 'Other student');
  await assert.rejects(q(A, 'update public.week1_datasets set student_id=$1', [B]), denied);
  await assert.rejects(q(U, 'select public.week1_save_dataset($1,0)', [payload]), denied);
});
test('server creates one immutable random board, persists progress, checks all 10 winning lines and snapshots', async (t) => {
  const { q } = await setup(t);
  await q(A, 'select public.week1_start_bingo()');
  let board = (await q(A, 'select * from public.week1_bingo_boards')).rows[0];
  const original = board.board_order;
  assert.deepEqual(
    [...original].sort((a, b) => a - b),
    Array.from({ length: 16 }, (_, i) => i),
  );
  await q(A, 'select public.week1_start_bingo()');
  assert.deepEqual(
    (await q(A, 'select * from public.week1_bingo_boards')).rows[0].board_order,
    original,
  );
  await q(B, 'select public.week1_start_bingo()');
  assert.equal((await q(A, 'select * from public.week1_bingo_boards')).rows.length, 1);
  assert.equal((await q(T, 'select * from public.week1_bingo_boards')).rows.length, 2);
  const otherBoard = (await q(B, 'select * from public.week1_bingo_boards')).rows[0];
  assert.notDeepEqual(otherBoard.board_order, original);
  await assert.rejects(q(A, 'select public.week1_claim_bingo()'), (e) => e.code === '22023');
  await assert.rejects(
    q(A, 'select public.week1_mark_bingo(16,true,1)'),
    (e) => e.code === '22023',
  );
  const lines = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
    [0, 4, 8, 12],
    [1, 5, 9, 13],
    [2, 6, 10, 14],
    [3, 7, 11, 15],
    [0, 5, 10, 15],
    [3, 6, 9, 12],
  ];
  for (const line of lines) {
    board = (await q(A, 'select * from public.week1_bingo_boards')).rows[0];
    for (const id of board.completed) {
      await q(A, 'select public.week1_mark_bingo($1,false,$2)', [id, board.version]);
      board.version++;
    }
    for (const pos of line) {
      await q(A, 'select public.week1_mark_bingo($1,true,$2)', [original[pos], board.version]);
      board.version++;
    }
    await q(A, 'select public.week1_claim_bingo()');
    const claim = (await q(A, "select * from public.week1_bingo_claims where status='pending'"))
      .rows[0];
    assert.deepEqual(claim.winning_line, line);
    assert.deepEqual(
      claim.challenges,
      line.map((i) => original[i]),
    );
    assert.deepEqual(claim.board_snapshot, original);
    assert.equal(claim.completed_snapshot.length, 4);
    assert.match(claim.reference, /^W1-/);
    await assert.rejects(q(A, 'select public.week1_claim_bingo()'), (e) => e.code === '23505');
    await assert.rejects(
      q(A, 'select public.week1_mark_bingo(0,false,$1)', [board.version]),
      denied,
    );
    await q(
      T,
      "select public.week1_review_bingo($1,'rejected','Please confirm the four challenges')",
      [claim.id],
    );
  }
  assert.equal((await q(B, 'select * from public.week1_bingo_claims')).rows.length, 0);
  const history = (await q(A, 'select * from public.week1_bingo_claims order by created_at,id'))
    .rows;
  assert.equal(history.length, 10);
  for (const claim of history) {
    assert.deepEqual(claim.board_snapshot, original);
    assert.deepEqual(
      claim.challenges,
      claim.winning_line.map((pos) => original[pos]),
    );
    assert.ok(claim.challenges.every((id) => claim.completed_snapshot.includes(id)));
  }
  await assert.rejects(q(A, "update public.week1_bingo_boards set board_order='[]'"), denied);
});
test('verification authorization, rejection reason, resubmission, immutable verified wins and conflicting reviews', async (t) => {
  const { q, db } = await setup(t);
  await q(A, 'select public.week1_start_bingo()');
  const board = (await q(A, 'select * from public.week1_bingo_boards')).rows[0];
  for (let i = 0; i < 4; i++)
    await q(A, 'select public.week1_mark_bingo($1,true,$2)', [board.board_order[i], i + 1]);
  await q(A, 'select public.week1_claim_bingo()');
  let claim = (await q(A, 'select * from public.week1_bingo_claims')).rows[0];
  await assert.rejects(
    q(A, "select public.week1_review_bingo($1,'verified','')", [claim.id]),
    denied,
  );
  await assert.rejects(
    q(T, "select public.week1_review_bingo($1,'rejected','   ')", [claim.id]),
    (e) => e.code === '22023',
  );
  await q(O, "select public.week1_review_bingo($1,'rejected','Confirm photos in person')", [
    claim.id,
  ]);
  claim = (await q(A, 'select * from public.week1_bingo_claims')).rows[0];
  assert.equal(claim.reviewed_by, O);
  assert.ok(claim.reviewed_at);
  assert.equal(claim.rejection_reason, 'Confirm photos in person');
  await q(A, 'select public.week1_claim_bingo()');
  claim = (await q(A, "select * from public.week1_bingo_claims where status='pending'")).rows[0];
  // PGlite is single-connection: concurrent calls queue. Both conflicting review
  // statements still execute the real conditional UPDATE; only one may succeed.
  await db.exec('begin; set local role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [T]);
  const results = await Promise.allSettled([
    db.query("select public.week1_review_bingo($1,'verified','')", [claim.id]),
    db.query("select public.week1_review_bingo($1,'rejected','Conflicting review')", [claim.id]),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  await db.exec('rollback'); // second statement aborts this test transaction
  await q(T, "select public.week1_review_bingo($1,'verified','')", [claim.id]);
  await assert.rejects(
    q(O, "select public.week1_review_bingo($1,'rejected','Conflicting organizer')", [claim.id]),
    (e) => e.code === '40001',
  );
  const verified = (await q(A, "select * from public.week1_bingo_claims where status='verified'"))
    .rows[0];
  assert.equal(verified.reviewed_by, T);
  assert.ok(verified.reviewed_at);
  assert.equal(verified.rejection_reason, null);
  await assert.rejects(q(A, 'select public.week1_claim_bingo()'), (e) => e.code === '23505');
  await assert.rejects(q(A, 'select public.week1_mark_bingo(0,true,5)'), denied);
  await assert.rejects(q(A, "update public.week1_bingo_claims set status='verified'"), denied);
  await assert.rejects(q(T, "update public.week1_bingo_claims set status='rejected'"), denied);
});
test('session CRUD, ordering, planned defaults, optimistic concurrency and private content RLS', async (t) => {
  const { q } = await setup(t);
  assert.equal((await q(A, 'select * from public.week1_session')).rows.length, 0);
  let row = (await q(T, 'select * from public.week1_session')).rows[0];
  assert.equal(row.topics.length, 8);
  assert.ok(row.topics.every((x) => x.status === 'planned'));
  await assert.rejects(q(A, 'select public.week1_save_session($1,1)', [row.topics]), denied);
  await assert.rejects(q(A, "update public.week1_session set topics='[]'"), denied);
  const topics = [
    {
      ...row.topics[0],
      id: 'new',
      title_en: 'New topic',
      title_ar: 'موضوع جديد',
      notes: 'PRIVATE',
      links: 'https://example.test',
      status: 'completed',
    },
    ...row.topics.slice(1).reverse(),
  ];
  await q(T, 'select public.week1_save_session($1,1)', [topics]);
  row = (await q(O, 'select * from public.week1_session')).rows[0];
  assert.deepEqual(row.topics, topics);
  assert.equal(row.updated_by, T);
  await assert.rejects(
    q(O, 'select public.week1_save_session($1,1)', [topics]),
    (e) => e.code === '40001',
  );
  for (const bad of [
    [{ ...topics[0], links: 'javascript:alert(1)' }],
    [{ ...topics[0], title_en: ' ' }],
    [topics[0], topics[0]],
  ])
    await assert.rejects(
      q(T, 'select public.week1_save_session($1,2)', [bad]),
      (e) => e.code === '22023',
    );
  await q(O, 'select public.week1_save_session($1,2)', [topics.slice(1)]);
  assert.equal((await q(T, 'select * from public.week1_session')).rows[0].topics.length, 7);
  assert.equal((await q(B, 'select * from public.week1_session')).rows.length, 0);
});
test('anonymous and unverified accounts cannot access Week 1 data or privileged RPCs', async (t) => {
  const { db, q } = await setup(t);
  for (const table of [
    'week1_datasets',
    'week1_bingo_boards',
    'week1_bingo_claims',
    'week1_session',
  ]) {
    await assert.rejects(
      asUser(db, null, () => db.query(`select * from public.${table}`), 'anon'),
      denied,
    );
    assert.equal((await q(U, `select * from public.${table}`)).rows.length, 0);
  }
  await assert.rejects(
    asUser(db, null, () => db.query('select public.week1_start_bingo()'), 'anon'),
    denied,
  );
  await assert.rejects(q(U, 'select public.week1_start_bingo()'), denied);
  await assert.rejects(q(U, "select app_private.week1_save_session('[]',1)"), denied);
});

test('revoked team permissions immediately close private session reads and review writes', async (t) => {
  const { db, q } = await setup(t);
  assert.equal((await q(T, 'select * from public.week1_session')).rows.length, 1);
  await db.query(
    "update app_private.user_roles set role='student',grant_reason='Local revocation test' where user_id=$1",
    [T],
  );
  assert.equal((await q(T, 'select * from public.week1_session')).rows.length, 0);
  await assert.rejects(q(T, "select public.week1_save_session('[]',1)"), denied);
  await assert.rejects(q(T, "select public.week1_review_bingo($1,'verified','')", [A]), denied);
});
