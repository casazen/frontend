import { isEmbedPath } from '@/lib/embed-path';
import { FISCAL_DOCUMENT_VIEW_PATH_PREFIX } from '@/lib/fiscal-document-link';
import type { HostSite } from '@/lib/host-site';
import { isMarketingLinkPath } from '@/lib/marketing-link-paths';
import { OWNER_PORTAL_HOME_PATH } from '@/lib/owner-invitation';

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
  if (isEmbedPath(path)) return true;
  return (
    path.startsWith('/book') ||
    path.startsWith('/p/') ||
    path.startsWith('/s/') ||
    path.startsWith('/fornitori/') ||
    path.startsWith('/check-in') ||
    path.startsWith('/checkin') ||
    path.startsWith('/rent/pay/') ||
    path.startsWith('/service/pay/') ||
    path.startsWith(FISCAL_DOCUMENT_VIEW_PATH_PREFIX) ||
    path.startsWith('/guided-form') ||
    isMarketingLinkPath(path) ||
    path.startsWith('/help/')
  );
}

function isSignInReturn(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('state') && (params.has('code') || params.has('error'));
}

export function isSignInErrorReturn(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('state') && params.has('error');
}

function pathAsTheRouterReadsIt(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] ?? '';
  try {
    return path
      .split('/')
      .map((segment) => decodeURIComponent(segment).replace(/\//g, '%2F'))
      .join('/')
      .toLowerCase();
  } catch {
    return path.toLowerCase();
  }
}

/**
 * Whether the page of an org's own host needs the sign-in service (E40/F02/US01/T02, NF-141). Only the owner portal does, and only on a host that serves it AND whose domain is registered with the sign-in
 * service (`surfaces.ownerPortal` and `ownerLoginReady` of `resolve-host`): then the pages of the portal (`/portale-proprietari/…`, whatever the case or the escapes of the address: see `pathAsTheRouterReadsIt`)
 * and the address the sign-in comes back to (the origin of the host, with `code` and `state` or `error` and `state`) mount it, so the return is completed and the owner lands on the page that was asked for.
 * On any other host, and on every other page of a host (the booking site, `/my-bookings`, the check-in, the checkout, the widgets) nothing mounts it: those pages work with no sign-in module at all (A8-03),
 * and a host that is not registered never sends anybody to the sign-in. A host whose owner surface is off or not ready serves its owner paths as «not found» or «not yet enabled», pages that need nothing.
 * The widgets (`/embed/*`) are frames of other sites that work with no session module and no storage at all (NF-145): whatever their query says, nothing mounts it there.
 */
export function hostNeedsAuth(site: HostSite | null, pathname: string, search: string): boolean {
  if (site?.surfaces?.ownerPortal !== true || site.ownerLoginReady !== true) return false;
  const path = pathAsTheRouterReadsIt(pathname);
  if (isEmbedPath(path)) return false;
  return path === OWNER_PORTAL_HOME_PATH || path.startsWith(`${OWNER_PORTAL_HOME_PATH}/`) || isSignInReturn(search);
}
