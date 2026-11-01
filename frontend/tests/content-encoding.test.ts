import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([key, item]) => strings(item, `${path}.${key}`));
  return [];
}

test('public translations preserve Unicode rather than replacement characters', () => {
  for (const locale of ['ar', 'en']) {
    const entries = strings(
      JSON.parse(readFileSync(new URL(`../src/locales/${locale}.json`, import.meta.url), 'utf8')),
    );
    for (const [key, text] of entries) {
      assert.ok(!/[\uFFFD]|\?{2,}/.test(text), `Corrupted ${locale} text: ${key}`);
      if (locale === 'ar') assert.ok(!text.includes('?'), `ASCII replacement in Arabic: ${key}`);
      else assert.ok(!/\?[a-zA-Z0-9]/.test(text), `Corrupted English punctuation: ${key}`);
    }
  }
});

test('Arabic public content is translated, with the owner-supplied profile names preserved', () => {
  const ar = JSON.parse(
    readFileSync(new URL('../src/locales/ar.json', import.meta.url), 'utf8'),
  ) as { academy: unknown };
  for (const [key, text] of strings(ar.academy))
    if (!['.team.khaled', '.team.yomna'].includes(key))
      assert.ok(/[\u0600-\u06FF]/.test(text), `Missing Arabic content: ${key}`);
});
