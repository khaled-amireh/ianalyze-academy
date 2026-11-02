import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import iAnalyzeLight from '@/assets/brand/ianalyze-on-light.png';
import iAnalyzeDark from '@/assets/brand/ianalyze-on-dark.png';
import iTeamLight from '@/assets/brand/iteam-on-light.png';
import iTeamDark from '@/assets/brand/iteam-on-dark.png';

function ThemeLogo({
  light,
  dark,
  alt,
  lazy = false,
}: {
  light: string;
  dark: string;
  alt: string;
  lazy?: boolean;
}) {
  return (
    <span className="theme-logo" role="img" aria-label={alt}>
      <img
        className="theme-logo-light"
        src={light}
        alt=""
        aria-hidden="true"
        width={640}
        height={213}
        loading={lazy ? 'lazy' : 'eager'}
      />
      <img
        className="theme-logo-dark"
        src={dark}
        alt=""
        aria-hidden="true"
        width={640}
        height={213}
        loading={lazy ? 'lazy' : 'eager'}
      />
    </span>
  );
}

export function BrandLogo() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="brand-logo" aria-label={t('brand.home')}>
      <ThemeLogo light={iAnalyzeLight} dark={iAnalyzeDark} alt={t('brand.logoAlt')} />
    </Link>
  );
}
export function ParentLogo() {
  const { t } = useTranslation();
  return (
    <span className="parent-logo">
      <ThemeLogo light={iTeamLight} dark={iTeamDark} alt={t('brand.parentAlt')} lazy />
    </span>
  );
}
