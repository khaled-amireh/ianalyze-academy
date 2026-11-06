export const publicNavigation = [
  { id: 'home', to: '/' },
  { id: 'about', to: '/about' },
] as const;
export const secondaryNavigation = [
  { id: 'leaderboard', to: '/leaderboard' },
  { id: 'contact', to: '/contact' },
] as const;
export const publicPages = ['about', 'join', 'leaderboard', 'contact'] as const;
export type PublicPage = (typeof publicPages)[number];
