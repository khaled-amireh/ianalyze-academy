import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  bingoLine,
  winningLines,
  isKaggleDataset,
  safeLinks,
  isIgnoredClaim,
  BINGO_IGNORE_REASON,
  datasetStatistics,
} from '../src/features/week1/domain.ts';
const order = Array.from({ length: 16 }, (_, i) => (i * 7) % 16);
test('dataset statistics count submitted attempts and distinct owners, excluding drafts', () => {
  assert.deepEqual(
    datasetStatistics([
      { status: 'submitted', student_id: 'a' },
      { status: 'submitted', student_id: 'a' },
      { status: 'draft', student_id: 'b' },
      { status: 'submitted', student_id: 'c' },
    ]),
    { total: 3, students: 2 },
  );
  assert.deepEqual(datasetStatistics([{ status: 'draft', student_id: 'a' }]), {
    total: 0,
    students: 0,
  });
});
test('Ignore reuses rejected audit state without relabeling ordinary rejections or approvals', () => {
  assert.equal(isIgnoredClaim({ status: 'rejected', rejection_reason: BINGO_IGNORE_REASON }), true);
  for (const status of ['pending', 'verified'])
    assert.equal(isIgnoredClaim({ status, rejection_reason: BINGO_IGNORE_REASON }), false);
  assert.equal(
    isIgnoredClaim({ status: 'rejected', rejection_reason: 'Please explain the challenges' }),
    false,
  );
  assert.equal(isIgnoredClaim(null), false);
});
test('Study Plan prerequisites match the requested Power BI/Kaggle content', () => {
  const en = JSON.parse(readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8'));
  const ar = JSON.parse(readFileSync(new URL('../src/locales/ar.json', import.meta.url), 'utf8'));
  assert.equal(
    en.simple.needText,
    "A laptop with Power BI Desktop installed and an internet connection. You'll also need a free Kaggle account to explore and download datasets. No previous experience in data analysis or programming is required.",
  );
  assert.equal(
    ar.simple.needText,
    'تحتاج إلى لابتوب مثبّت عليه Power BI Desktop واتصال بالإنترنت، بالإضافة إلى حساب مجاني على Kaggle لاستكشاف مجموعات البيانات وتنزيلها. لا تحتاج إلى أي خبرة سابقة في تحليل البيانات أو البرمجة.',
  );
  const source = readFileSync(
    new URL('../src/pages/public/syllabus-page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /learning.viewTools/);
});
test('all 10 straight Bingo lines work against shuffled challenge IDs', () => {
  assert.equal(winningLines.length, 10);
  for (const line of winningLines) {
    const completed = line.map((position) => order[position]!);
    assert.deepEqual(bingoLine(order, completed), line);
    assert.equal(bingoLine(order, completed.slice(0, 3)), undefined);
  }
  assert.equal(bingoLine(order, [order[0]!, order[2]!, order[5]!, order[9]!]), undefined);
});
test('only canonical Kaggle dataset pages pass; executable and misleading links fail', () => {
  for (const value of [
    'https://www.kaggle.com/datasets/owner/data-set',
    'https://kaggle.com/datasets/a/b_1/',
    'https://kaggle.com/datasets/a/b\n',
  ])
    assert.ok(isKaggleDataset(value));
  for (const value of [
    'https://www.kaggle.com/datasets',
    'http://kaggle.com/datasets/a/b',
    'https://kaggle.com.evil.test/datasets/a/b',
    'https://evil@kaggle.com/datasets/a/b',
    'javascript:alert(1)',
    'https://kaggle.com/datasets/a/b?x=1',
    'https://kaggle.com/datasets/a/b/files',
  ])
    assert.equal(isKaggleDataset(value), false);
  assert.ok(safeLinks('https://example.test\nhttp://example.test/resource'));
  assert.equal(safeLinks('javascript:alert(1)'), false);
  assert.equal(safeLinks('https://'), false);
});
test('all 16 official social challenges have unique Arabic and English translations', () => {
  const load = (lang: string) =>
    JSON.parse(readFileSync(new URL(`../src/locales/${lang}.json`, import.meta.url), 'utf8')).week1;
  const ar = load('ar'),
    en = load('en');
  for (const locale of [ar, en]) {
    assert.equal(locale.challenges.length, 16);
    assert.equal(new Set(locale.challenges).size, 16);
    assert.equal(Object.keys(locale.states).length, 6);
    assert.equal(Object.keys(locale.fields).length, 8);
  }
  assert.equal(ar.challenges[0], 'احكي مع شخص أول مرة بتشوفه');
  assert.equal(ar.challenges[15], 'تعرّف على شخص جديد وخذ اسمه');
});
test('Week 1 keeps session management inside its activity pages and preserves original logos', () => {
  const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const page = source('features/week1/week1-page.tsx');
  assert.match(page, /<BrandLogo\s*\/>/);
  assert.match(page, /<ParentLogo\s*\/>/);
  assert.match(source('pages/public/syllabus-page.tsx'), /<Week1Entry\s*\/>/);
  assert.match(page, /activity === 'dataset' && <DatasetSubmissions\s*\/>/);
  assert.match(page, /activity === 'bingo' && <InlineBingoVerification\s*\/>/);
  assert.match(
    source('features/week1/dataset-submissions.tsx'),
    /auth.role === 'team' \? <SubmissionList/,
  );
  assert.doesNotMatch(
    source('features/portal/team-page.tsx'),
    /Week1OrganizerReview|week1-review|week1_datasets|week1_bingo_claims/,
  );
  assert.match(
    source('features/portal/team-page.tsx'),
    /<ActivityEditor data={data} reload={reload}/,
  );
  assert.match(
    source('features/portal/team-page.tsx'),
    /<RubricEditor activity={a} data={data} reload={reload}/,
  );
  assert.match(
    source('features/week1/session-content.tsx'),
    /auth.role === 'team' \? \([\s\S]*?<PrivateSession/,
  );
  assert.doesNotMatch(page, /localStorage|service_role/);
  assert.match(page, /className="week1-page"/);
  assert.match(page, /className="s-cards"/);
  assert.match(page, /s-card week1-activity-card/);
  assert.doesNotMatch(page, /className="portal-page week1-page"/);
});
