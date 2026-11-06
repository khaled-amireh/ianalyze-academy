import { Link, useParams } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { findLearningTool } from '@/content/learning-tools';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/shared/page-container';
import { MixedText } from '@/components/shared/mixed-text';
import { NotFoundPage } from './not-found-page';

export function ToolGuidePage() {
  const { t } = useTranslation();
  const { toolId } = useParams();
  const tool = findLearningTool(toolId);
  if (!tool) return <NotFoundPage />;
  const copy = t(`learning.tools.${tool.id}`, { returnObjects: true });
  const steps: Readonly<Record<string, string>> = copy.steps;
  return (
    <PageContainer className="learning-page learning-guide">
      <header className="s-page-head">
        <p className="s-eyebrow resource-copy">
          {t(tool.mode === 'online' ? 'learning.getStarted' : 'learning.installGuide')}
        </p>
        <h1 className="resource-copy" id="page-title" tabIndex={-1}>
          <bdi dir="ltr">{tool.name}</bdi>
        </h1>
        <p className="s-lede resource-copy">
          <MixedText>{copy.description}</MixedText>
        </p>
      </header>
      <section className="s-card guide-overview" aria-label={t('learning.requirements')}>
        <h2 className="resource-copy">{t('learning.why')}</h2>
        <p className="resource-copy">
          <MixedText>{copy.why}</MixedText>
        </p>
        <h2 className="resource-copy">{t('learning.requirements')}</h2>
        <p className="resource-copy">
          <MixedText>{copy.requirements}</MixedText>
        </p>
        <Button asChild size="sm">
          <a href={tool.href} target="_blank" rel="noopener noreferrer">
            <MixedText>{copy.open}</MixedText>
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </section>
      <section className="s-section" aria-labelledby="setup-title">
        <h2 className="resource-copy" id="setup-title">
          {t(tool.mode === 'online' ? 'learning.getStarted' : 'learning.setupSteps')}
        </h2>
        <ol className="guide-steps resource-copy">
          {tool.steps.map((step) => (
            <li key={step}>
              <MixedText>{steps[step] ?? ''}</MixedText>
            </li>
          ))}
        </ol>
      </section>
      <section className="s-card guide-verification" aria-labelledby="verification-title">
        <h2 className="resource-copy" id="verification-title">
          {t('learning.verify')}
        </h2>
        {tool.sample && (
          <pre>
            <code>{tool.sample}</code>
          </pre>
        )}
        <p className="resource-copy">
          <MixedText>{copy.verification}</MixedText>
        </p>
      </section>
      <div className="guide-links">
        <nav className="resource-actions" aria-label={t('learning.officialDocs')}>
          {tool.documentation.map((doc) => (
            <a key={doc.href} href={doc.href} target="_blank" rel="noopener noreferrer">
              <MixedText>{t(`learning.${doc.label}`)}</MixedText>
              <ExternalLink aria-hidden="true" />
            </a>
          ))}
        </nav>
        <Button asChild variant="outline" size="sm">
          <Link to="/ai-tools">{t('learning.backToTools')}</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
