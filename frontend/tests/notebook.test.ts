import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_NOTEBOOK_BYTES,
  notebookDigest,
  readBoundedBody,
  validateNotebook,
} from '../../supabase/functions/_shared/notebook.ts';
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const valid = () => ({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {},
  cells: [
    {
      id: 'code-1',
      cell_type: 'code',
      metadata: {},
      source: ['print("hello")'],
      execution_count: null,
      outputs: [],
    },
  ],
});
test('notebook validator accepts a real structure without executing notebook code', () => {
  const notebook = valid();
  notebook.cells[0]!.source = ['globalThis.NOTEBOOK_EXECUTED = true'];
  assert.ok(validateNotebook(encode(notebook), 'work.ipynb'));
  assert.equal('NOTEBOOK_EXECUTED' in globalThis, false);
});
test('notebook size is enforced on actual bytes, including exact boundary', () => {
  const bytes = encode(valid());
  const padded = new Uint8Array(MAX_NOTEBOOK_BYTES).fill(32);
  padded.set(bytes);
  assert.doesNotThrow(() => validateNotebook(padded, 'work.ipynb'));
  assert.throws(() => validateNotebook(new Uint8Array(MAX_NOTEBOOK_BYTES + 1), 'work.ipynb'));
  assert.throws(() => validateNotebook(new Uint8Array(), 'work.ipynb'));
});
test('validator rejects forged extensions, UTF-8, JSON, versions, cells and oversized complexity', () => {
  for (const name of ['payload.html', 'work.ipynb.html', '../work.ipynb', 'work.ipynb\u0000'])
    assert.throws(() => validateNotebook(encode(valid()), name));
  for (const value of ['<html>bad</html>', 'null', '{"nbformat":4}', new Uint8Array([255, 254])])
    assert.throws(() =>
      validateNotebook(
        typeof value === 'string' ? new TextEncoder().encode(value) : value,
        'work.ipynb',
      ),
    );
  const bads: unknown[] = [
    { ...valid(), nbformat: 3 },
    { ...valid(), nbformat_minor: 6 },
    { ...valid(), cells: [{ id: 'a', cell_type: 'javascript', source: 'x', metadata: {} }] },
    { ...valid(), cells: [...valid().cells, ...valid().cells] },
    {
      ...valid(),
      cells: [{ ...valid().cells[0], outputs: [{ output_type: 'execute_result', data: null }] }],
    },
  ];
  for (const bad of bads) assert.throws(() => validateNotebook(encode(bad), 'work.ipynb'));
  let nested: unknown = {};
  for (let i = 0; i < 30; i++) nested = { nested };
  assert.throws(() => validateNotebook(encode({ ...valid(), metadata: nested }), 'work.ipynb'));
});
test('digest is deterministic; bounded streaming rejects an oversized body without trusting headers', async () => {
  const bytes = encode(valid());
  assert.match(await notebookDigest(bytes), /^[a-f0-9]{64}$/);
  assert.equal(await notebookDigest(bytes), await notebookDigest(bytes));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(200000));
      controller.enqueue(new Uint8Array(100000));
      controller.close();
    },
  });
  await assert.rejects(
    readBoundedBody(
      new Request('http://localhost', { method: 'POST', body, duplex: 'half' } as RequestInit),
    ),
    /large/,
  );
});
