import { Compass, Target, Eye, Lightbulb, Users, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/shared/page-container';
import { PageHeader } from '@/components/shared/page-header';
import { MixedText } from '@/components/shared/mixed-text';
import { Reveal } from '@/components/shared/reveal';
import { JoinCallout, TextLink } from '@/components/shared/academy-content';
import { ParentLogo } from '@/components/layout/brand-logo';

const principles = [
  { id: 'mission', icon: Target },
  { id: 'vision', icon: Eye },
  { id: 'objectives', icon: Compass },
  { id: 'doing', icon: Lightbulb },
  { id: 'community', icon: Users },
  { id: 'past', icon: BookOpen },
] as const;

export function AboutPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader
        eyebrow={t('nav.about')}
        title={t('pages.about.title')}
        description={t('pages.about.description')}
        icon={Compass}
      />
      <Reveal>
        <section className="about-introduction">
          <div>
            <p className="eyebrow">{t('academy.about.whoTitle')}</p>
            <h2>{t('academy.home.aboutTitle')}</h2>
            <p>
              <MixedText>{t('academy.about.whoText')}</MixedText>
            </p>
          </div>
          <aside className="parent-story">
            <ParentLogo transparent />
            <h2>
              <MixedText>{t('academy.about.parentTitle')}</MixedText>
            </h2>
            <p>
              <MixedText>{t('academy.about.parentText')}</MixedText>
            </p>
          </aside>
        </section>
      </Reveal>
      <section className="public-section principle-grid">
        {principles.map(({ id, icon: Icon }) => (
          <Reveal key={id}>
            <article className="content-card principle-card interactive-card">
              <Icon className="icon-tile" aria-hidden="true" />
              <h2>{t(`academy.about.${id}Title`)}</h2>
              <p>
                <MixedText>{t(`academy.about.${id}Text`)}</MixedText>
              </p>
              {id === 'past' && <TextLink to="/contact">{t('nav.contact')}</TextLink>}
            </article>
          </Reveal>
        ))}
      </section>
      <JoinCallout />
    </PageContainer>
  );
}
