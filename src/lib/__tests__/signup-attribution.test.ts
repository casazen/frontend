import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';

vi.mock('@/api/users.api', () => ({
  UsersApi: { recordSignupAttribution: vi.fn() },
}));

import { UsersApi } from '@/api/users.api';
import {
  LANDING_TOUCH_STORAGE_KEY,
  PENDING_ATTRIBUTION_STORAGE_KEY,
  PENDING_ATTRIBUTION_TTL_MS,
  buildSignupCtaHref,
  captureSignupAttribution,
  markSignupAttributionReady,
  readPendingSignupAttribution,
  readUtm,
  recordLandingTouch,
  syncSignupAttribution,
} from '../signup-attribution';

const ORIGIN = 'https://public-site.example.test';
const NOW = 1_790_000_000_000;

function httpError(status: number): AxiosError {
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, { status, data: {} } as AxiosResponse);
}

function storedPending(): { ready: boolean } | null {
  const raw = window.localStorage.getItem(PENDING_ATTRIBUTION_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { ready: boolean }) : null;
}

describe('signup attribution (SE-03)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.mocked(UsersApi.recordSignupAttribution).mockReset();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('readUtm_ValuesOutsideTheBackendRules_AreDropped', () => {
    const utm = readUtm(
      `?utm_source=google&utm_medium=cpc&utm_campaign=${encodeURIComponent('mario@example.com')}` +
        `&utm_term=${'a'.repeat(101)}&utm_content=${encodeURIComponent('<b>')}`,
    );

    expect(utm).toEqual({ utm_source: 'google', utm_medium: 'cpc' });
  });

  it('captureSignupAttribution_LandingTouchOfTheVisit_IsUsedForLandingPathAndReferrer', () => {
    recordLandingTouch(
      { pathname: '/p/affitti-brevi/lombardia/como', search: '?utm_source=newsletter', origin: ORIGIN },
      'https://www.google.com/',
    );

    const attribution = captureSignupAttribution(
      { pathname: '/signup', search: '?comune=Como&utm_source=seo-compliance&utm_medium=cta', origin: ORIGIN },
      `${ORIGIN}/p/affitti-brevi/lombardia/como`,
      NOW,
    );

    expect(attribution).toEqual({
      utmSource: 'seo-compliance',
      utmMedium: 'cta',
      comune: 'como',
      landingPath: '/p/affitti-brevi/lombardia/como',
      referrerHost: 'www.google.com',
    });
    expect(readPendingSignupAttribution(NOW)).toEqual(attribution);
  });

  it('captureSignupAttribution_WithoutTouch_UsesTheLinkingPageOfThisSite', () => {
    const attribution = captureSignupAttribution(
      { pathname: '/signup', search: '?comune=../../etc', origin: ORIGIN },
      `${ORIGIN}/p/tassa-soggiorno/como?x=1`,
      NOW,
    );

    // Invalid comune dropped; landing path without query string; own site is not a referrer.
    expect(attribution).toEqual({ landingPath: '/p/tassa-soggiorno/como' });
  });

  it('readPendingSignupAttribution_OlderThan30Days_IsForgotten', () => {
    captureSignupAttribution({ pathname: '/signup', search: '?utm_source=google', origin: ORIGIN }, '', NOW);

    expect(readPendingSignupAttribution(NOW + PENDING_ATTRIBUTION_TTL_MS + 1)).toBeNull();
    expect(window.localStorage.getItem(PENDING_ATTRIBUTION_STORAGE_KEY)).toBeNull();
  });

  it('buildSignupCtaHref_VisitWithUtm_ReplacesTheDefaultSetAndKeepsComune', () => {
    const href = buildSignupCtaHref(
      `${ORIGIN}/signup?comune=como&utm_source=seo-compliance&utm_medium=cta&utm_content=compliance-guide`,
      { search: '?utm_source=newsletter&utm_campaign=settembre', origin: ORIGIN },
    );

    const url = new URL(href);
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe('/signup');
    expect(url.searchParams.get('comune')).toBe('como');
    expect(url.searchParams.get('utm_source')).toBe('newsletter');
    expect(url.searchParams.get('utm_campaign')).toBe('settembre');
    expect(url.searchParams.get('utm_medium')).toBeNull();
    expect(url.searchParams.get('utm_content')).toBeNull();
  });

  it('buildSignupCtaHref_UtmOnlyOnTheLandingPage_ComeFromTheTouch', () => {
    window.sessionStorage.setItem(
      LANDING_TOUCH_STORAGE_KEY,
      JSON.stringify({ landingPath: '/p/affitti-brevi', utm: { utm_source: 'google', utm_medium: 'cpc' } }),
    );

    const href = buildSignupCtaHref('/signup?comune=como&utm_source=seo-compliance&utm_medium=cta', {
      search: '',
      origin: ORIGIN,
    });

    expect(href).toBe('/signup?comune=como&utm_source=google&utm_medium=cpc');
  });

  it('buildSignupCtaHref_VisitWithoutUtm_KeepsTheBackendLink', () => {
    const signupUrl = `${ORIGIN}/signup?comune=como&utm_source=seo-compliance&utm_medium=cta`;

    expect(buildSignupCtaHref(signupUrl, { search: '', origin: ORIGIN })).toBe(signupUrl);
  });

  it('syncSignupAttribution_ReadyAfterTheFirstOnboarding_SendsItOnceAndForgetsIt', async () => {
    const attribution = captureSignupAttribution(
      { pathname: '/signup', search: '?comune=como&utm_source=seo-compliance', origin: ORIGIN },
      '',
      Date.now(),
    );
    markSignupAttributionReady();
    vi.mocked(UsersApi.recordSignupAttribution).mockResolvedValue({ recorded: true });

    await expect(syncSignupAttribution()).resolves.toBe('sent');
    await expect(syncSignupAttribution()).resolves.toBe('none');

    expect(UsersApi.recordSignupAttribution).toHaveBeenCalledTimes(1);
    expect(UsersApi.recordSignupAttribution).toHaveBeenCalledWith(attribution);
  });

  it('syncSignupAttribution_NotReady_AccountAlreadyOnboarded_IsDiscardedWithoutSending', async () => {
    captureSignupAttribution({ pathname: '/signup', search: '?utm_source=google', origin: ORIGIN }, '', Date.now());

    await expect(syncSignupAttribution()).resolves.toBe('discarded');

    expect(UsersApi.recordSignupAttribution).not.toHaveBeenCalled();
    expect(storedPending()).toBeNull();
  });

  it('syncSignupAttribution_RefusedByTheBackend_IsNotRetried', async () => {
    captureSignupAttribution({ pathname: '/signup', search: '?utm_source=google', origin: ORIGIN }, '', Date.now());
    markSignupAttributionReady();
    vi.mocked(UsersApi.recordSignupAttribution).mockRejectedValue(httpError(422));

    await expect(syncSignupAttribution()).resolves.toBe('discarded');
    expect(storedPending()).toBeNull();
  });

  it('syncSignupAttribution_ServerOrNetworkError_KeepsItForTheNextLoad', async () => {
    captureSignupAttribution({ pathname: '/signup', search: '?utm_source=google', origin: ORIGIN }, '', Date.now());
    markSignupAttributionReady();
    vi.mocked(UsersApi.recordSignupAttribution).mockRejectedValue(httpError(503));

    await expect(syncSignupAttribution()).resolves.toBe('kept');
    expect(storedPending()?.ready).toBe(true);
  });

  it('captureSignupAttribution_AttributionAlreadyWaitingToBeSent_IsNotReplaced', () => {
    const first = captureSignupAttribution(
      { pathname: '/signup', search: '?comune=como', origin: ORIGIN },
      '',
      NOW,
    );
    markSignupAttributionReady(NOW);

    captureSignupAttribution({ pathname: '/signup', search: '?comune=roma', origin: ORIGIN }, '', NOW + 1);

    expect(readPendingSignupAttribution(NOW + 1)).toEqual(first);
  });
});
