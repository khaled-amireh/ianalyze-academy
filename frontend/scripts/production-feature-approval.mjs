// Explicit build-time approvals only. Database/Edge gates remain independent.
export function productionFeatures(environment, registration) {
  const read = (name) => {
    const value = environment[name];
    if (value !== undefined && value !== 'true' && value !== 'false')
      throw new Error(`${name} must be exactly true or false.`);
    return value === 'true';
  };
  const features = {
    submissions: read('ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED'),
    leaderboard: read('ACADEMY_LEADERBOARD_APPROVED'),
  };
  if ((features.submissions || features.leaderboard) && registration !== true)
    throw new Error('Student features require approved registration and privacy configuration.');
  return features;
}
