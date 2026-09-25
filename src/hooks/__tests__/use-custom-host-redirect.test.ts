import { describe, expect, it } from 'vitest';
import { isDefaultAppHost } from '../use-custom-host-redirect';
import { getPublicSiteHost } from '@/config/public-site';

/** D3 (SE-03): the web app's own hosts come from configuration, no CasaZen domain is written in the code. */
describe('isDefaultAppHost', () => {
  it.each(['public-site.example.test', 'localhost', '127.0.0.1', 'casazen-app.vercel.app', 'pr-12-casazen.vercel.app'])(
    'isDefaultAppHost_AppHost_%s_IsNotResolved',
    (host) => {
      expect(isDefaultAppHost(host, 'public-site.example.test')).toBe(true);
    },
  );

  it.each(['www.villa-mare.it', 'villa-mare.sites.example.test', 'casazen.app', 'villa.casazen.it'])(
    'isDefaultAppHost_OtherHost_%s_MayBeAnOrgSite',
    (host) => {
      expect(isDefaultAppHost(host, 'public-site.example.test')).toBe(false);
    },
  );

  it('getPublicSiteHost_FromTheVariable_OrNullWithoutDefault', () => {
    expect(getPublicSiteHost('https://Public-Site.example.test')).toBe('public-site.example.test');
    expect(getPublicSiteHost('')).toBeNull();
    expect(getPublicSiteHost(null)).toBeNull();
    expect(getPublicSiteHost('not a url')).toBeNull();
  });
});
