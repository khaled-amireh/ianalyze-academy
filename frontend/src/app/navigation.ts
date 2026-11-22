export const DESKTOP_NAV_QUERY = '(min-width:1280px)';

export const publicNavigation = [
  { id: 'home', to: '/' },
  { id: 'eda', to: '/eda' },
  { id: 'about', to: '/about' },
  { id: 'aiTools', to: '/ai-tools' },
  { id: 'videos', to: '/videos' },
  { id: 'leaderboard', to: '/leaderboard' },
] as const;
export const secondaryNavigation = [{ id: 'contact', to: '/contact' }] as const;
export const publicPages = [
  'about',
  'eda',
  'ai-tools',
  'videos',
  'join',
  'leaderboard',
  'contact',
] as const;
export type PublicPage = (typeof publicPages)[number];
