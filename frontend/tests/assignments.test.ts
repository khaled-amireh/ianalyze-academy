import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ammanInput,
  fromAmmanInput,
  submissionLink,
  educationalFile,
} from '../src/features/assignments/domain.ts';
test('Amman form values round-trip independently of the browser timezone and include seconds', () => {
  for (const value of [
    '2026-11-15T08:30:42.000Z',
    '2026-11-18T20:59:59.000Z',
    '2027-06-03T11:15:06.000Z',
  ])
    assert.equal(fromAmmanInput(ammanInput(value)), value);
  assert.equal(ammanInput('2026-11-18T20:59:59.000Z'), '2026-11-18T23:59:59');
});
test('submission links reject executable schemes, credentials, whitespace and overlong values', () => {
  for (const value of ['https://example.test/work', 'http://example.test/report?a=1'])
    assert.ok(submissionLink(value));
  for (const value of [
    'javascript:alert(1)',
    'https://user:password@example.test',
    'https://example.test\nhttps://elsewhere.test',
    'https://' + 'x'.repeat(2000),
    '',
  ])
    assert.equal(submissionLink(value), false);
});
test('educational file types and size align with server-side upload restrictions', () => {
  for (const name of ['report.PDF', 'data.csv', 'work.xlsx', 'dashboard.pbix', 'project.zip'])
    assert.ok(educationalFile({ name, type: '', size: 1024 }).mime);
  for (const file of [
    { name: 'bad.exe', type: 'application/pdf', size: 1 },
    { name: 'big.pdf', type: 'application/pdf', size: 20971521 },
    { name: 'empty.csv', type: 'text/csv', size: 0 },
  ])
    assert.throws(() => educationalFile(file));
});
test('assignment/session/ranking translations have equivalent keys and interpolation tokens', () => {
  const load = (locale: string) =>
    JSON.parse(
      readFileSync(new URL(`../src/locales/assignments.${locale}.json`, import.meta.url), 'utf8'),
    ) as Record<string, string>;
  const en = load('en'),
    ar = load('ar');
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
  for (const key of Object.keys(en)) {
    assert.ok(en[key]?.trim() && ar[key]?.trim());
    assert.deepEqual(en[key]!.match(/{{\w+}}/g), ar[key]!.match(/{{\w+}}/g));
    assert.ok(!ar[key]!.includes('\uFFFD'));
  }
});
