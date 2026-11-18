import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assignmentValidation, assignmentError } from '../src/features/assignments/domain.ts';
import { draftEqual, forbiddenField } from '../src/features/drafts/fields.ts';
test('the reported 53-second overrun has a precise validation error and exact deadline equality is valid', () => {
  const value = {
    publish_at: '2026-11-15T15:56:49+03:00',
    due_at: '2026-11-22T15:56:57+03:00',
    reference_links: '',
    phases: [
      {
        name: 'Phase',
        start: '2026-11-15T15:57:45+03:00',
        end: '2026-11-22T15:57:50+03:00',
        points: 17.29,
      },
    ],
  };
  assert.equal(assignmentValidation(value), 'phaseWindow');
  assert.equal(
    assignmentValidation({ ...value, phases: [{ ...value.phases[0]!, end: value.due_at }] }),
    null,
  );
  assert.equal(
    assignmentValidation({ ...value, phases: [{ ...value.phases[0]!, points: -1 }] }),
    'invalidConfiguration',
  );
});
test('safe error categories cover conflicts, authorization, expired sessions, network and server validation', () => {
  for (const [error, key] of [
    [{ code: '40001' }, 'conflict'],
    [{ code: '42501' }, 'unauthorized'],
    [{ code: 'PGRST301' }, 'expiredSession'],
    [new TypeError('Failed to fetch'), 'networkError'],
    [{ code: '22023', message: 'Phases must fit publication/deadline window' }, 'phaseWindow'],
  ] as const)
    assert.equal(assignmentError(error), key);
  assert.equal(assignmentError({ message: 'PRIVATE DATABASE DETAIL' }), 'error');
});
test('draft comparisons use JSON values, not property ordering; authentication controls are excluded', () => {
  assert.ok(
    draftEqual(
      { fields: { a: 'x', b: 'y' }, extra: [1, 2] },
      { extra: [1, 2], fields: { b: 'y', a: 'x' } },
    ),
  );
  assert.equal(draftEqual({ a: 1 }, { a: 2 }), false);
  for (const name of [
    'password',
    'confirmation',
    'access_token',
    'refresh_token',
    'authorization',
    'cache_key',
  ])
    assert.ok(forbiddenField.test(name));
  assert.equal(forbiddenField.test('feedback'), false);
});
test('draft status translations have identical keys and never promise file persistence', () => {
  const load = (lang: string) =>
    JSON.parse(
      readFileSync(new URL(`../src/locales/drafts.${lang}.json`, import.meta.url), 'utf8'),
    );
  const en = load('en'),
    ar = load('ar');
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
  assert.match(en.reselectFile, /not stored/);
  assert.ok(ar.reselectFile.trim());
});
