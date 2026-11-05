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
