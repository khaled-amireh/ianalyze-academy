export function resolveProductionBuildGates(
  environment = process.env,
  registrationVerified = false,
) {
  const registration =
    environment.ACADEMY_REGISTRATION_APPROVED === 'true' && registrationVerified === true;
  const submissions = environment.ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED === 'true';
  const leaderboard = environment.ACADEMY_LEADERBOARD_APPROVED === 'true';

  return Object.freeze({
    vite: Object.freeze({
      VITE_ENABLE_REGISTRATION: String(registration),
      VITE_ENABLE_SUBMISSIONS: String(submissions),
      VITE_ENABLE_LEADERBOARD: String(leaderboard),
      VITE_PRIVACY_APPROVED: String(registration),
      VITE_ENABLE_DEV_PREVIEWS: 'false',
    }),
    metadata: Object.freeze({
      registration,
      submissions,
      leaderboard,
      privacyApproved: registration,
      developmentPreviews: false,
    }),
  });
}

export function expectedProductionBuildMetadata(environment = process.env) {
  return resolveProductionBuildGates(
    environment,
    environment.ACADEMY_REGISTRATION_APPROVED === 'true',
  ).metadata;
}
