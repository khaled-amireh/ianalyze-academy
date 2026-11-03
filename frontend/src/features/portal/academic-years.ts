export const academicYears = [1, 2, 3, 4, 5] as const;
const labels = {
  en: ['First Year', 'Second Year', 'Third Year', 'Fourth Year', 'Fifth Year'],
  ar: ['السنة الأولى', 'السنة الثانية', 'السنة الثالثة', 'السنة الرابعة', 'السنة الخامسة'],
};
export function academicYearLabel(year: number | null, arabic: boolean): string {
  if (year === null) return '—';
  return (
    labels[arabic ? 'ar' : 'en'][year - 1] ??
    `${arabic ? 'سنة محفوظة سابقًا' : 'Previously saved year'} (${new Intl.NumberFormat(arabic ? 'ar-JO' : 'en-GB').format(year)})`
  );
}
