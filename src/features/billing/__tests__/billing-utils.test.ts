import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import {
  buildCheckoutReturnUrls,
  DEFAULT_BILLING_RETURN_PATH,
  isLiveSubscription,
  isVatIdShapeValid,
  normalizeSubscriptionStatus,
  normalizeVatId,
  redirectToStripe,
} from '../billing-utils';

const SITE = 'https://app.example.test';

describe('billing-utils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('buildCheckoutReturnUrls_DefaultPlanPage_SendsNoUrlSoTheBackendDefaultApplies', () => {
    expect(buildCheckoutReturnUrls(DEFAULT_BILLING_RETURN_PATH, SITE, SITE)).toEqual({});
  });

  it('buildCheckoutReturnUrls_OtherPageOnThePublicSite_ReturnsToThatPage', () => {
    expect(buildCheckoutReturnUrls('/app/long-rent/settings/plan', SITE, SITE)).toEqual({
      successUrl: `${SITE}/app/long-rent/settings/plan?checkout=success`,
      cancelUrl: `${SITE}/app/long-rent/settings/plan?checkout=cancel`,
    });
  });

  it('buildCheckoutReturnUrls_PreviewOrUnknownPublicSite_SendsNoUrlTheBackendWouldRefuse', () => {
    expect(buildCheckoutReturnUrls('/app/long-rent/settings/plan', 'https://preview.vercel.test', SITE)).toEqual({});
    expect(buildCheckoutReturnUrls('/app/long-rent/settings/plan', SITE, null)).toEqual({});
  });

  it('redirectToStripe_HttpsUrl_LeavesTheApp', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    redirectToStripe('https://checkout.stripe.com/c/pay/cs_test_1');

    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1');
  });

  it('redirectToStripe_ScriptOrRelativeUrl_Throws', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    expect(() => redirectToStripe('javascript:alert(1)')).toThrow();
    expect(() => redirectToStripe('/relative')).toThrow();
    expect(assign).not.toHaveBeenCalled();
  });

  it('isLiveSubscription_StatusesThatStillExistOnStripe_BlockANewCheckout', () => {
    for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'] as const) {
      expect(isLiveSubscription(status)).toBe(true);
    }
    expect(isLiveSubscription('canceled')).toBe(false);
    expect(isLiveSubscription('none')).toBe(false);
  });

  it('normalizeSubscriptionStatus_UnknownValue_IsNoSubscription', () => {
    expect(normalizeSubscriptionStatus('paused')).toBe('none');
    expect(normalizeSubscriptionStatus('past_due')).toBe('past_due');
  });

  it('normalizeVatId_SpacesDotsDashesAndCase_AreRemoved', () => {
    expect(normalizeVatId(' it 123.456.789-01 ')).toBe('IT12345678901');
    expect(isVatIdShapeValid('IT 123 456 789 01')).toBe(true);
    expect(isVatIdShapeValid('IT#1')).toBe(false);
    expect(isVatIdShapeValid('A1')).toBe(false);
  });

  it('isOrgBillingAdmin_HostOwnerOrPlatformAdmin_IsBillingAdmin', () => {
    expect(isOrgBillingAdmin([{ contextKey: 'short-rent' }])).toBe(true);
    expect(isOrgBillingAdmin([{ contextKey: 'admin' }])).toBe(true);
    expect(isOrgBillingAdmin([{ contextKey: 'long-rent' }, { contextKey: 'supplier' }])).toBe(false);
    expect(isOrgBillingAdmin([])).toBe(false);
  });
});
