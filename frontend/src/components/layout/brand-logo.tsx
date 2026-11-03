import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import iAnalyzeLight from '@/assets/brand/ianalyze-on-light.png';
import iAnalyzeDark from '@/assets/brand/ianalyze-on-dark.png';
import iTeamLight from '@/assets/brand/iteam-logo-light.png';
import iTeamDark from '@/assets/brand/iteam-logo-transparent-ready.png';

function ThemeLogo({
  light,
  dark,
  alt,
  lazy = false,
  dimensions,
}: {
  light: string;
  dark: string;
  alt: string;
  lazy?: boolean;
  dimensions?: readonly [number, number];
}) {
  return (
    <span
      className="theme-logo"
      role="img"
      aria-label={alt}
      style={dimensions ? { aspectRatio: `${dimensions[0]} / ${dimensions[1]}` } : undefined}
    >
      <img
        className="theme-logo-light"
        src={light}
        alt=""
        aria-hidden="true"
        width={dimensions?.[0] ?? 640}
        height={dimensions?.[1] ?? 213}
        loading={lazy ? 'lazy' : 'eager'}
      />
      <img
        className="theme-logo-dark"
        src={dark}
        alt=""
        aria-hidden="true"
        width={dimensions?.[0] ?? 640}
        height={dimensions?.[1] ?? 213}
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
export function ParentLogo({ transparent = false }: { transparent?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="parent-logo">
      <ThemeLogo
        light={transparent ? iTeamDark : iTeamLight}
        dark={iTeamDark}
        alt={t('brand.parentAlt')}
        dimensions={[1536, 668]}
        lazy
      />
    </span>
  );
}
