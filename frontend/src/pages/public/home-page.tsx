import { ArrowRight, Users } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/shared/page-container';
import { MixedText } from '@/components/shared/mixed-text';
import { Reveal } from '@/components/shared/reveal';
import { JoinCallout, TextLink } from '@/components/shared/academy-content';
import { leaders } from '@/content/public-content';

export function HomePage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{t('redesign.heroEyebrow')}</p>
          <h1 id="page-title" tabIndex={-1}>
            <span>{t('home.titleFirst')}</span>
            <span className="hero-emphasis">{t('home.titleSecond')}</span>
          </h1>
          <p className="lede">
            <MixedText>{t('home.description')}</MixedText>
          </p>
          <div className="hero-actions">
            <Button asChild size="lg">
              <Link to="/team">
                <MixedText>{t('redesign.meetTeam')}</MixedText>
                <ArrowRight className="directional" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/about">
                {t('nav.about')}
                <ArrowRight className="directional" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <Reveal>
        <section className="resource-feature">
          <Link to="/about" className="resource-art" aria-label={t('nav.about')}>
            <span className="resource-symbol" aria-hidden="true">
              <Users />
            </span>
            <span className="resource-art-title">
              <MixedText>{t('academy.home.aboutEyebrow')}</MixedText>
            </span>
            <span className="resource-art-caption">
              <MixedText>{t('brand.initiative')}</MixedText>
            </span>
          </Link>
          <div>
            <h2>{t('academy.home.resourceTitle')}</h2>
            <p>
              <MixedText>{t('academy.home.resourceText')}</MixedText>
            </p>
            <TextLink to="/about">{t('nav.about')}</TextLink>
          </div>
        </section>
      </Reveal>
      <section className="public-section community-feature">
        <div className="community-copy">
          <Users className="icon-tile" aria-hidden="true" />
          <h2>{t('academy.home.communityTitle')}</h2>
          <p>{t('academy.home.communityText')}</p>
          <TextLink to="/team">{t('redesign.meetTeam')}</TextLink>
        </div>
        <div className="community-portraits">
          {leaders.map((leader) => (
            <Link to="/team" key={leader.id} className={`community-person leader-${leader.id}`}>
              <div>
                <img
                  src={leader.photo}
                  alt={t('academy.team.portrait', { name: t(`academy.team.${leader.id}`) })}
                  width={leader.width}
                  height={leader.height}
                  loading="lazy"
                />
              </div>
              <span>
                <MixedText>{t(`academy.team.${leader.id}`)}</MixedText>
              </span>
              <small>
                {t(
                  leader.id === 'yomna' ? 'academy.team.educationFemale' : 'academy.team.education',
                )}
              </small>
            </Link>
          ))}
        </div>
      </section>
      <JoinCallout />
    </PageContainer>
  );
}
