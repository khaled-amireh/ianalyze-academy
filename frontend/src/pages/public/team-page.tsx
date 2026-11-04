import { Users } from 'lucide-react';
import { LinkedinIcon } from '@/components/shared/social-icons';
import { useTranslation } from 'react-i18next';
import { leaders } from '@/content/public-content';
import { PageContainer } from '@/components/shared/page-container';
import { PageHeader } from '@/components/shared/page-header';
import { Reveal } from '@/components/shared/reveal';
import { MixedText } from '@/components/shared/mixed-text';
import { TextLink } from '@/components/shared/academy-content';

export function TeamPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader
        eyebrow={t('nav.team')}
        title={t('pages.team.title')}
        description={t('pages.team.description')}
        icon={Users}
      />
      <div className="leaders-grid">
        {leaders.map((leader) => (
          <Reveal key={leader.id}>
            <article className={`leader-card interactive-card leader-${leader.id}`}>
              <div className="leader-image">
                <img
                  src={leader.photo}
                  alt={t('academy.team.portrait', { name: t(`academy.team.${leader.id}`) })}
                  width={leader.width}
                  height={leader.height}
                  loading="lazy"
                />
              </div>
              <div className="leader-info">
                <h2>
                  <MixedText>{t(`academy.team.${leader.id}`)}</MixedText>
                </h2>
                <p>
                  <MixedText>
                    {t(
                      leader.id === 'yomna'
                        ? 'academy.team.educationFemale'
                        : 'academy.team.education',
                    )}
                  </MixedText>
                </p>
                <a
                  className="team-linkedin"
                  href={leader.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`LinkedIn · ${t(`academy.team.${leader.id}`)}`}
                >
                  <LinkedinIcon />
                  <span className="sr-only">LinkedIn</span>
                </a>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      <section className="public-section team-community">
        <Users className="icon-tile" aria-hidden="true" />
        <h2>{t('academy.team.communityTitle')}</h2>
        <p>
          <MixedText>{t('academy.team.communityText')}</MixedText>
        </p>
        <TextLink to="/about">{t('academy.readMore')}</TextLink>
      </section>
    </PageContainer>
  );
}
