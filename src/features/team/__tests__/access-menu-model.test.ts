import { describe, expect, it } from 'vitest';
import type { OrgRole, OrgRoleInfo } from '@/types/org-team.types';
import { buildAreaMenus } from '../access-menu-model';

function role(name: OrgRole, permissionsByContext: Record<string, string[]>): OrgRoleInfo {
  return {
    role: name,
    assignable: true,
    scopeSupported: name === 'Collaborator',
    permissionsByContext: Object.fromEntries(Object.entries(permissionsByContext).map(([context, permissions]) => [context, { roleKey: `${context}_${name}`, permissions }])),
    capabilities: [],
  };
}

const pathsOf = (menus: ReturnType<typeof buildAreaMenus>, area: string) => {
  const menu = menus.find((candidate) => candidate.area === area);
  return [...(menu?.main ?? []), ...(menu?.more ?? [])].map((entry) => entry.path);
};

describe('buildAreaMenus', () => {
  const admin = role('Admin', { account: ['org.members.manage', 'org.settings.manage', 'org.billing.manage'] });
  const accountant = role('Accountant', { account: ['org.billing.read'] });

  it('buildAreaMenus_AdministratorOfTheAccount_FindsPeopleBillingAndSettings', () => {
    const paths = pathsOf(buildAreaMenus(admin, []), 'account');

    expect(paths).toEqual(expect.arrayContaining(['/app/account/people', '/app/account/billing', '/app/account/settings']));
  });

  it('buildAreaMenus_AccountantOfTheAccount_DoesNotFindPeopleBillingOrSettings', () => {
    const paths = pathsOf(buildAreaMenus(accountant, []), 'account');

    expect(paths).not.toContain('/app/account/people');
    expect(paths).not.toContain('/app/account/billing');
    expect(paths).not.toContain('/app/account/settings');
  });

  it('buildAreaMenus_RentalAreaNotGiven_CannotEnterAndHasNoPages', () => {
    const collaborator = role('Collaborator', { 'short-rent': ['property.read', 'booking.read'] });
    const menus = buildAreaMenus(collaborator, ['short-rent']);

    expect(menus.find((menu) => menu.area === 'short-rent')?.enters).toBe(true);
    const longRent = menus.find((menu) => menu.area === 'long-rent');
    expect(longRent).toEqual({ area: 'long-rent', enters: false, main: [], more: [] });
    expect(menus.find((menu) => menu.area === 'account')?.enters).toBe(false);
  });
});
