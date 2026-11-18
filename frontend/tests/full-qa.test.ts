import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('assignment and session messages keep bilingual keys and real Arabic characters after UTF-8 writes', () => {
  const copy = (lang: string) =>
    JSON.parse(
      readFileSync(new URL(`../src/locales/assignments.${lang}.json`, import.meta.url), 'utf8'),
    ) as Record<string, string>;
  const ar = copy('ar'),
    en = copy('en');
  assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort());
  for (const [key, value] of Object.entries(ar)) {
    assert.ok(!/\?{2,}/.test(value), `${key} must not contain text replaced by encoding errors`);
    if (key !== 'timezone')
      assert.match(value, /[\u0600-\u06ff]/, `${key} must retain Arabic text`);
  }
});
