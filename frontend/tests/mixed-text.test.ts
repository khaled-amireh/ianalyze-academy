import test from 'node:test';
import assert from 'node:assert/strict';
import { splitMixedText } from '../src/lib/mixed-text.ts';

test('English phrases with punctuation remain in one LTR run in Arabic context', () => {
  const text = 'بداية: Hello, Python.';
  const parts = splitMixedText(text);
  assert.deepEqual(
    parts.filter((p) => p.isolated).map((p) => p.value),
    ['Hello, Python.'],
  );
  assert.equal(parts.map((p) => p.value).join(''), text);
});
test('Arabic words stay outside technical terms and numeric ranges', () => {
  const text = 'تعلّم Python وPandas من 10:00–13:00';
  const parts = splitMixedText(text);
  assert.deepEqual(
    parts.filter((p) => p.isolated).map((p) => p.value.trim()),
    ['Python', 'Pandas', '10:00–13:00'],
  );
  assert.equal(parts.map((p) => p.value).join(''), text);
});
