import { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResolveHostResponse } from '@/types/domain.types';
import { getHostSite, isDefaultAppHost, isHostSurfaceOn, resolveHostSite, setHostSite } from '../host-site';
import { getPublicSiteHost, getPublicSiteOrigin } from '@/config/public-site';

/** D3 (SE-03): the web app's own hosts come from configuration, no CasaZen domain is written in the code. */
describe('isDefaultAppHost', () => {
  it.each(['public-site.example.test', 'localhost', '127.0.0.1', 'casazen-app.vercel.app', 'pr-12-casazen.vercel.app'])(
    'isDefaultAppHost_AppHost_%s_IsNotResolved',
    (host) => {
      expect(isDefaultAppHost(host, 'public-site.example.test')).toBe(true);
    },
  );

  // BK-16 (A3-08): a CasaZen domain is not "the app" just because of its name; only the configured host is.
  it.each(['www.villa-mare.it', 'villa-mare.sites.example.test', 'casazen.app', 'villa.casazen.it', 'evil-vercel.app.test'])(
    'isDefaultAppHost_OtherHost_%s_MayBeAnOrgSite',
    (host) => {
      expect(isDefaultAppHost(host, 'public-site.example.test')).toBe(false);
    },
  );

  it('isDefaultAppHost_NoPublicSiteConfigured_OnlyLocalAndVercelHostsAreTheApp', () => {
    expect(isDefaultAppHost('public-site.example.test', null)).toBe(false);
    expect(isDefaultAppHost('localhost', null)).toBe(true);
  });

  it('getPublicSiteHost_FromTheVariable_OrNullWithoutDefault', () => {
    expect(getPublicSiteHost('https://Public-Site.example.test')).toBe('public-site.example.test');
    expect(getPublicSiteHost('')).toBeNull();
    expect(getPublicSiteHost(null)).toBeNull();
    expect(getPublicSiteHost('not a url')).toBeNull();
  });

  it('getPublicSiteOrigin_OnlyAnHttpsUrl_IsAnOrigin', () => {
    expect(getPublicSiteOrigin('https://Public-Site.example.test/')).toBe('https://public-site.example.test');
    expect(getPublicSiteOrigin('http://public-site.example.test')).toBeNull();
    expect(getPublicSiteOrigin('')).toBeNull();
    expect(getPublicSiteOrigin(undefined)).toBeNull();
  });
});

const RESOLVED: ResolveHostResponse = {
  orgId: 'org-1',
  slug: 'villa-rossi',
  publicHostMode: 'CustomDomain',
  planTier: 'Pro',
  branding: { displayName: 'Villa Rossi', slug: 'villa-rossi', showPoweredBy: false },
};

function httpError(status: number) {
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, { status } as AxiosResponse);
}

describe('resolveHostSite (BK-16, A3-08)', () => {
  afterEach(() => setHostSite(null));

  it('resolveHostSite_AppOwnHost_StartsTheAppWithoutAnyRequest', async () => {
    const resolveHost = vi.fn();

    const result = await resolveHostSite('localhost', resolveHost);

    expect(result).toEqual({ kind: 'app' });
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it('resolveHostSite_HostServedByAnOrg_IsItsSiteWithTheLowerCaseHost', async () => {
    const resolveHost = vi.fn().mockResolvedValue(RESOLVED);

    const result = await resolveHostSite('WWW.Villa-Rossi.example.test', resolveHost);

    expect(resolveHost).toHaveBeenCalledWith('www.villa-rossi.example.test');
    // An answer that says nothing of the surfaces (and an agency that set no look) gives the site as it always was.
    expect(result).toEqual({
      kind: 'site',
      site: { host: 'www.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi' },
    });
  });

  it('resolveHostSite_SurfacesAndSignInAndBranding_AreMappedIntoTheSite', async () => {
    const resolveHost = vi.fn().mockResolvedValue({
      ...RESOLVED,
      embedEnabled: true,
      surfaces: { guestArea: true, ownerPortal: true },
      ownerLoginReady: true,
      branding: {
        displayName: 'Villa Rossi',
        slug: 'villa-rossi',
        showPoweredBy: true,
        logoUrl: 'https://cdn.example.test/logo.png',
        primaryColor: '#1a5276',
        publicThemeId: 'mare',
        publicFontId: 'moderno',
      },
    });

    const result = await resolveHostSite('prenota.villa-rossi.example.test', resolveHost);

    expect(result).toEqual({
      kind: 'site',
      site: {
        host: 'prenota.villa-rossi.example.test',
        slug: 'villa-rossi',
        displayName: 'Villa Rossi',
        embedEnabled: true,
        surfaces: { guestArea: true, ownerPortal: true },
        ownerLoginReady: true,
        branding: {
          logoUrl: 'https://cdn.example.test/logo.png',
          primaryColor: '#1a5276',
          themeId: 'mare',
          fontId: 'moderno',
          displayName: 'Villa Rossi',
          showPoweredBy: true,
        },
      },
    });
  });

  it.each([
    ['a logo', { logoUrl: 'https://cdn.example.test/l.png' }, { logoUrl: 'https://cdn.example.test/l.png' }],
    ['a colour', { primaryColor: '#112233' }, { primaryColor: '#112233' }],
    ['a theme', { publicThemeId: 'citta' }, { themeId: 'citta' }],
    ['a font', { publicFontId: 'classico' }, { fontId: 'classico' }],
    ['powered by', { showPoweredBy: true }, { showPoweredBy: true }],
  ])('resolveHostSite_AgencyThatSet_%s_HasABrandingBlock', async (_name, set, expected) => {
    const resolveHost = vi.fn().mockResolvedValue({ ...RESOLVED, branding: { ...RESOLVED.branding, ...set } });

    const result = await resolveHostSite('prenota.villa-rossi.example.test', resolveHost);

    expect(result.kind === 'site' && result.site.branding).toEqual({
      logoUrl: null,
      primaryColor: null,
      themeId: null,
      fontId: null,
      displayName: 'Villa Rossi',
      showPoweredBy: false,
      ...expected,
    });
  });

  it.each([
    ['a surface missing from the answer', { surfaces: { guestArea: true } }, { guestArea: true, ownerPortal: false }],
    ['a surface that is not true', { surfaces: { guestArea: 'true', ownerPortal: 1 } }, { guestArea: false, ownerPortal: false }],
    ['an empty block', { surfaces: {} }, { guestArea: false, ownerPortal: false }],
  ])('resolveHostSite_%s_IsOff', async (_name, answer, expected) => {
    const resolveHost = vi.fn().mockResolvedValue({ ...RESOLVED, ...answer });

    const result = await resolveHostSite('prenota.villa-rossi.example.test', resolveHost);

    expect(result.kind === 'site' && result.site.surfaces).toEqual(expected);
  });

  it.each([[false], ['true'], [1], [undefined]])('resolveHostSite_OwnerLoginReady_%s_IsNotReady', async (ready) => {
    const resolveHost = vi.fn().mockResolvedValue({ ...RESOLVED, surfaces: { guestArea: false, ownerPortal: true }, ownerLoginReady: ready });

    const result = await resolveHostSite('prenota.villa-rossi.example.test', resolveHost);

    expect(result.kind === 'site' && result.site.ownerLoginReady).toBeFalsy();
  });

  it('isHostSurfaceOn_AnOlderAnswerOrNoSite_IsOff', () => {
    const site = { host: 'h.example.test', slug: 's', displayName: 'S' };

    expect(isHostSurfaceOn(null, 'guestArea')).toBe(false);
    expect(isHostSurfaceOn(site, 'guestArea')).toBe(false);
    expect(isHostSurfaceOn({ ...site, surfaces: { guestArea: true, ownerPortal: false } }, 'guestArea')).toBe(true);
    expect(isHostSurfaceOn({ ...site, surfaces: { guestArea: true, ownerPortal: false } }, 'ownerPortal')).toBe(false);
  });

  it('resolveHostSite_BackendDoesNotKnowTheHost_IsNotFound', async () => {
    const resolveHost = vi.fn().mockRejectedValue(httpError(404));

    expect(await resolveHostSite('www.unknown.example.test', resolveHost)).toEqual({ kind: 'not-found' });
  });

  it('resolveHostSite_AnswerWithoutSlug_IsNotFound', async () => {
    const resolveHost = vi.fn().mockResolvedValue({ ...RESOLVED, slug: ' ' });

    expect(await resolveHostSite('www.unknown.example.test', resolveHost)).toEqual({ kind: 'not-found' });
  });

  it.each([[500], [502], [429], [400]])('resolveHostSite_BackendAnswers%i_IsAnErrorNotAVerdictOnTheDomain', async (status) => {
    const resolveHost = vi.fn().mockRejectedValue(httpError(status));

    expect(await resolveHostSite('www.villa-rossi.example.test', resolveHost)).toEqual({ kind: 'error' });
  });

  it('resolveHostSite_NetworkFailure_IsAnError', async () => {
    const resolveHost = vi.fn().mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));

    expect(await resolveHostSite('www.villa-rossi.example.test', resolveHost)).toEqual({ kind: 'error' });
  });
});

describe('getHostSite / setHostSite', () => {
  afterEach(() => setHostSite(null));

  it('getHostSite_BeforeStartUp_IsNullAndAfterSetIsTheSite', () => {
    expect(getHostSite()).toBeNull();

    setHostSite({ host: 'www.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi' });

    expect(getHostSite()?.slug).toBe('villa-rossi');
  });
});
