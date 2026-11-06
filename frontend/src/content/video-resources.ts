function driveVideo(id: string) {
  return {
    id,
    embedUrl: `https://drive.google.com/file/d/${id}/preview`,
    fallbackUrl: `https://drive.google.com/file/d/${id}/view?usp=sharing`,
  };
}

export const introductoryVideo = driveVideo('147puYxGioHyoYjSwxktgGP4RRWeM_qn4');
export const featuredVideos = [
  { ...introductoryVideo, slug: 'data-science', copyKey: 'dataScience' },
  {
    ...driveVideo('1Qh5BPaoR125I00znXsaCF6e1s5HpuPBS'),
    slug: 'kaggle',
    copyKey: 'kaggle',
    sourceUrl: 'https://youtu.be/bR2y1MMW5IE',
  },
] as const;
export type FeaturedVideo = (typeof featuredVideos)[number];
