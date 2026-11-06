import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { featuredVideos, type FeaturedVideo } from '@/content/video-resources';
import { Button } from '@/components/ui/button';
import { MixedText } from './mixed-text';

export function LearningVideo({ video }: { video: FeaturedVideo }) {
  const { t } = useTranslation();
  const title = t(`learning.videos.${video.copyKey}.title`);
  return (
    <article
      className="s-card learning-video"
      id={video.slug}
      aria-labelledby={`video-${video.slug}`}
    >
      <h2 id={`video-${video.slug}`} className="resource-copy">
        <MixedText>{title}</MixedText>
      </h2>
      <p className="resource-copy">
        <MixedText>{t(`learning.videos.${video.copyKey}.description`)}</MixedText>
      </p>
      <div className="s-video-frame">
        <iframe
          src={video.embedUrl}
          title={title}
          loading="lazy"
          allow="fullscreen; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <div className="video-fallback">
        <p className="resource-copy">
          <MixedText>
            {t(video.provider === 'youtube' ? 'learning.youtubeHelp' : 'learning.videoHelp')}
          </MixedText>
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={video.fallbackUrl} target="_blank" rel="noopener noreferrer">
            <MixedText>
              {t(video.provider === 'youtube' ? 'learning.openYouTube' : 'learning.openDrive')}
            </MixedText>
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </div>
      {'sourceUrl' in video && (
        <a
          className="resource-source"
          href={video.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MixedText>{t('learning.youtubeSource')}</MixedText>
          <ExternalLink aria-hidden="true" />
        </a>
      )}
    </article>
  );
}

export function VideoLibraryPreview() {
  const { t } = useTranslation();
  return (
    <section className="s-section learning-video-preview" aria-labelledby="video-library-title">
      <div className="s-section-head">
        <h2 className="resource-copy" id="video-library-title">
          {t('nav.videos')}
        </h2>
        <Button asChild variant="outline" size="sm">
          <Link to="/videos">{t('learning.viewLibrary')}</Link>
        </Button>
      </div>
      <div className="s-cards">
        {featuredVideos.map((video) => (
          <article className="s-card" key={video.slug}>
            <h3 className="resource-copy">
              <MixedText>{t(`learning.videos.${video.copyKey}.title`)}</MixedText>
            </h3>
            <p className="resource-copy">
              <MixedText>{t(`learning.videos.${video.copyKey}.description`)}</MixedText>
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to={`/videos#${video.slug}`}>{t('learning.watchVideo')}</Link>
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
