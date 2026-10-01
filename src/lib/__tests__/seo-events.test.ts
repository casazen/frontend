import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LANDING_TOUCH_STORAGE_KEY } from '@/lib/signup-attribution';
import { PublicSeoApi } from '@/api/public-seo.api';
import { resolvePlausibleDomain } from '@/config/analytics.config';

vi.mock('@/api/public-seo.api', () => ({
  PublicSeoApi: { trackEvent: vi.fn() },
}));
const analytics = vi.hoisted(() => ({ plausibleDomain: null as string | null }));
vi.mock('@/config/analytics.config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/analytics.config')>()),
  analyticsConfig: analytics,
}));

import { buildSeoEventPayload, trackSeoEvent } from '../seo-events';

const ORIGIN = 'https://app.example.test';
const LOCATION = { search: '', origin: ORIGIN };

describe('buildSeoEventPayload (SE-04, #300 AC3, no personal data)', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('buildSeoEventPayload_ValidComune_CarriesOnlyTheEventTheComuneAndTheMarketingValues', () => {
    const payload = buildSeoEventPayload(
      'cta_click',
      'como',
      { search: '?utm_source=seo-compliance&utm_medium=cta&utm_campaign=estate&utm_term=ignored', origin: ORIGIN },
      'https://www.google.com/search?q=affitti+como',
    );

    expect(payload).toEqual({
      event: 'cta_click',
      comuneSlug: 'como',
      utmSource: 'seo-compliance',
      utmMedium: 'cta',
      utmCampaign: 'estate',
      // The host only: never the URL or its query.
      referrerHost: 'www.google.com',
    });
  });

  it('buildSeoEventPayload_UtmWithAnEmailAddress_DropsTheValue', () => {
    const payload = buildSeoEventPayload('cta_click', 'como', {
      search: '?utm_source=mario.rossi@example.com&utm_medium=cta',
      origin: ORIGIN,
    });

    expect(payload).toEqual({ event: 'cta_click', comuneSlug: 'como', utmMedium: 'cta' });
    expect(JSON.stringify(payload)).not.toContain('@');
  });

  it('buildSeoEventPayload_ReferrerOnTheSameSite_HasNoReferrerHost', () => {
    const payload = buildSeoEventPayload('signup_start', 'como', LOCATION, `${ORIGIN}/p/affitti-brevi/lombardia/como`);

    expect(payload).toEqual({ event: 'signup_start', comuneSlug: 'como' });
  });

  it('buildSeoEventPayload_FirstPageOfTheVisit_ProvidesTheMarketingValuesOfTheVisit', () => {
    window.sessionStorage.setItem(
      LANDING_TOUCH_STORAGE_KEY,
      JSON.stringify({ landingPath: '/p/x', referrerHost: 'news.example.org', utm: { utm_source: 'newsletter' } }),
    );

    const payload = buildSeoEventPayload('cta_click', 'como', LOCATION, `${ORIGIN}/p/x`);

    expect(payload).toEqual({ event: 'cta_click', comuneSlug: 'como', utmSource: 'newsletter', referrerHost: 'news.example.org' });
  });

  it.each([[undefined], [null], [''], ['Como!'], ['../etc'], ['0130751']])(
    'buildSeoEventPayload_InvalidComune_%s_SendsNothing',
    (comune) => {
      expect(buildSeoEventPayload('cta_click', comune, LOCATION)).toBeNull();
    },
  );

  it('buildSeoEventPayload_IstatCode_IsAccepted', () => {
    expect(buildSeoEventPayload('cta_click', '013075', LOCATION)?.comuneSlug).toBe('013075');
  });
});

describe('trackSeoEvent (SE-04, #300 AC3 AC8)', () => {
  const sendBeacon = vi.fn();

  beforeEach(() => {
    window.sessionStorage.clear();
    sendBeacon.mockReset().mockReturnValue(true);
    Object.defineProperty(window.navigator, 'sendBeacon', { value: sendBeacon, configurable: true, writable: true });
    vi.mocked(PublicSeoApi.trackEvent).mockReset().mockResolvedValue(undefined);
    analytics.plausibleDomain = null;
    delete window.plausible;
  });

  afterEach(() => {
    Reflect.deleteProperty(window.navigator, 'sendBeacon');
  });

  it('trackSeoEvent_BeaconAccepted_SendsAJsonBeaconToTheEventsEndpoint', async () => {
    const sent = trackSeoEvent('cta_click', 'como', LOCATION);

    expect(sent).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, body] = sendBeacon.mock.calls[0] as [string, Blob];
    expect(url).toMatch(/\/public\/seo\/events$/);
    expect(body.type).toBe('application/json');
    expect(JSON.parse(await body.text())).toEqual({ event: 'cta_click', comuneSlug: 'como' });
    expect(PublicSeoApi.trackEvent).not.toHaveBeenCalled();
  });

  it('trackSeoEvent_BeaconRefused_FallsBackToAPublicRequest', () => {
    sendBeacon.mockReturnValue(false);

    trackSeoEvent('signup_start', 'como', LOCATION);

    expect(PublicSeoApi.trackEvent).toHaveBeenCalledWith({ event: 'signup_start', comuneSlug: 'como' });
  });

  it('trackSeoEvent_BrowserWithoutBeacon_UsesAPublicRequest', () => {
    Reflect.deleteProperty(window.navigator, 'sendBeacon');

    trackSeoEvent('cta_click', 'como', LOCATION);

    expect(PublicSeoApi.trackEvent).toHaveBeenCalledTimes(1);
  });

  it('trackSeoEvent_RequestFails_NeverThrowsNorBreaksTheClick', async () => {
    sendBeacon.mockReturnValue(false);
    vi.mocked(PublicSeoApi.trackEvent).mockRejectedValue(new Error('offline'));

    expect(() => trackSeoEvent('cta_click', 'como', LOCATION)).not.toThrow();
    await Promise.resolve();
  });

  it('trackSeoEvent_InvalidComune_SendsNothing', () => {
    expect(trackSeoEvent('cta_click', 'not a comune', LOCATION)).toBe(false);

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(PublicSeoApi.trackEvent).not.toHaveBeenCalled();
  });

  it('trackSeoEvent_PlausibleConfiguredAndLoaded_AlsoTellsPlausible', () => {
    analytics.plausibleDomain = 'example.test';
    window.plausible = vi.fn();

    trackSeoEvent('cta_click', 'como', LOCATION);

    expect(window.plausible).toHaveBeenCalledWith('cta_click', { props: { comune: 'como' } });
  });

  it('trackSeoEvent_PlausibleNotConfigured_NeverCallsIt', () => {
    window.plausible = vi.fn();

    trackSeoEvent('cta_click', 'como', LOCATION);

    expect(window.plausible).not.toHaveBeenCalled();
  });
});

describe('resolvePlausibleDomain', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['   ', null],
    [42, null],
    [' example.test ', 'example.test'],
  ])('resolvePlausibleDomain_%s_Returns%s', (value, expected) => {
    expect(resolvePlausibleDomain(value)).toBe(expected);
  });
});
