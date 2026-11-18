function youtubeVideo(id: string) {
  return {
    provider: 'youtube' as const,
    id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    fallbackUrl: `https://www.youtube.com/watch?v=${id}`,
    sourceUrl: `https://youtu.be/${id}`,
    cover: `/video-thumbnails/${id}.jpg`,
  };
}

export const introductoryVideo = youtubeVideo('KE4KF03j_oM');
export const featuredVideos = [
  {
    ...introductoryVideo,
    slug: 'data-science',
    copyKey: 'dataScience',
  },
  {
    ...youtubeVideo('2hqkdoqQ7IU'),
    slug: 'kaggle',
    copyKey: 'kaggle',
  },
] as const;
export type FeaturedVideo = (typeof featuredVideos)[number];
