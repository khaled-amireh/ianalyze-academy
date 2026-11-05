import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { localTestTarget } from '../scripts/local-test-target.mjs';

const enabled = process.env.RUN_LOCAL_SUPABASE_TESTS === '1';
describe('real local Supabase Auth/REST/Storage integration', { skip: !enabled }, () => {
  let admin, sql, anonymous;
  let fixturesApproved = false;
  const users = [];
  const clients = [];
  const uploads = [];
  const ids = {
    week: randomUUID(),
    activity: randomUUID(),
    rubric: randomUUID(),
    criterion: randomUUID(),
    submission: randomUUID(),
  };
  let a, b, team, unverified, submissionPath;
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  before(async () => {
    // Both endpoints are checked BEFORE creating any client or making any request.
    const url = localTestTarget(process.env.LOCAL_SUPABASE_URL ?? 'http://127.0.0.1:54321');
    const databaseUrl = localTestTarget(process.env.LOCAL_SUPABASE_DB_URL ?? '', 'database');
    const publishable = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
    const secret = process.env.LOCAL_SUPABASE_SECRET_KEY;
    assert.ok(
      publishable && secret,
      'Provide local-only keys through ignored environment settings',
    );
    sql = postgres(databaseUrl, { max: 1, connect_timeout: 5 });
    const marker = await sql`select app_private.uploads_enabled() as enabled`;
    assert.equal(
      marker[0].enabled,
      false,
      'Only a Phase 03 test database with uploads disabled is accepted',
    );
    assert.equal(
      Number((await sql`select count(*) as count from public.academy_weeks`)[0].count),
      0,
      'Use a fresh disposable local stack, not an existing academy database',
    );
    fixturesApproved = true;
    admin = createClient(url, secret, options);
    anonymous = createClient(url, publishable, options);
    const suffix = randomUUID();
    for (const name of ['a', 'b', 'team', 'unverified']) {
      const email = `phase03-${name}-${suffix}@example.test`;
      const password = `Local-only-${randomUUID()}-aA9!`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: name !== 'unverified',
        user_metadata: { role: 'team' },
      });
      assert.equal(error, null);
      assert.ok(data.user);
      users.push(data.user.id);
      const client = createClient(url, publishable, options);
      clients.push(client);
      const record = { id: data.user.id, client, email, password };
      if (name === 'a') a = record;
      if (name === 'b') b = record;
      if (name === 'team') team = record;
      if (name === 'unverified') unverified = record;
      if (name !== 'unverified') {
        assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
        assert.equal(
          (
            await client
              .from('profiles')
              .update({
                full_name: 'Disposable Test',
                whatsapp: '+962790000000',
                major: 'Data Science & Artificial Intelligence',
                university: 'Local Test University',
                academic_year: 4,
                python_experience: 'none',
              })
              .eq('id', record.id)
          ).error,
          null,
        );
        assert.equal(
          (await client.rpc('complete_registration', { p_consent_version: 'registration-v1' }))
            .error,
          null,
        );
      }
    }
    await sql`update app_private.user_roles set role='team', grant_reason='Disposable local integration fixture' where user_id=${team.id}`;
    await sql`insert into public.academy_weeks(id,week_number,kind,title_ar,title_en,status) values (${ids.week},1,'teaching','Test','Test','published')`;
    await sql`insert into public.activities(id,week_id,title_ar,title_en,max_score,status) values (${ids.activity},${ids.week},'Test','Test',10,'published')`;
    await sql`insert into public.rubrics(id,activity_id,version) values (${ids.rubric},${ids.activity},1)`;
    await sql`insert into public.rubric_criteria(id,rubric_id,label_ar,label_en,max_points,sort_order) values (${ids.criterion},${ids.rubric},'Test','Test',10,0)`;
    await sql`update public.rubrics set status='published' where id=${ids.rubric}`;
    const rows =
      await sql`insert into public.submissions(id,student_id,activity_id,rubric_id,status,submitted_at) values (${ids.submission},${a.id},${ids.activity},${ids.rubric},'submitted',now()) returning object_path`;
    submissionPath = rows[0].object_path;
    const notebook = JSON.stringify({ cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 });
    const upload = await admin.storage
      .from('student-submissions')
      .upload(submissionPath, notebook, { contentType: 'application/x-ipynb+json', upsert: false });
    assert.equal(upload.error, null);
    uploads.push(['student-submissions', submissionPath]);
    assert.equal(
      (
        await admin.storage
          .from('team-materials')
          .upload(`fixture-${suffix}.pdf`, '%PDF-test-fixture', { contentType: 'application/pdf' })
      ).error,
      null,
    );
    uploads.push(['team-materials', `fixture-${suffix}.pdf`]);
  });
  after(async () => {
    try {
      if (!fixturesApproved) return;
      for (const [bucket, path] of uploads)
        assert.equal((await admin.storage.from(bucket).remove([path])).error, null);
      if (sql)
        await sql.begin(async (tx) => {
          // Only UUID-scoped disposable fixtures. This NEVER runs against a hosted URL.
          // Disable immutability triggers for test fixture teardown, in this transaction only.
          await tx`set local session_replication_role = replica`;
          await tx`delete from public.grade_criterion_scores where grade_id in (select id from public.grades where submission_id=${ids.submission})`;
          await tx`delete from public.grades where submission_id=${ids.submission}`;
          await tx`delete from public.submissions where id=${ids.submission}`;
          await tx`delete from public.rubric_criteria where rubric_id=${ids.rubric}`;
          await tx`delete from public.rubrics where id=${ids.rubric}`;
          await tx`delete from public.activities where id=${ids.activity}`;
          await tx`delete from public.academy_weeks where id=${ids.week}`;
        });
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    } finally {
      if (sql) await sql.end();
    }
  });
  it('requires email confirmation and ignores role metadata at signup', async () => {
    assert.ok(
      (
        await unverified.client.auth.signInWithPassword({
          email: unverified.email,
          password: unverified.password,
        })
      ).error,
    );
    assert.equal((await a.client.rpc('current_academy_role')).data, 'student');
  });
  it('REST denies anonymous data, cross-student data and privileged field updates', async () => {
    assert.ok((await anonymous.from('profiles').select('*')).error);
    assert.deepEqual((await a.client.from('profiles').select('*').eq('id', b.id)).data, []);
    assert.ok(
      (
        await a.client
          .from('profiles')
          .update({ registered_at: new Date().toISOString() })
          .eq('id', a.id)
      ).error,
    );
    assert.equal((await team.client.from('profiles').select('id')).data.length, 3);
  });
  it('REST hides draft grades and publishes only through authorized revision checks', async () => {
    assert.ok(
      (
        await a.client.rpc('save_grade', {
          p_submission_id: ids.submission,
          p_scores: { [ids.criterion]: 10 },
          p_feedback: 'Forbidden',
          p_publish: true,
          p_expected_revision: 0,
        })
      ).error,
    );
    const args = {
      p_submission_id: ids.submission,
      p_scores: { [ids.criterion]: 9 },
      p_feedback: 'Fixture',
      p_publish: false,
      p_expected_revision: 0,
    };
    assert.equal((await team.client.rpc('save_grade', args)).error, null);
    assert.deepEqual((await a.client.from('grades').select('*')).data, []);
    assert.equal(
      (await team.client.rpc('save_grade', { ...args, p_publish: true, p_expected_revision: 1 }))
        .error,
      null,
    );
    assert.equal((await a.client.from('grades').select('*')).data.length, 1);
    assert.deepEqual((await b.client.from('grades').select('*')).data, []);
  });
  it('Storage permits owned/Team downloads and denies cross-student, anonymous and public URLs', async () => {
    assert.equal(
      (await a.client.storage.from('student-submissions').download(submissionPath)).error,
      null,
    );
    assert.equal(
      (await team.client.storage.from('student-submissions').download(submissionPath)).error,
      null,
    );
    assert.ok((await b.client.storage.from('student-submissions').download(submissionPath)).error);
    assert.ok((await anonymous.storage.from('student-submissions').download(submissionPath)).error);
    const { data } = anonymous.storage.from('student-submissions').getPublicUrl(submissionPath);
    assert.equal((await fetch(data.publicUrl)).ok, false);
    const teamPath = uploads.find(([bucket]) => bucket === 'team-materials')[1];
    assert.equal((await team.client.storage.from('team-materials').download(teamPath)).error, null);
    assert.ok((await a.client.storage.from('team-materials').download(teamPath)).error);
  });
  it('Storage rejects active uploads, overwrites and invalid/oversized notebook uploads', async () => {
    for (const [path, payload, contentType, upsert] of [
      [submissionPath, '{}', 'application/x-ipynb+json', true],
      [`${a.id}/forged/submission.ipynb`, '{}', 'application/x-ipynb+json', false],
      [`${a.id}/large/submission.ipynb`, new Uint8Array(262145), 'application/x-ipynb+json', false],
      [`${a.id}/invalid/payload.html`, '<html></html>', 'text/html', false],
    ])
      assert.ok(
        (
          await a.client.storage
            .from('student-submissions')
            .upload(path, payload, { contentType, upsert })
        ).error,
      );
    // Independently exercise bucket limits with the local privileged test client,
    // so a closed Student RLS gate cannot mask broken size/MIME enforcement.
    for (const [payload, contentType] of [
      [new Uint8Array(262145), 'application/x-ipynb+json'],
      ['<html></html>', 'text/html'],
    ]) {
      const path = `${a.id}/${ids.activity}/${randomUUID()}/submission.ipynb`;
      const result = await admin.storage
        .from('student-submissions')
        .upload(path, payload, { contentType, upsert: false });
      if (!result.error) uploads.push(['student-submissions', path]);
      assert.ok(
        result.error,
        'Bucket size/MIME limit must be enforced independently of Student RLS',
      );
    }
  });
  it('Team revocation is effective with the existing Auth session', async () => {
    await sql`update app_private.user_roles set role='student',grant_reason='Disposable local revocation' where user_id=${team.id}`;
    assert.equal((await team.client.rpc('current_academy_role')).data, 'student');
    assert.equal((await team.client.from('profiles').select('id')).data.length, 1);
    assert.ok(
      (await team.client.storage.from('student-submissions').download(submissionPath)).error,
    );
  });
});
