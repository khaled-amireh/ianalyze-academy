import test from 'node:test';
import assert from 'node:assert/strict';
import { readPreference, savePreference, type PreferenceStorage } from '../src/lib/preferences.ts';

test('valid saved preferences are restored; invalid values use the configured default', () => {
  const store = { getItem: () => 'en', setItem: () => {} };
  assert.equal(readPreference('language', ['ar', 'en'], 'ar', store), 'en');
  assert.equal(readPreference('theme', ['light', 'dark'], 'light', store), 'light');
  assert.equal(
    readPreference('language', ['ar', 'en'], 'ar', { ...store, getItem: () => null }),
    'ar',
  );
});
test('unavailable or blocked storage never prevents using the interface', () => {
  const blocked: PreferenceStorage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(readPreference('theme', ['light', 'dark'], 'light', blocked), 'light');
  assert.doesNotThrow(() => savePreference('theme', 'dark', blocked));
  assert.equal(readPreference('language', ['ar', 'en'], 'ar'), 'ar');
});
test('saving a preference uses only its explicit key', () => {
  const values = new Map<string, string>();
  const store = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  savePreference('ianalyze.language', 'en', store);
  assert.deepEqual([...values], [['ianalyze.language', 'en']]);
});
