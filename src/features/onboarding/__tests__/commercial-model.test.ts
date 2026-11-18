import { describe, expect, it } from 'vitest';
import { applicableAddons, commercialTotal, signupRentalType, type CommercialSelection } from '../commercial-model';
import type { BillingPlan } from '@/types';
const plan: BillingPlan = { tier: 'Agency', displayName: 'Agency', priceMonthly: 12, currency: 'EUR', unitAllowance: -1, features: [], purchasable: true };
const addons = [{ code: 'channels', context: 'short-rent' as const, priceMonthly: 3, currency: 'EUR', purchasable: true }];
const agency: CommercialSelection = { profile: 'agency', planTier: 'Agency', rooms: 3, addons: ['channels'] };
describe('commercial onboarding pricing', () => {
  it('bills three rooms, including the selected per-room add-on', () => {
    expect(commercialTotal(plan, addons, agency)).toBe(45);
  });
  it('bills private owners the plan tariff once', () => {
    expect(commercialTotal(plan, addons, { ...agency, profile: 'owner', rooms: 1 })).toBe(15);
  });
  it('does not present an unavailable price as free', () => {
    expect(commercialTotal({ ...plan, priceMonthly: 0 }, addons, agency)).toBeNull();
    expect(commercialTotal(plan, [{ ...addons[0], priceMonthly: null }], agency)).toBeNull();
    expect(commercialTotal(plan, [], agency)).toBeNull();
  });
  it('starts long-rent alone and hides short-rent add-ons', () => {
    expect(signupRentalType({ ...agency, profile: 'long-rent' })).toBe('LongTerm');
    expect(signupRentalType(agency)).toBe('ShortTerm');
    expect(applicableAddons(addons, 'LongTerm')).toEqual([]);
    expect(applicableAddons(addons, 'Both')).toEqual(addons);
  });
});
