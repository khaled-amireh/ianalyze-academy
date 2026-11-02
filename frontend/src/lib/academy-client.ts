import { createAcademyClient } from './supabase';

// One client owns session refresh/subscriptions across authentication and data calls.
export const academyClient = createAcademyClient(import.meta.env);
export const registrationEnabled = import.meta.env.VITE_ENABLE_REGISTRATION === 'true';
export const submissionsEnabled = import.meta.env.VITE_ENABLE_SUBMISSIONS === 'true';
export const leaderboardEnabled = import.meta.env.VITE_ENABLE_LEADERBOARD === 'true';
export const privacyApproved = import.meta.env.VITE_PRIVACY_APPROVED === 'true';
