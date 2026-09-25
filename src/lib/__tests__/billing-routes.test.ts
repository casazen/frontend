import { describe, expect, it } from 'vitest';
import { billingPagePath, planPagePath, resolveBillingContext, toBillingReturnPath } from '../billing-routes';
import { getPlanUpgradePath } from '../entitlement-error';

// PL-16 (A1-36): plan and billing pages in each rental shell; the return pages allowed by the backend.
describe('billing-routes', () => {
  it('planPagePath_EachRentalContext_IsThePageOfItsShell', () => {
    expect(planPagePath('short-rent')).toBe('/app/short-rent/settings/plan');
    expect(planPagePath('long-rent')).toBe('/app/long-rent/settings/plan');
    expect(billingPagePath('long-rent')).toBe('/app/long-rent/settings/billing');
  });

  it('getPlanUpgradePath_LongRent_NeverTheShortRentPage', () => {
    expect(getPlanUpgradePath('long-rent')).toBe('/app/long-rent/settings/plan');
    expect(getPlanUpgradePath('short-rent')).toBe('/app/short-rent/settings/plan');
  });

  it('resolveBillingContext_RentalShell_IsTheCurrentShell', () => {
    expect(resolveBillingContext('/app/long-rent/leases', ['long-rent'])).toBe('long-rent');
    expect(resolveBillingContext('/app/short-rent/properties', ['short-rent', 'long-rent'])).toBe('short-rent');
    expect(resolveBillingContext('/app/long-rent/properties/1', ['short-rent', 'long-rent'])).toBe('long-rent');
  });

  it('resolveBillingContext_AdminOrSupplierShell_IsARentalContextOfTheUser', () => {
    expect(resolveBillingContext('/app/admin/users', ['admin', 'long-rent'])).toBe('long-rent');
    expect(resolveBillingContext('/app/admin', ['admin', 'long-rent', 'short-rent'])).toBe('short-rent');
    expect(resolveBillingContext('/app/supplier/inbox', ['supplier'])).toBeNull();
    expect(resolveBillingContext('/app/admin', ['admin'])).toBeNull();
  });

  it('toBillingReturnPath_PlanOrBillingPage_IsSentAsReturnPath', () => {
    expect(toBillingReturnPath('/app/long-rent/settings/plan')).toBe('/app/long-rent/settings/plan');
    expect(toBillingReturnPath('/app/long-rent/settings/billing/')).toBe('/app/long-rent/settings/billing');
    expect(toBillingReturnPath('/app/short-rent/settings/plan')).toBe('/app/short-rent/settings/plan');
  });

  it('toBillingReturnPath_OtherPage_IsNotSentTheBackendWouldRefuseIt', () => {
    expect(toBillingReturnPath('/app/long-rent/leases')).toBeUndefined();
    expect(toBillingReturnPath('/app/admin/settings/plan')).toBeUndefined();
    expect(toBillingReturnPath('/')).toBeUndefined();
  });
});
