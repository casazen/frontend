import { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResolveHostResponse } from '@/types/domain.types';
import { getHostSite, isDefaultAppHost, resolveHostSite, setHostSite } from '../host-site';
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
    expect(result).toEqual({
      kind: 'site',
      site: { host: 'www.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi' },
    });
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
