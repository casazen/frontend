import { isAxiosError } from 'axios';
import { DomainApi } from '@/api/domain.api';
import { getPublicSiteHost } from '@/config/public-site';
import type { ResolveHostResponse } from '@/types/domain.types';

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
  /** The embeddable pages (`/embed/*`) answer on this host (`resolve-host`, NF-144); absent or false: they say «not available». */
  embedEnabled?: boolean;
  /** The agency's Google Tag Manager container, as `resolve-host` gives it (NF-149); absent when it says nothing. */
  tracking?: { gtmContainerId: string | null };
  /** What the host serves besides the booking site (NF-140); absent: nothing, the host serves what it always served. Read it with `isHostSurfaceOn`. */
  surfaces?: HostSurfaces;
  /** The host is registered with the sign-in service, so its owners can sign in on it (NF-141); absent or false: the owner portal says «not yet enabled». */
  ownerLoginReady?: boolean;
  /**
   * How the agency looks on its own domain (NF-140): the frame of the guest check-in and of the owner portal wears it. Present only when the agency set a logo, a colour, a theme,
   * a font or «powered by»; absent: the plain look of the platform, the name being `displayName`.
   */
  branding?: HostBranding;
}

/** The pages an agency's own domain serves besides its booking site (`resolve-host`, NF-140). */
export interface HostSurfaces {
  /** The guest check-in page (`/checkin/:token`). `/my-bookings` is part of the booking site and is served whatever this says. */
  guestArea: boolean;
  /** The owner portal (`/portale-proprietari/…`). */
  ownerPortal: boolean;
}

/** The agency's look as `resolve-host` gives it; the ids are the ones of the theme and font tables of the public site, resolved when they are used. */
export interface HostBranding {
  logoUrl: string | null;
  /** The agency's own colour (`#rrggbb`); null keeps the colours of the theme. */
  primaryColor: string | null;
  themeId: string | null;
  fontId: string | null;
  displayName: string;
  /** The page says «powered by CasaZen». */
  showPoweredBy: boolean;
}

/** Whether `site` serves `surface`: a site that says nothing about it (an older backend, an app host with no site) does not. */
export function isHostSurfaceOn(site: HostSite | null, surface: keyof HostSurfaces): boolean {
  return site?.surfaces?.[surface] === true;
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
 * The look the agency gave its site, from the `branding` block of `resolve-host`: its logo, colour, theme, font and whether the pages say «powered by CasaZen». It is only there when the agency
 * set at least one of them, like the other optional parts of a `HostSite` (an agency that left everything as it is has the plain look of the platform, and an older answer gives the same site as before).
 */
function hostBranding(resolved: ResolveHostResponse, displayName: string): HostBranding | null {
  const branding = resolved.branding;
  const look: HostBranding = {
    logoUrl: branding?.logoUrl ?? null,
    primaryColor: branding?.primaryColor ?? null,
    themeId: branding?.publicThemeId ?? null,
    fontId: branding?.publicFontId ?? null,
    displayName,
    showPoweredBy: branding?.showPoweredBy === true,
  };
  const customised = look.logoUrl !== null || look.primaryColor !== null || look.themeId !== null || look.fontId !== null || look.showPoweredBy;
  return customised ? look : null;
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
    const displayName = resolved.branding?.displayName ?? slug;
    const branding = hostBranding(resolved, displayName);
    return {
      kind: 'site',
      site: {
        host,
        slug,
        displayName,
        // Only what the backend says, so that an older answer gives the same site as before: what it does not say is off.
        ...(resolved.embedEnabled === true ? { embedEnabled: true } : {}),
        ...(resolved.tracking ? { tracking: { gtmContainerId: resolved.tracking.gtmContainerId ?? null } } : {}),
        ...(resolved.surfaces
          ? { surfaces: { guestArea: resolved.surfaces.guestArea === true, ownerPortal: resolved.surfaces.ownerPortal === true } }
          : {}),
        ...(resolved.ownerLoginReady === true ? { ownerLoginReady: true } : {}),
        ...(branding ? { branding } : {}),
      },
    };
  } catch (error) {
    // Only a clear "no such host" is "not found"; a network or server failure is not a verdict on the domain.
    return isAxiosError(error) && error.response?.status === 404 ? { kind: 'not-found' } : { kind: 'error' };
  }
}
