import { BookOpen, CalendarDays, Check, Laptop, Users, Layers, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { syllabus } from '@/content/public-content';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PageContainer } from '@/components/shared/page-container';
import { PageHeader } from '@/components/shared/page-header';
import { SectionHeading } from '@/components/shared/section-heading';
import { MixedText } from '@/components/shared/mixed-text';
import { Reveal } from '@/components/shared/reveal';
import { JoinCallout, ProgramFacts } from '@/components/shared/academy-content';

export function SyllabusPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader
        eyebrow={t('nav.eda')}
        title={t('academy.syllabus.title')}
        description={t('academy.syllabus.overviewText')}
        icon={BookOpen}
      />
      <div className="syllabus-summary">
        <Badge variant="outline">{t('academy.syllabus.draft')}</Badge>
        <p>
          <MixedText>{t('home.beginner')}</MixedText>
        </p>
      </div>
      <ProgramFacts />
      <Reveal>
        <section className="public-section syllabus-overview">
          <div>
            <SectionHeading title={t('academy.syllabus.overviewTitle')} />
            <p>
              <MixedText>{t('academy.syllabus.overviewText')}</MixedText>
            </p>
            <div className="tool-chips" aria-label={t('academy.syllabus.toolsTitle')}>
              {syllabus.tools.map((tool) => (
                <bdi dir="ltr" key={tool}>
                  {tool}
                </bdi>
              ))}
            </div>
            <p className="small-note">{t('academy.syllabus.language')}</p>
          </div>
          <div className="content-card">
            <h2>{t('academy.syllabus.objectivesTitle')}</h2>
            <ul className="check-list">
              {(['colab', 'pandas', 'clean', 'patterns', 'present'] as const).map((id) => (
                <li key={id}>
                  <Check aria-hidden="true" />
                  <span>
                    <MixedText>{t(`academy.syllabus.objectives.${id}`)}</MixedText>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </Reveal>
      <div className="two-card-grid">
        {(
          [
            { id: 'who', icon: Users },
            { id: 'prerequisites', icon: Laptop },
          ] as const
        ).map(({ id, icon: Icon }) => (
          <Reveal key={id}>
            <section className="content-card detail-card">
              <Icon className="icon-tile" aria-hidden="true" />
              <div>
                <h2>{t(`academy.syllabus.${id}Title`)}</h2>
                <p>
                  <MixedText>{t(`academy.syllabus.${id}Text`)}</MixedText>
                </p>
              </div>
            </section>
          </Reveal>
        ))}
      </div>
      <section className="public-section" id="weekly-modules">
        <SectionHeading
          eyebrow={t('academy.home.journeyEyebrow')}
          title={t('academy.syllabus.weeklyTitle')}
          description={t('academy.syllabus.weeklyText')}
        />
        <Accordion type="multiple" defaultValue={['python1']} className="syllabus-timeline">
          {syllabus.modules.map((module) => (
            <AccordionItem value={module.id} key={module.id}>
              <AccordionTrigger>
                <span className="week-marker">
                  <span>{t('academy.week')}</span>
                  <bdi dir="ltr">{module.week}</bdi>
                </span>
                <span className="week-title">
                  <MixedText>{t(`academy.modules.${module.id}.title`)}</MixedText>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <MixedText>{t(`academy.modules.${module.id}.description`)}</MixedText>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <div className="buffer-note">
          <Layers aria-hidden="true" />
          <div>
            <h3>{t('academy.syllabus.bufferTitle')}</h3>
            <p>{t('academy.syllabus.bufferText')}</p>
          </div>
        </div>
      </section>
      <Reveal>
        <section className="public-section split-section outcomes-section">
          <div>
            <p className="eyebrow">{t('academy.syllabus.outcomesTitle')}</p>
            <h2>{t('academy.home.programCaption')}</h2>
            <p>
              <MixedText>{t('academy.syllabus.outcomesText')}</MixedText>
            </p>
          </div>
          <div className="content-card method-card">
            <h2>{t('academy.syllabus.methodTitle')}</h2>
            <p className="method-steps">{t('academy.syllabus.methodSteps')}</p>
            <p>
              <MixedText>{t('academy.syllabus.methodText')}</MixedText>
            </p>
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="project-feature">
          <Flag className="icon-tile" aria-hidden="true" />
          <div>
            <p className="eyebrow">
              {t('academy.week')} <bdi dir="ltr">06</bdi>
            </p>
            <h2>
              <MixedText>{t('academy.syllabus.projectTitle')}</MixedText>
            </h2>
            <p>
              <MixedText>{t('academy.syllabus.projectText')}</MixedText>
            </p>
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="schedule-panel public-section">
          <CalendarDays className="icon-tile" aria-hidden="true" />
          <div>
            <p className="eyebrow">{t('academy.syllabus.scheduleTitle')}</p>
            <h2>
              <MixedText>{t('academy.syllabus.schedule')}</MixedText>
            </h2>
            <p>{t('academy.syllabus.scheduleText')}</p>
          </div>
        </section>
      </Reveal>
      <JoinCallout />
    </PageContainer>
  );
}
