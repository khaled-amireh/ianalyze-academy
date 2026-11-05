export const emptyAnnouncement = { title_ar: '', title_en: '', body_ar: '', body_en: '' };
export type AnnouncementValues = typeof emptyAnnouncement;
type AnnouncementError =
  'announcementRequired' | 'announcementTitleLength' | 'announcementBodyLength';

export function validateAnnouncement(values: AnnouncementValues) {
  const errors: Partial<Record<keyof AnnouncementValues, AnnouncementError>> = {};
  for (const name of Object.keys(emptyAnnouncement) as (keyof AnnouncementValues)[]) {
    const value = values[name].trim();
    const title = name.startsWith('title_');
    if (!value) errors[name] = 'announcementRequired';
    else if (Array.from(value).length > (title ? 200 : 5000))
      errors[name] = title ? 'announcementTitleLength' : 'announcementBodyLength';
  }
  return errors;
}
