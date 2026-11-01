import { ArrowRight, Check, BookOpen, Play, Users, Code2, ChartNoAxesCombined } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageContainer } from '@/components/shared/page-container';
import { MixedText } from '@/components/shared/mixed-text';
import { DataStory } from '@/components/shared/data-story';
import { Reveal } from '@/components/shared/reveal';
import {
  JoinCallout,
  ModuleCards,
  ProgramFacts,
  TextLink,
} from '@/components/shared/academy-content';
import { SectionHeading } from '@/components/shared/section-heading';
import { syllabus } from '@/content/public-content';

export function HomePage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <section className="hero">
        <div
          className="hero-copy stagger-enter"
          onFocusCapture={(event) =>
            event.currentTarget
              .getAnimations({ subtree: true })
              .forEach((animation) => animation.cancel())
          }
        >
          <p className="eyebrow line-label">{t('home.eyebrow')}</p>
          <h1 id="page-title" tabIndex={-1}>
            <span>{t('home.titleFirst')}</span>
            <span className="hero-emphasis">{t('home.titleSecond')}</span>
          </h1>
          <p className="lede">{t('home.description')}</p>
          <div className="hero-actions">
            <Button asChild>
              <Link to="/join">
                <span>
                  <MixedText>{t('home.primary')}</MixedText>
                </span>
                <ArrowRight className="directional" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/eda">
                <span>
                  <MixedText>{t('home.secondary')}</MixedText>
                </span>
                <ArrowRight className="directional" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <p className="check-note">
            <Check aria-hidden="true" />
            <span>
              <MixedText>{t('home.beginner')}</MixedText>
            </span>
          </p>
        </div>
        <DataStory />
      </section>
      <Reveal>
        <section className="facts-strip" aria-label={t('home.factsLabel')}>
          <div className="fact-intro">
            <BookOpen aria-hidden="true" />
            <span>
              <MixedText>{t('home.factsLabel')}</MixedText>
            </span>
          </div>
          {[syllabus.teachingWeeks, syllabus.plannedHours, syllabus.bufferWeeks].map((value, i) => (
            <div key={value}>
              <strong dir="ltr">{String(value).padStart(2, '0')}</strong>
              <span>{t('home.facts', { returnObjects: true })[i]}</span>
            </div>
          ))}
        </section>
      </Reveal>
      <Reveal>
        <section className="public-section about-preview split-section">
          <div>
            <p className="eyebrow line-label">{t('academy.home.aboutEyebrow')}</p>
            <h2>{t('academy.home.aboutTitle')}</h2>
          </div>
          <div>
            <p>
              <MixedText>{t('academy.home.aboutText')}</MixedText>
            </p>
            <TextLink to="/about">{t('academy.readMore')}</TextLink>
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="featured-program">
          <div className="program-visual" aria-hidden="true">
            <div className="program-orbit">
              <Code2 />
              <span>01</span>
              <ChartNoAxesCombined />
            </div>
            <p>{t('academy.home.programCaption')}</p>
            <div className="tool-chips">
              {syllabus.tools.map((tool) => (
                <bdi key={tool} dir="ltr">
                  {tool}
                </bdi>
              ))}
            </div>
          </div>
          <div className="program-copy">
            <p className="eyebrow">{t('academy.home.programEyebrow')}</p>
            <Badge variant="secondary">{t('academy.home.beginnerLabel')}</Badge>
            <h2>
              <MixedText>{t('academy.home.programTitle')}</MixedText>
            </h2>
            <p>
              <MixedText>{t('academy.home.programText')}</MixedText>
            </p>
            <ProgramFacts />
            <TextLink to="/eda">{t('academy.fullSyllabus')}</TextLink>
          </div>
        </section>
      </Reveal>
      <section className="public-section">
        <SectionHeading
          eyebrow={t('academy.home.journeyEyebrow')}
          title={t('academy.home.journeyTitle')}
          description={t('academy.home.journeyText')}
        />
        <ModuleCards />
      </section>
      <Reveal>
        <section className="resource-feature">
          <div className="resource-art" aria-hidden="true">
            <Play />
            <span>Data Science</span>
            <i />
            <i />
          </div>
          <div>
            <p className="eyebrow">{t('academy.home.resourceEyebrow')}</p>
            <h2>{t('academy.home.resourceTitle')}</h2>
            <p>
              <MixedText>{t('academy.home.resourceText')}</MixedText>
            </p>
            <TextLink to="/videos">{t('academy.watch')}</TextLink>
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="public-section community-section">
          <Users className="icon-tile" aria-hidden="true" />
          <p className="eyebrow">{t('academy.home.communityEyebrow')}</p>
          <h2>{t('academy.home.communityTitle')}</h2>
          <p>{t('academy.home.communityText')}</p>
        </section>
      </Reveal>
      <JoinCallout />
    </PageContainer>
  );
}
