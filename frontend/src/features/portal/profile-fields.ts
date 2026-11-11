import { normalizeJordanianMobile } from '../../lib/jordanian-phone.ts';
import type { ProfilePatch } from '../../lib/academy-data.ts';

export const ZUJ = 'Al-Zaytoonah University of Jordan';
export const majors = [
  { value: 'Software Engineering', ar: 'هندسة البرمجيات' },
  { value: 'Data Science & Artificial Intelligence', ar: 'علم البيانات والذكاء الاصطناعي' },
  { value: 'Cyber Security', ar: 'الأمن السيبراني' },
  { value: 'Computer Science', ar: 'علم الحاسوب' },
] as const;
export function majorLabel(value: string | null, arabic: boolean) {
  return (arabic ? majors.find((m) => m.value === value)?.ar : null) ?? value;
}
export function selectedMajor(value: string | null) {
  return !value ? '' : majors.some((m) => m.value === value) ? value : 'other';
}
export function profileMajor(form: FormData) {
  return String(form.get(form.get('major') === 'other' ? 'major_other' : 'major') ?? '').trim();
}

// Omit unchanged fields, including historical nulls, so editing never resets profile data.
export function profilePatch(
  form: FormData,
  existing: ProfilePatch,
  registering: boolean,
): ProfilePatch {
  const text = (name: string) => String(form.get(name) ?? '').trim();
  const next: ProfilePatch = {
    full_name: text('full_name') || null,
    whatsapp:
      text('whatsapp') === existing.whatsapp
        ? existing.whatsapp
        : normalizeJordanianMobile(text('whatsapp')),
    major: profileMajor(form) || null,
    academic_year: text('academic_year') ? Number(text('academic_year')) : null,
    python_experience: (text('python_experience') || null) as ProfilePatch['python_experience'],
    university_id: text('university_id') || null,
    locale: text('locale') === 'en' ? 'en' : 'ar',
    ...(registering ? { university: ZUJ } : {}),
  };
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => value !== existing[key as keyof ProfilePatch]),
  );
}
