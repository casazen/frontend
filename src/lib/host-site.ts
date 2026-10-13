import { isAxiosError } from 'axios';
import { DomainApi } from '@/api/domain.api';
import { getPublicSiteHost } from '@/config/public-site';

/**
 * The org site a host serves (BK-16, A3-08): `https://villa.<base domain>` or the verified custom domain of an org shows
 * that org's booking site at its root, never the app, the login or another org. The backend (`resolve-host`) is the only
 * authority on which host serves which org; this module asks it once at start-up, before the router exists.
 */
export interface HostSite {
  /** The host the visitor is on, lower case. */
  host: string;
  /** Current public slug of the org served on this host: the `/book/:orgSlug` of its pages. */
  slug: string;
  displayName: string;
}

/** What the start-up found out about the host the page was opened on. */
export type HostResolution =
  | { kind: 'app' }
  | { kind: 'site'; site: HostSite }
  /** A host nobody serves: an unknown domain, a custom domain still waiting for its verification or no longer paid for. */
  | { kind: 'not-found' }
  /** The backend could not say (network, server error): not "not found", the visitor can retry. */
  | { kind: 'error' };

/** Hosts of the app itself that are never an org site: local development and the Vercel deployments. */
const APP_HOST_SUFFIXES = ['localhost', 'vercel.app'];
const LOCAL_ADDRESSES = new Set(['127.0.0.1', '[::1]']);

/**
 * The web app's own host: the public domain (`VITE_PUBLIC_SITE_URL`, no domain written in code, D3), local development
 * or a Vercel deployment. Any other host may be an org's custom domain or subdomain and is resolved.
 */
export function isDefaultAppHost(hostname: string, publicSiteHost: string | null = getPublicSiteHost()): boolean {
  const host = hostname.toLowerCase();
  if (publicSiteHost && host === publicSiteHost) return true;
  if (LOCAL_ADDRESSES.has(host)) return true;
  return APP_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

let hostSite: HostSite | null = null;

/** The org site of this host, set once by the start-up; `null` on the app's own host. */
export function getHostSite(): HostSite | null {
  return hostSite;
}

/** For the start-up and the tests. */
export function setHostSite(site: HostSite | null): void {
  hostSite = site;
}

/**
 * Finds out what `hostname` serves. The app's own hosts answer at once, without a request; any other host is resolved by
 * the backend, which only answers for a verified (and paid) custom domain or the subdomain of an org that chose it.
 */
export async function resolveHostSite(
  hostname: string = window.location.hostname,
  resolveHost: typeof DomainApi.resolveHost = DomainApi.resolveHost,
): Promise<HostResolution> {
  if (isDefaultAppHost(hostname)) return { kind: 'app' };

  const host = hostname.toLowerCase();
  try {
    const resolved = await resolveHost(host);
    const slug = resolved.slug?.trim();
    if (!slug) return { kind: 'not-found' };
    return { kind: 'site', site: { host, slug, displayName: resolved.branding?.displayName ?? slug } };
  } catch (error) {
    // Only a clear "no such host" is "not found"; a network or server failure is not a verdict on the domain.
    return isAxiosError(error) && error.response?.status === 404 ? { kind: 'not-found' } : { kind: 'error' };
  }
}
