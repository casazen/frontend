import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import {
  isLiveSubscription,
  isVatIdShapeValid,
  normalizeSubscriptionStatus,
  normalizeVatId,
  redirectToStripe,
} from '../billing-utils';

describe('billing-utils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('isOrgBillingAdmin_OwnerOfEitherRentalContextOrPlatformAdmin_IsBillingAdmin', () => {
    expect(isOrgBillingAdmin([{ contextKey: 'short-rent' }])).toBe(true);
    // PL-16 (A1-36): a landlord with only long-term leases manages the plan of its org.
    expect(isOrgBillingAdmin([{ contextKey: 'long-rent' }])).toBe(true);
    expect(isOrgBillingAdmin([{ contextKey: 'admin' }])).toBe(true);
    expect(isOrgBillingAdmin([{ contextKey: 'supplier' }])).toBe(false);
    expect(isOrgBillingAdmin([])).toBe(false);
  });
});
