import { useTranslation } from 'react-i18next';
export function useAssignmentCopy() {
  const { t, i18n } = useTranslation();
  return {
    c: t('assignments', { returnObjects: true }) as typeof import('@/locales/assignments.en.json'),
    arabic: i18n.resolvedLanguage === 'ar',
  };
}
export function assignmentTime(value: string, arabic: boolean) {
  return new Intl.DateTimeFormat(arabic ? 'ar-JO' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Amman',
  }).format(new Date(value));
}
