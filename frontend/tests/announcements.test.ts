import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyAnnouncement,
  validateAnnouncement,
} from '../src/features/portal/announcement-validation.ts';

const valid = {
  title_ar: 'لقاء الأكاديمية',
  title_en: 'Academy session',
  body_ar: 'أهلًا بكم في اللقاء القادم.',
  body_en: 'Join our next session.',
};
test('announcements require a nonblank title and body in both languages', () => {
  assert.equal(Object.keys(validateAnnouncement(emptyAnnouncement)).length, 4);
  for (const name of Object.keys(valid)) {
    assert.deepEqual(validateAnnouncement({ ...valid, [name]: ' \n\t ' }), {
      [name]: 'announcementRequired',
    });
  }
  assert.deepEqual(validateAnnouncement(valid), {});
});
test('announcement limits match the existing bilingual database constraints', () => {
  for (const name of Object.keys(valid)) {
    const title = name.startsWith('title_');
    const maximum = title ? 200 : 5000;
    assert.deepEqual(validateAnnouncement({ ...valid, [name]: 'ع'.repeat(maximum) }), {});
    assert.deepEqual(validateAnnouncement({ ...valid, [name]: 'ع'.repeat(maximum + 1) }), {
      [name]: title ? 'announcementTitleLength' : 'announcementBodyLength',
    });
  }
  assert.deepEqual(validateAnnouncement({ ...valid, title_en: '  Academy session  ' }), {});
});
