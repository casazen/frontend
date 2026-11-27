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
  host: string;
  slug: string;
  displayName: string;
  embedEnabled?: boolean;
  tracking?: { gtmContainerId: string | null };
  surfaces?: HostSurfaces;
  ownerLoginReady?: boolean;
  branding?: HostBranding;
}

export interface HostSurfaces {
  guestArea: boolean;
  ownerPortal: boolean;
}

export interface HostBranding {
  logoUrl: string | null;
  primaryColor: string | null;
  themeId: string | null;
  fontId: string | null;
  displayName: string;
  showPoweredBy: boolean;
}

export function isHostSurfaceOn(site: HostSite | null, surface: keyof HostSurfaces): boolean {
  return site?.surfaces?.[surface] === true;
}

export type HostResolution =
  | { kind: 'app' }
  | { kind: 'site'; site: HostSite }
  | { kind: 'not-found' }
  /** The backend could not say (network, server error): not "not found", the visitor can retry. */
  | { kind: 'error' };

/** Hosts of the app itself that are never an org site: local development and the Vercel deployments. */
const APP_HOST_SUFFIXES = ['localhost', 'vercel.app'];
const LOCAL_ADDRESSES = new Set(['127.0.0.1', '[::1]']);

export function isDefaultAppHost(hostname: string, publicSiteHost: string | null = getPublicSiteHost()): boolean {
  const host = hostname.toLowerCase();
  if (publicSiteHost && host === publicSiteHost) return true;
  if (LOCAL_ADDRESSES.has(host)) return true;
  return APP_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

let hostSite: HostSite | null = null;

export function getHostSite(): HostSite | null {
  return hostSite;
}

export function setHostSite(site: HostSite | null): void {
  hostSite = site;
}

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
    return isAxiosError(error) && error.response?.status === 404 ? { kind: 'not-found' } : { kind: 'error' };
  }
}
