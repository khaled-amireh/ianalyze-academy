import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import iAnalyze from '@/assets/ianalyze-logo.png';
import iTeam from '@/assets/iteam-logo.png';

export function BrandLogo() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="brand-logo" aria-label={t('brand.home')}>
      <img src={iAnalyze} alt={t('brand.logoAlt')} width={2172} height={724} />
    </Link>
  );
}
export function ParentLogo() {
  const { t } = useTranslation();
  return (
    <span className="parent-logo">
      <img src={iTeam} alt={t('brand.parentAlt')} width={2172} height={724} />
    </span>
  );
}
