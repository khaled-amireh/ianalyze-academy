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
  { ...introductoryVideo, slug: 'data-science', copyKey: 'dataScience' },
  {
    provider: 'youtube',
    id: 'bR2y1MMW5IE',
    embedUrl: 'https://www.youtube-nocookie.com/embed/bR2y1MMW5IE',
    fallbackUrl: 'https://www.youtube.com/watch?v=bR2y1MMW5IE',
    slug: 'kaggle',
    copyKey: 'kaggle',
    sourceUrl: 'https://youtu.be/bR2y1MMW5IE',
  },
] as const;
export type FeaturedVideo = (typeof featuredVideos)[number];
