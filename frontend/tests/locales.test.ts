import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
function leaves(value: unknown, path = ''): string[] {
  if (value && typeof value === 'object')
    return Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([key, item]) => leaves(item, `${path}.${key}`));
  assert.ok(typeof value === 'string' && value.trim(), `Missing translation at ${path}`);
  return [path];
}
for (const directory of ['src/locales', 'src/dev/locales']) {
  test(`${directory}: Arabic and English have complete matching translation keys`, () => {
    const load = (locale: string) =>
      JSON.parse(
        readFileSync(new URL(`../${directory}/${locale}.json`, import.meta.url), 'utf8'),
      ) as unknown;
    assert.deepEqual(leaves(load('ar')), leaves(load('en')));
  });
}
