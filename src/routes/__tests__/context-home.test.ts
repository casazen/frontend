import { describe, expect, it } from 'vitest';
import { ROUTE_MANIFEST, type AppContextKey, type PermissionPredicate } from '@/config/route-manifest';
import { getContextHomeRoute, getFirstOpenablePage } from '../context-home';

function grants(contextKey: AppContextKey, permissions: string[]): PermissionPredicate {
  return (key, permission) => key === contextKey && (!permission || permissions.includes(permission));
}

const NO_FLAGS = {};

describe('getContextHomeRoute (UI-00)', () => {
  it('getContextHomeRoute_LongRentLandlord_ReturnsTheOverview', () => {
    const hasPermission = grants('long-rent', ['property.read', 'lease.read']);

    expect(getContextHomeRoute('long-rent', hasPermission, NO_FLAGS)).toBe('/app/long-rent');
  });

  it('getContextHomeRoute_Supplier_ReturnsTheDashboard', () => {
    expect(getContextHomeRoute('supplier', grants('supplier', []), NO_FLAGS)).toBe('/app/supplier/dashboard');
  });

  it('getContextHomeRoute_ShortRentAndAdmin_ReturnTheirOwnRootPage', () => {
    expect(getContextHomeRoute('short-rent', grants('short-rent', []), NO_FLAGS)).toBe('/app/short-rent');
    expect(getContextHomeRoute('admin', grants('admin', ['admin.stats.read']), NO_FLAGS)).toBe('/app/admin');
  });

  it('getContextHomeRoute_NoLeasePermission_ReturnsTheFirstMenuPageTheUserCanOpen', () => {
    const hasPermission = grants('long-rent', ['property.read']);

    expect(getContextHomeRoute('long-rent', hasPermission, NO_FLAGS)).toBe('/app/long-rent/properties');
  });

  it('getContextHomeRoute_NoPermissionAtAll_ReturnsThePageThatAsksForNone', () => {
    // The profile is not in the menu of the area any more (the menu of the user leads to it), and it is still the page that opens.
    expect(getContextHomeRoute('long-rent', grants('long-rent', []), NO_FLAGS)).toBe('/app/long-rent/profile');
  });

  it('getFirstOpenablePage_AMenuPageOpens_ReturnsTheFirstOneAndNotTheProfile', () => {
    expect(getFirstOpenablePage('long-rent', grants('long-rent', ['property.read']), NO_FLAGS)).toBe('/app/long-rent/properties');
    expect(getFirstOpenablePage('short-rent', grants('short-rent', []), NO_FLAGS)).toBe('/app/short-rent');
  });

  it('getFirstOpenablePage_NothingInTheMenu_ReturnsTheProfileOfTheAreaOrNothing', () => {
    expect(getFirstOpenablePage('long-rent', grants('long-rent', []), NO_FLAGS)).toBe('/app/long-rent/profile');
    // Every page of the admin area, the profile included, asks for a permission.
    expect(getFirstOpenablePage('admin', grants('admin', []), NO_FLAGS)).toBeUndefined();
  });

  it('getContextHomeRoute_NothingTheUserCanOpen_ReturnsTheDefaultPageSoItsOwnGuardAnswers', () => {
    // Every page of the admin area asks for a permission.
    expect(getContextHomeRoute('admin', grants('admin', []), NO_FLAGS)).toBe('/app/admin');
  });

  it('getContextHomeRoute_EveryAreaOfTheManifest_ReturnsAPageOfThatAreaForAFullAccessUser', () => {
    const everything: PermissionPredicate = () => true;
    const contextKeys = [...new Set(ROUTE_MANIFEST.map((entry) => entry.context))];

    for (const contextKey of contextKeys) {
      const home = getContextHomeRoute(contextKey, everything, NO_FLAGS);
      const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === home);

      expect(entry?.context, `${contextKey} -> ${home}`).toBe(contextKey);
    }
  });
});
