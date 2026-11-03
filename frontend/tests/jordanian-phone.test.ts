import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeJordanianMobile } from '../src/lib/jordanian-phone.ts';
import { academicYears, academicYearLabel } from '../src/features/portal/academic-years.ts';

import { phoneCases } from './fixtures/jordanian-phones.ts';
test('Jordanian mobile normalization accepts the three formats and harmless separators, rejecting malformed or foreign input', () => {
  for (const [value, expected] of phoneCases)
    assert.equal(normalizeJordanianMobile(value), expected, value);
});
test('academic options are exactly five natural bilingual labels and historical values stay readable', () => {
  assert.deepEqual(academicYears, [1, 2, 3, 4, 5]);
  assert.equal(academicYearLabel(1, false), 'First Year');
  assert.equal(academicYearLabel(5, true), 'السنة الخامسة');
  assert.match(academicYearLabel(7, false), /Previously saved year/);
  assert.equal(academicYearLabel(null, true), '—');
});
