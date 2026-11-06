import { Link } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { learningTools } from '@/content/learning-tools';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/shared/page-container';
import { MixedText } from '@/components/shared/mixed-text';

export function AiToolsPage() {
  const { t } = useTranslation();
  return (
    <PageContainer className="learning-page">
      <header className="s-page-head">
        <h1 className="resource-copy" id="page-title" tabIndex={-1}>
          {t('nav.aiTools')}
        </h1>
        <p className="s-lede resource-copy">
          <MixedText>{t('learning.toolsIntro')}</MixedText>
        </p>
      </header>
      <p className="learning-course-note resource-copy">
        <MixedText>{t('learning.courseNote')}</MixedText>
      </p>
      <div className="s-cards learning-tools-grid">
        {learningTools.map((tool) => (
          <article className="s-card learning-tool" key={tool.id} data-tool={tool.id}>
            <p className="learning-tag resource-copy">
              {t(`learning.categories.${tool.category}`)}
            </p>
            <h2 className="resource-copy">
              <bdi dir="ltr">{tool.name}</bdi>
            </h2>
            <p className="resource-copy">
              <MixedText>{t(`learning.tools.${tool.id}.description`)}</MixedText>
            </p>
            <dl className="resource-copy">
              <dt>{t('learning.why')}</dt>
              <dd>
                <MixedText>{t(`learning.tools.${tool.id}.why`)}</MixedText>
              </dd>
            </dl>
            <p className="learning-meta resource-copy">
              <MixedText>{`${t(`learning.modes.${tool.mode}`)} · ${t(`learning.platforms.${tool.platform}`)}`}</MixedText>
            </p>
            <div className="resource-actions">
              <Button asChild size="sm">
                <Link to={`/ai-tools/${tool.id}`}>{t('learning.viewGuide')}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={tool.href} target="_blank" rel="noopener noreferrer">
                  <MixedText>{t(`learning.tools.${tool.id}.open`)}</MixedText>
                  <ExternalLink aria-hidden="true" />
                </a>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </PageContainer>
  );
}
