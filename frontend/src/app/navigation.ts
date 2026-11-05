export const publicNavigation = [
  { id: 'home', to: '/' },
  { id: 'eda', to: '/eda' },
  { id: 'about', to: '/about' },
] as const;
export const secondaryNavigation = [
  { id: 'leaderboard', to: '/leaderboard' },
  { id: 'contact', to: '/contact' },
] as const;
export const publicPages = ['about', 'eda', 'join', 'leaderboard', 'contact'] as const;
export type PublicPage = (typeof publicPages)[number];
