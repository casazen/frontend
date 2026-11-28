import { describe, expect, it } from 'vitest';
import type { ContextBootstrapDto } from '@/api/contexts';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { MEMBER_ROLE_KEYS, contextOf } from '@/test/org-contexts';

describe('isOrgBillingAdmin', () => {
  it.each([
    ['short-rent', 'property_owner'],
    ['long-rent', 'long_term_landlord'],
    ['admin', 'platform_admin'],
  ] as const)('isOrgBillingAdmin_%s_HeldAs_%s_IsBillingAdmin', (contextKey, roleKey) => {
    expect(isOrgBillingAdmin([contextOf(contextKey, roleKey)])).toBe(true);
  });

  it.each(MEMBER_ROLE_KEYS)('isOrgBillingAdmin_MemberWithRoleKey_%s_IsNotBillingAdmin', (roleKey) => {
    expect(isOrgBillingAdmin([contextOf('short-rent', roleKey)])).toBe(false);
    expect(isOrgBillingAdmin([contextOf('long-rent', roleKey)])).toBe(false);
    expect(isOrgBillingAdmin([contextOf('short-rent', roleKey), contextOf('long-rent', roleKey)])).toBe(false);
  });

  it('isOrgBillingAdmin_OwnerRoleKeyOfAnotherContext_IsNotBillingAdmin', () => {
    expect(isOrgBillingAdmin([contextOf('short-rent', 'long_term_landlord')])).toBe(false);
    expect(isOrgBillingAdmin([contextOf('long-rent', 'property_owner')])).toBe(false);
    expect(isOrgBillingAdmin([contextOf('short-rent', 'platform_admin')])).toBe(false);
    expect(isOrgBillingAdmin([contextOf('admin', 'property_owner')])).toBe(false);
  });

  it('isOrgBillingAdmin_SupplierContext_IsNotBillingAdmin', () => {
    expect(isOrgBillingAdmin([contextOf('supplier')])).toBe(false);
  });

  it('isOrgBillingAdmin_OneOwnerContextAmongOthers_IsBillingAdmin', () => {
    expect(isOrgBillingAdmin([contextOf('supplier'), contextOf('long-rent', 'staff'), contextOf('short-rent')])).toBe(true);
  });

  it('isOrgBillingAdmin_NoContexts_IsNotBillingAdmin', () => {
    expect(isOrgBillingAdmin([])).toBe(false);
  });

  it('isOrgBillingAdmin_ContextWithoutRoleKey_IsNotBillingAdmin', () => {
    const withoutRoleKey = { contextKey: 'short-rent' } as unknown as Pick<ContextBootstrapDto, 'contextKey' | 'roleKey'>;

    expect(isOrgBillingAdmin([{ contextKey: 'short-rent', roleKey: '' }])).toBe(false);
    expect(isOrgBillingAdmin([withoutRoleKey])).toBe(false);
  });
});
