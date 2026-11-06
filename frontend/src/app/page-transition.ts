// Authentication and protected routes must never wait for a decorative transition.
const immediateRoutes =
  /^\/(?:auth(?:\/|$)|login(?:\/|$)|join(?:\/|$)|student(?:\/|$)|workspace(?:\/|$)|profile(?:\/|$)|notifications(?:\/|$)|team\/?$|_preview(?:\/|$))/;

export function shouldTransitionPage(previous: string, next: string, navigationType: string) {
  const normalize = (path: string) => path.replace(/\/+$/, '') || '/';
  return (
    normalize(previous) !== normalize(next) &&
    navigationType !== 'REPLACE' &&
    !immediateRoutes.test(previous) &&
    !immediateRoutes.test(next)
  );
}
