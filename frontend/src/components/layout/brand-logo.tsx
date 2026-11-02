import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import iAnalyze from '@/assets/ianalyze-logo-small.png';
import iTeam from '@/assets/iteam-logo-small.png';

export function BrandLogo() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="brand-logo" aria-label={t('brand.home')}>
      <img src={iAnalyze} alt={t('brand.logoAlt')} width={480} height={160} />
    </Link>
  );
}
export function ParentLogo() {
  const { t } = useTranslation();
  return (
    <span className="parent-logo">
      <img src={iTeam} alt={t('brand.parentAlt')} width={480} height={160} loading="lazy" />
    </span>
  );
}
