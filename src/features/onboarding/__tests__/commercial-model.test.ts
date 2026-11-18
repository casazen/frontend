import { describe, expect, it } from 'vitest';
import { applicableAddons, commercialUnitPrice, signupRentalType, type CommercialSelection } from '../commercial-model';
import type { BillingPlan } from '@/types';
const plan: BillingPlan = { tier: 'Agency', displayName: 'Agency', priceMonthly: 12, currency: 'EUR', unitAllowance: -1, features: [], purchasable: true };
const addons = [{ code: 'channels', context: 'short-rent' as const, priceMonthly: 3, currency: 'EUR', purchasable: true }];
const agency: CommercialSelection = { profile: 'agency', planTier: 'Agency', rooms: 3, addons: ['channels'] };
describe('commercial onboarding pricing', () => {
  it('quotes one room including its selected add-on independently of the saved room count', () => {
    expect(commercialUnitPrice(plan, addons, agency)).toBe(15);
  });
  it('bills private owners the plan tariff once', () => {
    expect(commercialUnitPrice(plan, addons, { ...agency, profile: 'owner', rooms: 1 })).toBe(15);
  });
  it('does not present an unavailable price as free', () => {
    expect(commercialUnitPrice({ ...plan, priceMonthly: 0 }, addons, agency)).toBeNull();
    expect(commercialUnitPrice(plan, [{ ...addons[0], priceMonthly: null }], agency)).toBeNull();
    expect(commercialUnitPrice(plan, [], agency)).toBeNull();
  });
  it('starts long-rent alone and hides short-rent add-ons', () => {
    expect(signupRentalType('long-rent')).toBe('LongTerm');
    expect(signupRentalType('agency')).toBe('ShortTerm');
    expect(applicableAddons(addons, 'long-rent')).toEqual([]);
  });
});
