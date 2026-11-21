import { isEmbedPath } from '@/lib/embed-path';
import { FISCAL_DOCUMENT_VIEW_PATH_PREFIX } from '@/lib/fiscal-document-link';
import type { HostSite } from '@/lib/host-site';
import { isMarketingLinkPath } from '@/lib/marketing-link-paths';
import { OWNER_PORTAL_HOME_PATH } from '@/lib/owner-invitation';

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
  // The embeddable widgets (NF-144) are frames of other sites: no sign-in is ever offered there, on the CasaZen domain too.
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
    // The page of the document a guest got by e-mail (E12/F02/US02): a guest is not asked for an account either.
    path.startsWith(FISCAL_DOCUMENT_VIEW_PATH_PREFIX) ||
    // The simulated module of the service that prepares the contract (CF-SIM, test environments): public like the real one.
    path.startsWith('/guided-form') ||
    // The pages the marketing e-mails link to (CRM-08, CRM-03): a person who only wants to stop the e-mails is not asked for an account.
    isMarketingLinkPath(path) ||
    path.startsWith('/help/')
  );
}

/** The address the sign-in service sends the browser back to is the origin of the page, with the answer in the query: `code` and `state`, or `error` and `state`. */
function isSignInReturn(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('state') && (params.has('code') || params.has('error'));
}

/**
 * The address the sign-in service sends the browser back to when the sign-in did NOT complete (`error` and `state`). The service does not finish such a return: the person is not signed in and
 * the address stays as it is, so the app has to tell them (E40/F02/US01/T02).
 */
export function isSignInErrorReturn(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('state') && params.has('error');
}

/**
 * The path of an address the way the router reads it, which is how a page of the owner portal has to be recognised here: `matchRoutes` decodes every segment of the address and compares it without
 * looking at the case, so `/Portale-Proprietari/accedi` and `/portale%2Dproprietari` are the portal for it. A page that the router serves as the portal while this says it is not would be shown with no
 * sign-in module, under the boundary that asks for one (`AuthProviderBoundary`), which loads the page again for ever.
 */
function pathAsTheRouterReadsIt(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] ?? '';
  try {
    return path
      .split('/')
      .map((segment) => decodeURIComponent(segment).replace(/\//g, '%2F'))
      .join('/')
      .toLowerCase();
  } catch {
    // A malformed escape: the router matches the address as it is.
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
