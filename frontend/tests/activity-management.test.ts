import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fromAmmanDateTimeLocal,
  toAmmanDateTimeLocal,
  weeklyPeriodForDisplay,
} from '../src/features/portal/date-time.ts';
import {
  findResumableActivitySubmission,
  validateSelectedActivityFiles,
} from '../src/features/portal/submission-file-validation.ts';
import { submissionWindowState } from '../src/features/portal/submission-window.ts';
import { validateTimingBonuses } from '../src/features/portal/timing-bonus.ts';
import {
  readBoundedJsonObject,
  validateActivityFile,
} from '../../supabase/functions/_shared/activity-files.ts';

test('general file submissions enforce an explicit type, filename, count and per-file size', () => {
  const valid = new File(['%PDF-1.7'], 'report.pdf', { type: 'application/pdf' });
  assert.equal(
    validateSelectedActivityFiles([valid], { maxFiles: 1, maxBytes: 100 })[0]?.name,
    'report.pdf',
  );
  assert.throws(
    () => validateSelectedActivityFiles([], { maxFiles: 1, maxBytes: 100 }),
    /file-count/,
  );
  assert.throws(
    () => validateSelectedActivityFiles([valid, valid], { maxFiles: 2, maxBytes: 100 }),
    /duplicate/,
  );
  assert.throws(
    () =>
      validateSelectedActivityFiles([new File(['x'], 'report.exe')], {
        maxFiles: 1,
        maxBytes: 100,
      }),
    /type/,
  );
  assert.throws(
    () =>
      validateSelectedActivityFiles([new File(['x'], 'report.pdf', { type: 'text/plain' })], {
        maxFiles: 1,
        maxBytes: 100,
      }),
    /type/,
  );
  assert.throws(
    () =>
      validateSelectedActivityFiles([new File(['x'], '../report.txt', { type: 'text/plain' })], {
        maxFiles: 1,
        maxBytes: 100,
      }),
    /filename/,
  );
  assert.throws(
    () =>
      validateSelectedActivityFiles(
        [new File(['x'], 'report\u202eexe.txt', { type: 'text/plain' })],
        {
          maxFiles: 1,
          maxBytes: 100,
        },
      ),
    /filename/,
  );
  assert.throws(
    () =>
      validateSelectedActivityFiles(
        [new File(['x'.repeat(101)], 'large.txt', { type: 'text/plain' })],
        { maxFiles: 1, maxBytes: 100 },
      ),
    /size/,
  );
});

test('server-side file inspection rejects content that does not match its allowed type', () => {
  assert.equal(
    validateActivityFile(new TextEncoder().encode('%PDF-1.7'), 'report.pdf', 'application/pdf')
      .extension,
    'pdf',
  );
  assert.throws(() =>
    validateActivityFile(
      new TextEncoder().encode('<script>alert(1)</script>'),
      'report.pdf',
      'application/pdf',
    ),
  );
  assert.throws(() =>
    validateActivityFile(
      new TextEncoder().encode('prefix%PDF-1.7'),
      'spoofed.pdf',
      'application/pdf',
    ),
  );
  assert.throws(() =>
    validateActivityFile(Uint8Array.of(0xff, 0xfe, 0x00), 'report.csv', 'text/csv'),
  );
  assert.throws(() =>
    validateActivityFile(new TextEncoder().encode('{}'), 'run.ipynb', 'application/json'),
  );
});

test('upload control requests accept only small JSON objects and reject oversized or malformed bodies', async () => {
  const request = (body: string, headers?: HeadersInit) =>
    new Request('https://local.invalid/activity-submit', {
      method: 'POST',
      headers: headers ?? { 'content-type': 'application/json' },
      body,
    });
  assert.deepEqual(await readBoundedJsonObject(request('{"submissionId":"synthetic"}')), {
    submissionId: 'synthetic',
  });
  await assert.rejects(
    readBoundedJsonObject(request('{"x":"12345"}', { 'content-length': '99' }), 16),
    /Invalid request body/,
  );
  await assert.rejects(
    readBoundedJsonObject(request('{"x":"12345678901234567890"}'), 16),
    /Invalid request body/,
  );
  await assert.rejects(readBoundedJsonObject(request('[]')), /Invalid request body/);
  await assert.rejects(readBoundedJsonObject(request('{')), SyntaxError);
});

test('Edge upload finalization authenticates the student before service-role verification', () => {
  const handler = readFileSync(
    new URL('../../supabase/functions/activity-submit/index.ts', import.meta.url),
    'utf8',
  );
  const normalizedHandler = handler.replace(/\s+/g, ' ');
  const identityCheck = normalizedHandler.indexOf('userClient.auth.getUser');
  const roleCheck = normalizedHandler.indexOf('userClient.rpc("current_academy_role")');
  const serviceClient = normalizedHandler.indexOf('createClient(url, serviceKey');
  const contentCheck = normalizedHandler.indexOf(
    'validateActivityFile(bytes, file.original_name, file.content_type)',
  );
  const finalize = normalizedHandler.indexOf('admin.rpc("finalize_activity_submission"');
  assert.ok(identityCheck >= 0 && roleCheck > identityCheck && serviceClient > roleCheck);
  assert.ok(contentCheck >= 0 && finalize > contentCheck);
  assert.match(
    handler,
    /if \(origin && !allowed\.includes\(origin\)\) return reply\(403, "Origin denied"\)/,
  );
  assert.match(handler, /capabilities\.data\?\.submissions !== true/);
  assert.match(handler, /Deno\.env\.get\("ACADEMY_ACTIVITY_UPLOADS_ENABLED"\) !== "true"/);
  assert.match(handler, /catch\s*\{\s*return reply\(503, "Submission service unavailable"\);\s*\}/);
  assert.doesNotMatch(handler, /console\.(?:log|error|warn)|error\.message/);
});

test('new activity uploads use an independent fail-closed gate from Week 1 notebooks', () => {
  const activityHandler = readFileSync(
    new URL('../../supabase/functions/activity-submit/index.ts', import.meta.url),
    'utf8',
  );
  const notebookHandler = readFileSync(
    new URL('../../supabase/functions/notebook-submit/index.ts', import.meta.url),
    'utf8',
  );
  assert.match(activityHandler, /ACADEMY_ACTIVITY_UPLOADS_ENABLED"\) !== "true"/);
  assert.doesNotMatch(activityHandler, /ACADEMY_UPLOADS_ENABLED"\) !== "true"/);
  assert.match(notebookHandler, /ACADEMY_UPLOADS_ENABLED"\) !== "true"/);
  assert.doesNotMatch(notebookHandler, /ACADEMY_ACTIVITY_UPLOADS_ENABLED/);
});

test('Edge release preserves the Week 1 gate and deploys both functions with activity uploads closed', () => {
  const deployer = readFileSync(
    new URL('../scripts/deploy-supabase-edge.mjs', import.meta.url),
    'utf8',
  );
  const workflow = readFileSync(
    new URL('../../.github/workflows/production.yml', import.meta.url),
    'utf8',
  );
  assert.match(deployer, /ACADEMY_ACTIVITY_UPLOADS_ENABLED=false/);
  assert.doesNotMatch(deployer, /ACADEMY_UPLOADS_ENABLED\s*=/);
  assert.doesNotMatch(deployer, /ACADEMY_ACTIVITY_UPLOADS_ENABLED=true/);
  assert.match(deployer, /functionsToDeploy = \['notebook-submit', 'activity-submit'\]/);
  assert.match(deployer, /for \(const functionName of functionsToDeploy\)/);
  assert.match(deployer, /deployed\?\.status !== 'ACTIVE' \|\| deployed\.verify_jwt !== false/);
  assert.match(deployer, /activityRejected\.status !== 401/);
  const edgeTrigger = workflow.split('git diff --quiet')[1]?.split('; then')[0] ?? '';
  assert.match(edgeTrigger, /supabase\/functions/);
  assert.match(workflow, /steps\.edge_changes\.outputs\.changed == 'true'/);
  assert.match(workflow, /npm --prefix frontend run release:edge/);
});

test('new activity upload gates cover UI, reservation, Storage, finalization and Edge', () => {
  const migration = readFileSync(
    new URL(
      '../../supabase/migrations/20261122120000_dynamic_activity_submissions.sql',
      import.meta.url,
    ),
    'utf8',
  );
  const studentPage = readFileSync(
    new URL('../src/features/portal/student-page.tsx', import.meta.url),
    'utf8',
  );
  const edge = readFileSync(
    new URL('../../supabase/functions/activity-submit/index.ts', import.meta.url),
    'utf8',
  );
  assert.match(
    migration,
    /create function app_private\.activity_file_submissions_enabled\(\) returns boolean[\s\S]*?select false/,
  );
  assert.match(migration, /if not app_private\.activity_file_submissions_enabled\(\) then/);
  assert.match(migration, /app_private\.activity_file_submissions_enabled\(\)\)/);
  assert.match(
    migration,
    /'activity_file_submissions', app_private\.activity_file_submissions_enabled\(\)/,
  );
  assert.match(studentPage, /data\.capabilities\.activity_file_submissions/);
  assert.match(edge, /capabilities\.data\?\.activity_file_submissions !== true/);
  assert.match(edge, /ACADEMY_ACTIVITY_UPLOADS_ENABLED"\) !== "true"/);
});

test('unused draft deletion locks its activity before checking eligibility', () => {
  const migration = readFileSync(
    new URL(
      '../../supabase/migrations/20261122120000_dynamic_activity_submissions.sql',
      import.meta.url,
    ),
    'utf8',
  );
  const start = migration.indexOf('create function app_private.delete_activity_draft');
  const end = migration.indexOf('create function public.delete_activity_draft', start);
  assert.ok(start >= 0 && end > start);
  const body = migration.slice(start, end);
  const lock = body.indexOf('from public.activities where id = p_activity_id for update');
  const statusGuard = body.indexOf("activity_record.status <> 'draft'");
  const submissionGuard = body.indexOf('exists (select 1 from public.submissions');
  const activityDelete = body.indexOf('delete from public.activities where id = p_activity_id');
  assert.ok(lock >= 0 && statusGuard > lock && submissionGuard > lock && activityDelete > lock);
});

test('pending upload resumes only when the exact reserved ordered manifest matches', () => {
  const pending = [
    {
      id: 'reserved',
      activity_id: 'activity-a',
      status: 'uploading',
      files: [
        {
          position: 0,
          original_name: 'report.pdf',
          content_type: 'application/pdf',
          size_bytes: 8,
          expected_sha256: 'a'.repeat(64),
        },
      ],
    },
  ];
  const selected = [
    { name: 'report.pdf', type: 'application/pdf', size: 8, sha256: 'a'.repeat(64) },
  ];
  assert.equal(findResumableActivitySubmission(pending, 'activity-a', selected), 'reserved');
  assert.equal(findResumableActivitySubmission(pending, 'activity-b', selected), undefined);
  assert.equal(
    findResumableActivitySubmission(pending, 'activity-a', [
      { ...selected[0]!, sha256: 'b'.repeat(64) },
    ]),
    undefined,
  );
  assert.equal(
    findResumableActivitySubmission(
      [{ ...pending[0]!, status: 'submitted' }],
      'activity-a',
      selected,
    ),
    undefined,
  );
});

test('Asia/Amman activity times round-trip and submission windows show open, upcoming and closed', () => {
  const instant = '2026-12-02T09:30:00.000Z';
  const local = toAmmanDateTimeLocal(instant);
  assert.equal(fromAmmanDateTimeLocal(local), instant);
  assert.throws(() => fromAmmanDateTimeLocal('2026-02-30T12:00'));
  assert.equal(
    submissionWindowState(
      '2026-12-02T10:00:00Z',
      '2026-12-05T10:00:00Z',
      Date.parse('2026-12-02T09:00:00Z'),
    ),
    'upcoming',
  );
  assert.equal(
    submissionWindowState(
      '2026-12-02T08:00:00Z',
      '2026-12-05T10:00:00Z',
      Date.parse('2026-12-02T09:00:00Z'),
    ),
    'open',
  );
  assert.equal(
    submissionWindowState(
      '2026-12-02T08:00:00Z',
      '2026-12-05T10:00:00Z',
      Date.parse('2026-12-05T10:00:01Z'),
    ),
    'closed',
  );
  assert.equal(submissionWindowState(null, 'invalid', Date.now()), 'closed');
});

test('weekly period display converts the server exclusive end into the last included instant', () => {
  const period = weeklyPeriodForDisplay('2026-11-29T21:00:00Z', '2026-12-06T21:00:00Z');
  assert.ok(period);
  assert.equal(Date.parse(period.end), Date.parse('2026-12-06T21:00:00Z') - 1);
  assert.equal(weeklyPeriodForDisplay('invalid', '2026-12-06T21:00:00Z'), null);
  assert.equal(weeklyPeriodForDisplay('2026-12-06T21:00:00Z', '2026-11-29T21:00:00Z'), null);
});

test('three-phase bonus setup is ordered, nonnegative, cent-precise, and optional', () => {
  validateTimingBonuses({
    opensAt: '2026-12-01T09:00',
    phaseOneEndsAt: '',
    phaseTwoEndsAt: '',
    dueAt: '2026-12-10T09:00',
    earlyBonus: 0,
    middleBonus: 0,
    lateBonus: 0,
  });
  validateTimingBonuses({
    opensAt: '2026-12-01T09:00',
    phaseOneEndsAt: '2026-12-03T09:00',
    phaseTwoEndsAt: '2026-12-06T09:00',
    dueAt: '2026-12-10T09:00',
    earlyBonus: 20,
    middleBonus: 10,
    lateBonus: 0.29,
  });
  assert.throws(
    () =>
      validateTimingBonuses({
        opensAt: '2026-12-01T09:00',
        phaseOneEndsAt: '2026-12-06T09:00',
        phaseTwoEndsAt: '2026-12-03T09:00',
        dueAt: '2026-12-10T09:00',
        earlyBonus: 20,
        middleBonus: 10,
        lateBonus: 5,
      }),
    /ordered/,
  );
  assert.throws(
    () =>
      validateTimingBonuses({
        opensAt: '2026-12-01T09:00',
        phaseOneEndsAt: '2026-12-03T09:00',
        phaseTwoEndsAt: '2026-12-06T09:00',
        dueAt: '2026-12-10T09:00',
        earlyBonus: 5,
        middleBonus: 10,
        lateBonus: 20,
      }),
    /decrease/,
  );
  assert.throws(
    () =>
      validateTimingBonuses({
        opensAt: '2026-12-01T09:00',
        phaseOneEndsAt: '2026-12-03T09:00',
        phaseTwoEndsAt: '',
        dueAt: '2026-12-10T09:00',
        earlyBonus: 20,
        middleBonus: 10,
        lateBonus: 5,
      }),
    /boundaries/,
  );
  assert.throws(
    () =>
      validateTimingBonuses({
        opensAt: '',
        phaseOneEndsAt: '',
        phaseTwoEndsAt: '',
        dueAt: '',
        earlyBonus: 0,
        middleBonus: 0.001,
        lateBonus: 0,
      }),
    /bonus/,
  );
});

test('navigation, Week 1 completion and student activities keep the release scope bounded', () => {
  const navigation = readFileSync(new URL('../src/app/navigation.ts', import.meta.url), 'utf8');
  const student = readFileSync(
    new URL('../src/features/portal/student-page.tsx', import.meta.url),
    'utf8',
  );
  const team = readFileSync(
    new URL('../src/features/portal/team-page.tsx', import.meta.url),
    'utf8',
  );
  const week = readFileSync(
    new URL('../src/features/week1/week1-entry.tsx', import.meta.url),
    'utf8',
  );
  const leaderboard = readFileSync(
    new URL('../src/features/portal/leaderboard.tsx', import.meta.url),
    'utf8',
  );
  const en = JSON.parse(readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8'));
  const ar = JSON.parse(readFileSync(new URL('../src/locales/ar.json', import.meta.url), 'utf8'));
  assert.equal((navigation.match(/to: '\/leaderboard'/g) ?? []).length, 1);
  assert.match(
    student,
    /week\.week_number === 1 && week\.kind === 'teaching' && week\.status === 'published'/,
  );
  assert.match(student, /activity\.status === 'published'[\s\S]*?!activity\.archived_at/);
  assert.match(week, /completedBadge/);
  assert.equal(en.week1.completedBadge, 'Completed');
  assert.equal(ar.week1.completedBadge, 'مكتمل');
  assert.match(leaderboard, /<Medal/);
  assert.match(leaderboard, /rows\.filter\(\(row\) => row\.rank <= 3\)/);
  assert.match(leaderboard, /row\.is_you &&/);
  assert.match(leaderboard, /key=\{`\$\{row\.rank\}:\$\{index\}`\}/);
  assert.match(leaderboard, /<tbody>[\s\S]*?rows\.map/);
  const migration = readFileSync(
    new URL(
      '../../supabase/migrations/20261122120000_dynamic_activity_submissions.sql',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(
    migration,
    /rank\(\) over\(order by e\.points desc, e\.tie_activities desc, e\.completed_at asc nulls last\) as rank/,
  );
  assert.match(team, /data\.weeks\s*\.filter\(\s*\(week\)\s*=>\s*week\.week_number === 1\s*\)/);
  assert.doesNotMatch(team, /insert\(\{\s*week_number/);
});
