import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldTransitionPage } from '../src/app/page-transition.ts';

test('public navigation and browser history animate across actual pages', () => {
  for (const type of ['PUSH', 'POP'])
    for (const path of ['/eda', '/about', '/ai-tools', '/ai-tools/python', '/videos', '/contact']) {
      assert.equal(shouldTransitionPage('/', path, type), true, `${type} ${path}`);
      assert.equal(shouldTransitionPage(path, '/', type), true, `${type} home`);
    }
});

test('same-page updates and redirect replacements do not animate', () => {
  // Only pathname is passed: language, theme, query, hash and auth updates cannot trigger it.
  for (const type of ['PUSH', 'POP', 'REPLACE']) {
    assert.equal(shouldTransitionPage('/about', '/about', type), false);
    assert.equal(shouldTransitionPage('/about', '/about/', type), false);
    assert.equal(shouldTransitionPage('/', '/', type), false);
  }
  assert.equal(shouldTransitionPage('/about', '/eda', 'REPLACE'), false);
});

test('auth, protected pages and aliases remain immediate in both directions', () => {
  for (const path of [
    '/login',
    '/join',
    '/auth/callback',
    '/auth/recover',
    '/auth/reset',
    '/student',
    '/workspace',
    '/profile',
    '/profile/edit',
    '/notifications',
    '/team',
    '/_preview/student',
  ])
    for (const type of ['PUSH', 'POP', 'REPLACE']) {
      assert.equal(shouldTransitionPage('/', path, type), false, path);
      assert.equal(shouldTransitionPage(path, '/about', type), false, path);
    }
});
