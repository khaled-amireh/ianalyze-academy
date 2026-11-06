import { useTranslation } from 'react-i18next';
import { featuredVideos } from '@/content/video-resources';
import { PageContainer } from '@/components/shared/page-container';
import { MixedText } from '@/components/shared/mixed-text';
import { LearningVideo } from '@/components/shared/learning-video';

export function VideosPage() {
  const { t } = useTranslation();
  return (
    <PageContainer className="learning-page">
      <header className="s-page-head">
        <h1 className="resource-copy" id="page-title" tabIndex={-1}>
          {t('nav.videos')}
        </h1>
        <p className="s-lede resource-copy">
          <MixedText>{t('learning.videoIntro')}</MixedText>
        </p>
      </header>
      <div className="s-cards learning-videos-grid">
        {featuredVideos.map((video) => (
          <LearningVideo video={video} key={video.id} />
        ))}
      </div>
    </PageContainer>
  );
}
