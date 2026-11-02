import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAll } from '../src/lib/fetch-all.ts';
test('Team data pagination reads beyond the server response cap and handles smaller server pages', async () => {
  const source = Array.from({ length: 1203 }, (_, id) => ({ id }));
  let requests = 0;
  const rows = await fetchAll(async (start, end) => {
    requests++;
    return {
      data: source.slice(start, Math.min(end + 1, start + 100)),
      count: source.length,
      error: null,
    };
  });
  assert.deepEqual(rows, source);
  assert.equal(requests, 13);
});
test('pagination fails explicitly on missing counts, denied requests or a changing empty page', async () => {
  await assert.rejects(fetchAll(async () => ({ data: [], count: null, error: null })));
  await assert.rejects(fetchAll(async () => ({ data: null, count: null, error: {} })));
  await assert.rejects(fetchAll(async () => ({ data: [], count: 1, error: null })));
});
