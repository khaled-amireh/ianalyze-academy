export const publicNavigation = [
  { id: 'home', to: '/' },
  { id: 'videos', to: '/videos' },
  { id: 'about', to: '/about' },
  { id: 'team', to: '/team' },
] as const;
export const secondaryNavigation = [
  { id: 'leaderboard', to: '/leaderboard' },
  { id: 'contact', to: '/contact' },
] as const;
export const publicPages = ['about', 'videos', 'team', 'join', 'leaderboard', 'contact'] as const;
export type PublicPage = (typeof publicPages)[number];
