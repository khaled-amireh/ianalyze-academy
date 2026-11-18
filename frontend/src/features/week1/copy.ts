import { useTranslation } from 'react-i18next';
import { isIgnoredClaim } from './domain';
import type { Claim } from './data';
export function claimStatusText(claim: Claim, c: ReturnType<typeof useWeek1Copy>['c']) {
  return isIgnoredClaim(claim)
    ? c.ignored
    : c.states[claim.status as 'pending' | 'verified' | 'rejected'];
}
export function useWeek1Copy() {
  const { t, i18n } = useTranslation();
  return { c: t('week1', { returnObjects: true }), arabic: i18n.resolvedLanguage === 'ar' };
}
export function formatTime(value: string, arabic: boolean) {
  return new Intl.DateTimeFormat(arabic ? 'ar-JO' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Amman',
  }).format(new Date(value));
}
