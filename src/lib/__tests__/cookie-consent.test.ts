import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// A Plausible domain is configured, so that "nothing goes to Plausible without the consent" is not true only because none is set.
vi.hoisted(() => {
  vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'casazen.test');
});
vi.mock('@/api/public-seo.api', () => ({ PublicSeoApi: { trackEvent: vi.fn() } }));
vi.mock('@/api/users.api', () => ({ UsersApi: { recordSignupAttribution: vi.fn() } }));

import { PublicSeoApi } from '@/api/public-seo.api';
import { analyticsConfig } from '@/config/analytics.config';
import { useConsent } from '@/hooks/use-consent';
import { CONSENT_STORAGE_KEY, hasConsent } from '@/lib/cookie-consent';
import { trackSeoEvent } from '@/lib/seo-events';
import {
  LANDING_TOUCH_STORAGE_KEY,
  PENDING_ATTRIBUTION_STORAGE_KEY,
  captureSignupAttribution,
  forgetVisitMarketing,
  recordLandingTouch,
} from '@/lib/signup-attribution';

const ORIGIN = 'https://app.example.test';
const EVENT_LOCATION = { search: '', origin: ORIGIN };
const FIRST_PAGE = { pathname: '/p/affitti-brevi/lombardia/como', search: '?utm_source=newsletter', origin: ORIGIN };
const SIGNUP = { pathname: '/signup', search: '?comune=como&utm_source=newsletter', origin: ORIGIN };

// DB-02b: what measures the visitor (the SEO funnel, Plausible, the source of a host signup) runs only after an explicit yes.
describe('what measures runs only with the consent of the visitor (DB-02b)', () => {
  const sendBeacon = vi.fn();
  const plausible = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    forgetVisitMarketing();
    sendBeacon.mockReset().mockReturnValue(true);
    Object.defineProperty(window.navigator, 'sendBeacon', { value: sendBeacon, configurable: true, writable: true });
    vi.mocked(PublicSeoApi.trackEvent).mockReset().mockResolvedValue(undefined);
    plausible.mockReset();
    window.plausible = plausible;
  });

  afterEach(() => {
    Reflect.deleteProperty(window.navigator, 'sendBeacon');
    delete window.plausible;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it.each([
    ['no choice yet', null],
    ['a refusal', 'rejected'],
  ])('with %s nothing is sent to CasaZen or to Plausible', (_label, choice) => {
    if (choice) window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);

    expect(trackSeoEvent('cta_click', 'como', EVENT_LOCATION)).toBe(false);

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(PublicSeoApi.trackEvent).not.toHaveBeenCalled();
    expect(plausible).not.toHaveBeenCalled();
    expect(analyticsConfig.plausibleDomain).toBeNull();
  });

  it('with the consent the same event goes to CasaZen and to Plausible', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');

    expect(trackSeoEvent('cta_click', 'como', EVENT_LOCATION)).toBe(true);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(plausible).toHaveBeenCalledTimes(1);
    expect(analyticsConfig.plausibleDomain).toBe('casazen.test');
  });

  it.each([
    ['no choice yet', null],
    ['a refusal', 'rejected'],
  ])('with %s the source of the visit and of a host signup is not stored', (_label, choice) => {
    if (choice) window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);

    recordLandingTouch(FIRST_PAGE, 'https://www.google.com/');
    const attribution = captureSignupAttribution(SIGNUP, '');

    expect(attribution).toEqual({});
    expect(window.sessionStorage.getItem(LANDING_TOUCH_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(PENDING_ATTRIBUTION_STORAGE_KEY)).toBeNull();
  });

  it('the first page held in memory is kept when the visitor accepts, and all is forgotten when they refuse', () => {
    recordLandingTouch(FIRST_PAGE, '');
    expect(window.sessionStorage.getItem(LANDING_TOUCH_STORAGE_KEY)).toBeNull();
    const { result } = renderHook(() => useConsent());

    act(() => result.current.choose('accepted'));

    expect(hasConsent('statistics')).toBe(true);
    expect(JSON.parse(window.sessionStorage.getItem(LANDING_TOUCH_STORAGE_KEY) ?? 'null')).toMatchObject({
      landingPath: '/p/affitti-brevi/lombardia/como',
      utm: { utm_source: 'newsletter' },
    });
    captureSignupAttribution(SIGNUP, '');
    expect(window.localStorage.getItem(PENDING_ATTRIBUTION_STORAGE_KEY)).not.toBeNull();

    act(() => result.current.choose('rejected'));

    expect(hasConsent('statistics')).toBe(false);
    expect(hasConsent('necessary')).toBe(true);
    expect(window.sessionStorage.getItem(LANDING_TOUCH_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(PENDING_ATTRIBUTION_STORAGE_KEY)).toBeNull();
  });
});
