import { Laptop, Users } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { syllabus } from '@/content/public-content';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/shared/page-container';
import { MixedText } from '@/components/shared/mixed-text';
import { VideoLibraryPreview } from '@/components/shared/learning-video';
import { CourseFacts, RegisterBand, WeekList } from '@/components/shared/simple-blocks';

// Hidden for now; set to true to show the week-by-week plan again.
const SHOW_WEEKLY_PLAN = false;

export function SyllabusPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <header className="s-page-head">
        <p className="s-eyebrow">{t('simple.courseEyebrow')}</p>
        <h1 id="page-title" tabIndex={-1}>
          <MixedText>{t('simple.courseTitle')}</MixedText>
        </h1>
        <p className="s-lede">
          <MixedText>{t('simple.courseText')}</MixedText>
        </p>
      </header>
      <CourseFacts wide />

      <div className="s-cards">
        {(
          [
            { id: 'who', icon: Users },
            { id: 'need', icon: Laptop },
          ] as const
        ).map(({ id, icon: Icon }) => (
          <section key={id} className={id === 'need' ? 's-card eda-tools-card' : 's-card'}>
            <Icon className="s-card-icon" aria-hidden="true" />
            <h2>{t(`simple.${id}Title`)}</h2>
            <p>
              <MixedText>{t(`simple.${id}Text`)}</MixedText>
            </p>
            {id === 'need' && (
              <Button asChild variant="outline" size="sm">
                <Link to="/ai-tools">{t('learning.viewTools')}</Link>
              </Button>
            )}
          </section>
        ))}
      </div>

      {SHOW_WEEKLY_PLAN && (
        <section className="s-section" id="weekly-modules">
          <div className="s-section-head">
            <div>
              <h2>{t('simple.planTitle')}</h2>
              <p className="s-muted">{t('simple.planText')}</p>
            </div>
          </div>
          <WeekList />
          <div className="s-tools" aria-label={t('simple.toolsTitle')}>
            {syllabus.tools.map((tool) => (
              <bdi dir="ltr" key={tool}>
                {tool}
              </bdi>
            ))}
          </div>
        </section>
      )}

      <VideoLibraryPreview />

      <RegisterBand />
    </PageContainer>
  );
}
