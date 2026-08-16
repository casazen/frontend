/** Origins where Web Crypto / Auth0 SPA SDK are allowed (see auth0-spa-js FAQ). */
export function isSecureAuth0Origin(location: Pick<Location, 'protocol' | 'hostname'> = window.location): boolean {
  if (location.protocol === 'https:') return true;
  const host = location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/**
 * Routes that must work without Auth0 (direct booking, SEO, check-in).
 * Evaluated on first paint so Auth0Provider is never mounted on insecure LAN origins.
 */
export function isPublicUnauthenticatedPath(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  if (path === '/search') return true;
  return (
    path.startsWith('/book') ||
    path.startsWith('/p/') ||
    path.startsWith('/s/') ||
    path.startsWith('/check-in') ||
    path.startsWith('/checkin') ||
    path.startsWith('/help/')
  );
}
