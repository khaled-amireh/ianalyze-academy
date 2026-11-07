function driveVideo(id: string) {
  return {
    provider: 'drive' as const,
    id,
    embedUrl: `https://drive.google.com/file/d/${id}/preview`,
    fallbackUrl: `https://drive.google.com/file/d/${id}/view?usp=sharing`,
  };
}

export const introductoryVideo = driveVideo('147puYxGioHyoYjSwxktgGP4RRWeM_qn4');
export const featuredVideos = [
  {
    ...introductoryVideo,
    slug: 'data-science',
    copyKey: 'dataScience',
    cover: 'brand' as const,
  },
  {
    provider: 'youtube',
    id: '_3m-0Fskfe8',
    embedUrl: 'https://www.youtube-nocookie.com/embed/_3m-0Fskfe8',
    fallbackUrl: 'https://www.youtube.com/watch?v=_3m-0Fskfe8',
    slug: 'kaggle',
    copyKey: 'kaggle',
    sourceUrl: 'https://youtu.be/_3m-0Fskfe8',
    cover: '/video-thumbnails/kaggle-introduction.jpg',
  },
] as const;
export type FeaturedVideo = (typeof featuredVideos)[number];
