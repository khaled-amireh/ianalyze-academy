import khaledPhoto from '@/assets/team/khaled-amireh.webp';
import yomnaPhoto from '@/assets/team/yomna-al-jabiri.webp';

/** Public, owner-confirmed metadata only. Copy lives in the existing locale dictionaries. */
export const syllabus = {
  version: 'Draft v1.0',
  source: 'docs/phase-00/student-syllabus-source.md',
  teachingWeeks: 6,
  bufferWeeks: 2,
  plannedHours: 18,
  modules: [
    { id: 'python1', week: '01' },
    { id: 'python2', week: '02' },
    { id: 'pandas', week: '03' },
    { id: 'cleaning', week: '04' },
    { id: 'visualization', week: '05' },
    { id: 'project', week: '06' },
  ],
  tools: ['Google Colab', 'Python', 'Pandas', 'Matplotlib'],
} as const;

export const leaders = [
  { id: 'khaled', photo: khaledPhoto, width: 1024, height: 1106 },
  { id: 'yomna', photo: yomnaPhoto, width: 1385, height: 1385 },
] as const;

export const introductoryVideo = {
  id: '147puYxGioHyoYjSwxktgGP4RRWeM_qn4',
  embedUrl: 'https://drive.google.com/file/d/147puYxGioHyoYjSwxktgGP4RRWeM_qn4/preview',
  fallbackUrl: 'https://drive.google.com/file/d/147puYxGioHyoYjSwxktgGP4RRWeM_qn4/view?usp=sharing',
} as const;

export const socialLinks = [
  { id: 'instagram', name: 'Instagram', href: 'https://www.instagram.com/iteamzuj/' },
  { id: 'linkedin', name: 'LinkedIn', href: 'https://www.linkedin.com/company/iteamzuj/posts/' },
] as const;

export const faqIds = [
  'club',
  'beginner',
  'python',
  'duration',
  'schedule',
  'laptop',
  'registration',
  'activities',
  'video',
] as const;

export const registrationFields = [
  { id: 'fullName', type: 'text', required: true },
  { id: 'email', type: 'email', required: true },
  { id: 'major', type: 'text', required: true },
  { id: 'year', type: 'select', required: true },
  { id: 'whatsapp', type: 'tel', required: true },
  { id: 'python', type: 'select', required: true },
  { id: 'universityId', type: 'text', required: false },
] as const;
