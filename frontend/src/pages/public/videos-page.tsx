import { Library, BookOpen, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { introductoryVideo } from '@/content/public-content';
import { PageContainer } from '@/components/shared/page-container';
import { PageHeader } from '@/components/shared/page-header';
import { MixedText } from '@/components/shared/mixed-text';
import { TextLink } from '@/components/shared/academy-content';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export function VideosPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader
        eyebrow={t('nav.videos')}
        title={t('pages.videos.title')}
        description={t('pages.videos.description')}
        icon={Library}
      />
      <article className="video-feature">
        <div className="video-frame">
          <iframe
            src={introductoryVideo.embedUrl}
            title={t('academy.video.title')}
            loading="lazy"
            allow="fullscreen; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <div className="video-details">
          <div>
            <p className="eyebrow">
              <Play aria-hidden="true" />
              {t('academy.video.category')}
            </p>
            <h2>{t('academy.video.title')}</h2>
            <p>
              <MixedText>{t('academy.video.description')}</MixedText>
            </p>
          </div>
          <div className="video-fallback">
            <p>{t('academy.video.help')}</p>
            <Button asChild variant="outline">
              <a href={introductoryVideo.fallbackUrl} target="_blank" rel="noopener noreferrer">
                <MixedText>{t('academy.video.fallback')}</MixedText>
                <ExternalLink aria-hidden="true" />
                <span className="sr-only">{t('academy.external')}</span>
              </a>
            </Button>
          </div>
        </div>
      </article>
      <div className="two-card-grid public-section">
        <section className="content-card detail-card">
          <Play className="icon-tile" aria-hidden="true" />
          <div>
            <h2>{t('academy.video.optionalTitle')}</h2>
            <p>
              <MixedText>{t('academy.video.optionalText')}</MixedText>
            </p>
          </div>
        </section>
        <section className="content-card detail-card">
          <BookOpen className="icon-tile" aria-hidden="true" />
          <div>
            <h2>{t('academy.video.exploreTitle')}</h2>
            <p>
              <MixedText>{t('academy.video.exploreText')}</MixedText>
            </p>
            <TextLink to="/eda">{t('academy.fullSyllabus')}</TextLink>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
