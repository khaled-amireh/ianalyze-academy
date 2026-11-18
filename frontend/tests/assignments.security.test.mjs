import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, asUser } from '../scripts/database-fixture.mjs';
const A = '00000000-0000-4000-8000-000000000011',
  B = '00000000-0000-4000-8000-000000000012',
  T = '00000000-0000-4000-8000-000000000013';
test('phased assignments, shared awards and dynamic public/private sessions in PostgreSQL', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const q = (who, query, params = []) => asUser(db, who, () => db.query(query, params));
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'a@example.test',now()),($2,'b@example.test',now()),($3,'t@example.test',now())",
    [A, B, T],
  );
  await db.query(
    "update app_private.user_roles set role='team',grant_reason='Isolated fixture' where user_id=$1",
    [T],
  );
  for (const id of [A, B]) {
    await q(
      id,
      "update public.profiles set full_name='Private Student',whatsapp='+962790000001',university='Other University',major='AI',academic_year=2,python_experience='none' where id=$1",
      [id],
    );
    await q(id, "select public.complete_registration('registration-v1')");
  }
  const now = Date.now(),
    date = (n) => new Date(now + n).toISOString();
  const values = {
    title_en: 'Assignment',
    title_ar: 'Assignment',
    instructions_en: 'Instructions',
    instructions_ar: 'Instructions',
    reference_links: 'https://example.test/resource',
    submission_type: 'either',
    publish_at: date(-7200000),
    due_at: date(7200000),
    phases: [
      { name: 'Early', start: date(-7200000), end: date(3600000), points: 20 },
      { name: 'Regular', start: date(3600000), end: date(7200000), points: 15 },
    ],
    status: 'draft',
    accepting: true,
    archived: false,
    sort_order: 0,
  };
  const save = async (data, id = null, version = 0) =>
    (await q(T, 'select public.save_assignment($1,$2,$3) as id', [data, version, id])).rows[0].id;
  let id;
  await t.test(
    'dynamic create/edit/publish/hide, phase validation and student restrictions',
    async () => {
      await assert.rejects(
        q(A, 'select public.save_assignment($1,0,null)', [values]),
        (e) => e.code === '42501',
      );
      for (const phases of [
        [{ ...values.phases[0], points: -1 }],
        [{ ...values.phases[0], points: 1.001 }],
        [values.phases[0], { ...values.phases[1], start: date(0) }],
        [{ ...values.phases[0], end: values.phases[0].start }],
      ])
        await assert.rejects(save({ ...values, phases }));
      id = await save(values);
      assert.equal(
        (await q(A, 'select * from public.activities where id=$1', [id])).rows.length,
        0,
      );
      await save({ ...values, status: 'published' }, id, 1);
      assert.equal(
        (await q(A, 'select * from public.activities where id=$1', [id])).rows.length,
        1,
      );
      await assert.rejects(
        save({ ...values, status: 'published' }, id, 1),
        (e) => e.code === '40001',
      );
      await save({ ...values, status: 'draft' }, id, 2);
      assert.equal(
        (await q(A, 'select * from public.activities where id=$1', [id])).rows.length,
        0,
      );
      await save({ ...values, status: 'published' }, id, 3);
    },
  );
  let submission;
  await t.test(
    'trusted timestamps/phase, duplicate prevention, immutable work, valid links and exact deadline',
    async () => {
      for (const link of [
        'javascript:alert(1)',
        'https://example.test\nhttps://evil.test',
        'https://user:secret@example.test/',
        'https:///',
        'https://example.test:99999/work',
        'https://[::::]/',
      ])
        await assert.rejects(
          q(A, 'select public.submit_assignment($1,gen_random_uuid(),$2)', [id, link]),
        );
      submission = (
        await q(
          A,
          "select public.submit_assignment($1,gen_random_uuid(),'https://example.test/work') as id",
          [id],
        )
      ).rows[0].id;
      assert.equal(
        (
          await q(
            A,
            "select public.submit_assignment($1,gen_random_uuid(),'https://example.test/work') as id",
            [id],
          )
        ).rows[0].id,
        submission,
      );
      const row = (await q(A, 'select * from public.submissions where id=$1', [submission]))
        .rows[0];
      assert.equal(Number(row.max_eligible_points), 20);
      assert.equal(row.phase_snapshot.name, 'Early');
      assert.ok(row.submitted_at);
      await assert.rejects(
        q(A, 'update public.submissions set submitted_at=now() where id=$1', [submission]),
        (e) => e.code === '42501',
      );
      assert.equal(
        (await q(B, 'select * from public.submissions where id=$1', [submission])).rows.length,
        0,
      );
      await assert.rejects(
        save(
          { ...values, status: 'published', phases: [{ ...values.phases[0], points: 99 }] },
          id,
          4,
        ),
      );
      const expired = await save({
        ...values,
        status: 'published',
        due_at: date(-1),
        phases: [{ ...values.phases[0], end: date(-1) }],
      });
      await assert.rejects(
        q(B, "select public.submit_assignment($1,gen_random_uuid(),'https://example.test/work')", [
          expired,
        ]),
        (e) => e.code === '22023',
      );
      const gap = await save({
        ...values,
        status: 'published',
        phases: [
          { ...values.phases[0], end: date(-3600000) },
          { ...values.phases[1], start: date(3600000) },
        ],
      });
      await assert.rejects(
        q(B, "select public.submit_assignment($1,gen_random_uuid(),'https://example.test/work')", [
          gap,
        ]),
      );
    },
  );
  await t.test(
    'manual decimal grading, feedback isolation, corrections and one authoritative award',
    async () => {
      await assert.rejects(
        q(A, "select public.review_assignment($1,10,'forged',0)", [submission]),
        (e) => e.code === '42501',
      );
      for (const score of [-1, 20.01, 1.001])
        await assert.rejects(
          q(T, "select public.review_assignment($1,$2,'bad',0)", [submission, score]),
        );
      assert.equal((await q(A, 'select * from public.point_awards')).rows.length, 0);
      await q(T, "select public.review_assignment($1,17.25,'Useful private feedback',0)", [
        submission,
      ]);
      assert.equal(Number((await q(A, 'select * from public.point_awards')).rows[0].points), 17.25);
      assert.equal((await q(B, 'select * from public.grades')).rows.length, 0);
      await assert.rejects(
        q(T, "select public.review_assignment($1,2,'stale',0)", [submission]),
        (e) => e.code === '40001',
      );
      await q(T, "select public.review_assignment($1,12,'Corrected',1)", [submission]);
      assert.equal(Number((await q(A, 'select * from public.point_awards')).rows[0].points), 12);
      await q(T, "select public.review_assignment($1,0,'Invalid work',2)", [submission]);
      assert.equal(Number((await q(A, 'select * from public.point_awards')).rows[0].points), 0);
      await q(T, "select public.review_assignment($1,16,'Final review',3)", [submission]);
      assert.equal((await q(A, 'select * from public.point_awards')).rows.length, 1);
      assert.equal((await q(A, 'select * from public.grades')).rows.length, 4);
      await save({ ...values, status: 'draft', archived: true }, id, 4);
      assert.equal(
        (await q(A, 'select * from public.activities where id=$1', [id])).rows.length,
        0,
      );
      assert.equal(Number((await q(A, 'select * from public.point_awards')).rows[0].points), 16);
      await assert.rejects(q(T, 'delete from public.activities where id=$1', [id]));
      const leaderboard = (await q(A, 'select public.academy_leaderboard() as data')).rows[0].data;
      assert.equal(leaderboard[0].points, 16);
      assert.ok(!JSON.stringify(leaderboard).includes('Private Student'));
      assert.ok(!JSON.stringify(leaderboard).includes('feedback'));
    },
  );
  await t.test(
    'file metadata limits, reserved paths, owner downloads and finalization checks',
    async () => {
      const fileAssignment = await save({
        ...values,
        status: 'published',
        submission_type: 'file',
      });
      await assert.rejects(
        q(A, 'select public.submit_assignment($1,gen_random_uuid(),null,$2)', [
          fileAssignment,
          { name: 'bad.exe', mime: 'application/pdf', bytes: 5 },
        ]),
      );
      await assert.rejects(
        q(A, 'select public.submit_assignment($1,gen_random_uuid(),null,$2)', [
          fileAssignment,
          { name: 'ok.pdf', mime: 'application/pdf', bytes: 20971521 },
        ]),
      );
      const result = await q(
        A,
        'select public.submit_assignment($1,gen_random_uuid(),null,$2) as id',
        [fileAssignment, { name: 'ok.pdf', mime: 'application/pdf', bytes: 5 }],
      );
      const sid = result.rows[0].id,
        row = (await q(A, 'select * from public.submissions where id=$1', [sid])).rows[0];
      await assert.rejects(q(A, 'select public.finalize_assignment($1)', [sid]));
      await assert.rejects(
        q(
          B,
          "insert into storage.objects(bucket_id,name,metadata) values('student-submissions',$1,'{}')",
          [row.attachment_path],
        ),
        (e) => e.code === '42501',
      );
      await q(
        A,
        "insert into storage.objects(bucket_id,name,metadata) values('student-submissions',$1,$2)",
        [row.attachment_path, { size: 5, mimetype: 'application/pdf' }],
      );
      await q(A, 'select public.finalize_assignment($1)', [sid]);
      assert.equal(
        (await q(A, 'select * from storage.objects where name=$1', [row.attachment_path])).rows
          .length,
        1,
      );
      assert.equal(
        (await q(B, 'select * from storage.objects where name=$1', [row.attachment_path])).rows
          .length,
        0,
      );
      await q(A, 'update storage.objects set metadata=$1 where name=$2', [
        { size: 8 },
        row.attachment_path,
      ]);
      assert.equal(
        (await q(A, 'select metadata from storage.objects where name=$1', [row.attachment_path]))
          .rows[0].metadata.size,
        5,
      );
    },
  );
  await t.test(
    'future-week session CRUD, explicit topic/session visibility and private notes isolation',
    async () => {
      const topics = [
        {
          id: 'x',
          title_en: 'Public title',
          title_ar: 'Title',
          description: 'Description',
          notes: 'NEVER PUBLIC',
          links: 'https://example.test',
          status: 'completed',
          visible: true,
        },
        {
          id: 'y',
          title_en: 'Hidden title',
          title_ar: 'Title',
          description: '',
          notes: 'Hidden notes',
          links: '',
          status: 'planned',
          visible: false,
        },
      ];
      await q(T, 'select public.save_session_content(2,$1,false,0)', [topics]);
      assert.equal(
        (await q(A, 'select * from public.session_public_content where week_number=2')).rows.length,
        0,
      );
      await q(T, 'select public.save_session_content(2,$1,true,1)', [topics]);
      let pub = (await q(A, 'select * from public.session_public_content where week_number=2'))
        .rows[0];
      assert.equal(pub.topics.length, 1);
      assert.ok(!JSON.stringify(pub).includes('NEVER PUBLIC'));
      assert.ok(!JSON.stringify(pub).includes('Hidden title'));
      assert.ok(!('notes' in pub.topics[0]));
      await assert.rejects(
        q(A, 'select public.save_session_content(2,$1,true,2)', [topics]),
        (e) => e.code === '42501',
      );
      assert.equal((await q(A, 'select * from public.week1_session')).rows.length, 0);
      await assert.rejects(
        q(T, 'select public.save_session_content(2,$1,true,1)', [topics]),
        (e) => e.code === '40001',
      );
      await q(T, 'select public.save_session_content(2,$1,true,2)', [
        [
          { ...topics[1], visible: true },
          { ...topics[0], visible: false },
        ],
      ]);
      pub = (await q(A, 'select * from public.session_public_content where week_number=2')).rows[0];
      assert.equal(pub.topics[0].id, 'y');
      await q(T, 'select public.save_session_content(2,$1,false,3)', [[topics[1]]]);
      assert.equal(
        (await q(A, 'select * from public.session_public_content where week_number=2')).rows.length,
        0,
      );
      assert.equal(
        (await q(T, 'select * from public.week1_session where id=2')).rows[0].topics.length,
        1,
      );
    },
  );
  await t.test(
    'assignment order changes are authorized and serialized; only unused drafts can be deleted',
    async () => {
      const first = await save({ ...values, title_en: 'First draft' }),
        second = await save({ ...values, title_en: 'Second draft' });
      const ordered = (
        await q(
          T,
          'select id,version from public.activities where assignment_mode and not archived order by sort_order,id',
        )
      ).rows;
      const last = ordered.at(-1);
      const previous = ordered.at(-2);
      await assert.rejects(
        q(A, 'select public.move_assignment($1,-1,$2)', [last.id, last.version]),
        (e) => e.code === '42501',
      );
      await q(T, 'select public.move_assignment($1,-1,$2)', [last.id, last.version]);
      const after = (
        await q(
          T,
          'select id from public.activities where assignment_mode and not archived order by sort_order,id',
        )
      ).rows;
      assert.equal(after.at(-2).id, last.id);
      assert.equal(after.at(-1).id, previous.id);
      await assert.rejects(
        q(T, 'select public.move_assignment($1,-1,$2)', [last.id, last.version]),
        (e) => e.code === '40001',
      );
      await q(T, 'delete from public.activities where id=$1', [first]);
      await q(T, 'delete from public.activities where id=$1', [second]);
      assert.equal(
        (await q(T, 'select * from public.activities where id in($1,$2)', [first, second])).rows
          .length,
        0,
      );
    },
  );
});
