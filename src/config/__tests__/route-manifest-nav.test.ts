import { describe, it, expect } from 'vitest';
import {
  ROUTE_MANIFEST,
  getDesktopNavByGroup,
  getDrawerNavByGroup,
  getOrgBillingPageAlternates,
  getPrimaryNavEntries,
  getSecondaryNavEntries,
  getVisibleNavEntries,
  isEntryFeatureEnabled,
} from '../route-manifest';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';

describe('route-manifest nav helpers', () => {
  const allowAll = () => true;
  const denyOta = (_ctx: string, permission: string) => permission !== 'ota.read';

  it('returns primary short-rent tabs in order', () => {
    const primary = getPrimaryNavEntries('short-rent', allowAll);
    expect(primary.map((e) => e.path)).toEqual([
      '/app/short-rent',
      '/app/short-rent/bookings',
      '/app/short-rent/bookings/calendar',
      '/app/short-rent/marketplace',
      '/app/short-rent/properties',
      '/app/short-rent/vetrina',
    ]);
  });

  it('disambiguates payment labels via navKey', () => {
    const secondary = getSecondaryNavEntries('short-rent', allowAll);
    const payments = secondary.find((e) => e.path === '/app/short-rent/payments');
    const stripe = secondary.find((e) => e.path === '/app/short-rent/settings/payments');
    const plan = secondary.find((e) => e.path === '/app/short-rent/settings/plan');
    expect(payments?.navKey).toBe('nav.payments');
    expect(stripe?.navKey).toBe('nav.stripeConnect');
    expect(stripe?.navGroup).toBe('account');
    expect(plan?.navGroup).toBe('account');
  });

  // TN-3 / PL-12: plan and billing are in the menu only for the org billing administrator.
  it('shows the plan and billing entries only to the org billing administrator', () => {
    const billingPaths = ['/app/short-rent/settings/plan', '/app/short-rent/settings/billing'];
    for (const path of billingPaths) {
      expect(ROUTE_MANIFEST.find((e) => e.path === path)?.orgBillingAdmin).toBe(true);
    }

    const notBillingAdmin = (_ctx: string, permission: string) => permission !== ORG_BILLING_ADMIN_PERMISSION;
    const hidden = getVisibleNavEntries('short-rent', notBillingAdmin).map((e) => e.path);
    expect(hidden.filter((path) => billingPaths.includes(path))).toEqual([]);
    expect(hidden).toContain('/app/short-rent/settings/payments');

    const visible = getSecondaryNavEntries('short-rent', allowAll).map((e) => e.path);
    expect(visible).toEqual(expect.arrayContaining(billingPaths));
    const billing = ROUTE_MANIFEST.find((e) => e.path === '/app/short-rent/settings/billing');
    expect(billing?.navKey).toBe('nav.billing');
    expect(billing?.navGroup).toBe('account');
  });

  // PL-16 (A1-36): a landlord with only long-term leases reaches plan and billing from the long-rent shell.
  it('has the plan and billing pages in the long-rent shell for the org billing administrator', () => {
    const billingPaths = ['/app/long-rent/settings/plan', '/app/long-rent/settings/billing'];
    for (const path of billingPaths) {
      const entry = ROUTE_MANIFEST.find((e) => e.path === path);
      expect(entry?.context).toBe('long-rent');
      expect(entry?.orgBillingAdmin).toBe(true);
      expect(entry?.requiredPermissions).toEqual([]);
    }

    const secondary = getSecondaryNavEntries('long-rent', allowAll).map((e) => e.path);
    expect(secondary).toEqual(billingPaths);
    const drawer = [...getDrawerNavByGroup('long-rent', allowAll).values()].flat().map((e) => e.path);
    expect(drawer).toEqual(billingPaths);

    const notBillingAdmin = (_ctx: string, permission: string) => permission !== ORG_BILLING_ADMIN_PERMISSION;
    const visible = getVisibleNavEntries('long-rent', notBillingAdmin).map((e) => e.path);
    expect(visible.filter((path) => billingPaths.includes(path))).toEqual([]);
  });

  it('maps each plan or billing page to the same page of the other rental shell', () => {
    const shortRentPlan = ROUTE_MANIFEST.find((e) => e.path === '/app/short-rent/settings/plan')!;
    const longRentBilling = ROUTE_MANIFEST.find((e) => e.path === '/app/long-rent/settings/billing')!;
    const leases = ROUTE_MANIFEST.find((e) => e.path === '/app/long-rent/leases')!;

    expect(getOrgBillingPageAlternates(shortRentPlan)).toEqual({ 'long-rent': '/app/long-rent/settings/plan' });
    expect(getOrgBillingPageAlternates(longRentBilling)).toEqual({ 'short-rent': '/app/short-rent/settings/billing' });
    expect(getOrgBillingPageAlternates(leases)).toEqual({});
  });

  it('hides OTA when ota.read permission is missing', () => {
    const visible = getVisibleNavEntries('short-rent', denyOta, { otaPartnerApi: true });
    expect(visible.some((e) => e.path === '/app/short-rent/ota')).toBe(false);
  });

  // FD-20 / D10: the OTA partner API is in freeze behind the otaPartnerApi flag.
  it('hides OTA channels while the otaPartnerApi flag is off, even with ota.read', () => {
    const flagOff = getVisibleNavEntries('short-rent', allowAll, { otaPartnerApi: false });
    const flagsNotLoaded = getVisibleNavEntries('short-rent', allowAll);
    const drawer = [...getDrawerNavByGroup('short-rent', allowAll, { otaPartnerApi: false }).values()].flat();
    const desktop = [...getDesktopNavByGroup('short-rent', allowAll, { otaPartnerApi: false }).values()].flat();

    for (const entries of [flagOff, flagsNotLoaded, drawer, desktop]) {
      expect(entries.some((e) => e.path.startsWith('/app/short-rent/ota'))).toBe(false);
    }
  });

  it('shows OTA channels when the otaPartnerApi flag is on', () => {
    const visible = getSecondaryNavEntries('short-rent', allowAll, { otaPartnerApi: true });
    expect(visible.some((e) => e.path === '/app/short-rent/ota')).toBe(true);
  });

  it('puts every /ota route behind the otaPartnerApi flag', () => {
    const otaRoutes = ROUTE_MANIFEST.filter((e) => e.path.startsWith('/app/short-rent/ota'));
    expect(otaRoutes.length).toBeGreaterThan(0);
    for (const entry of otaRoutes) {
      expect(entry.featureFlag).toBe('otaPartnerApi');
      expect(isEntryFeatureEnabled(entry, { otaPartnerApi: false })).toBe(false);
    }
  });

  // A7-06: a long-term landlord manages its properties (and their APE) inside the long-rent context.
  it('returns primary long-rent tabs with the properties of the landlord', () => {
    const primary = getPrimaryNavEntries('long-rent', allowAll);
    expect(primary.map((e) => e.path)).toEqual([
      '/app/long-rent/leases',
      '/app/long-rent/properties',
      '/app/long-rent/profile',
    ]);
  });

  it('gates the long-rent property routes on property permissions, never on short-stay ones', () => {
    const propertyRoutes = ROUTE_MANIFEST.filter((e) => e.path.startsWith('/app/long-rent/properties'));
    expect(propertyRoutes.map((e) => e.path)).toEqual([
      '/app/long-rent/properties',
      '/app/long-rent/properties/new',
      '/app/long-rent/properties/:id',
      '/app/long-rent/properties/:id/edit',
    ]);
    for (const entry of propertyRoutes) {
      expect(entry.context).toBe('long-rent');
      expect(entry.requiredPermissions.every((p) => p.startsWith('property.'))).toBe(true);
    }
    const withoutProperty = (_ctx: string, permission: string) => !permission.startsWith('property.');
    expect(getVisibleNavEntries('long-rent', withoutProperty).some((e) => e.path.includes('/properties'))).toBe(false);
  });

  it('keeps the iCal-based calendar available with the otaPartnerApi flag off', () => {
    const primary = getPrimaryNavEntries('short-rent', allowAll, { otaPartnerApi: false });
    expect(primary.some((e) => e.path === '/app/short-rent/bookings/calendar')).toBe(true);
  });

  // A1-16: the CIN audit page existed but had no route, so the admin had no menu entry or URL for it.
  it('makes the admin CIN audit route reachable and visible in the admin menu', () => {
    const entry = ROUTE_MANIFEST.find((e) => e.path === '/app/admin/cin');
    expect(entry?.context).toBe('admin');
    expect(entry?.requiredPermissions).toEqual(['admin.cin.read']);
    expect(entry?.navGroup).toBe('compliance-audit');
    expect(entry?.legacyPaths).toContain('/admin/cin');

    const visible = getVisibleNavEntries('admin', allowAll).map((e) => e.path);
    expect(visible).toContain('/app/admin/cin');

    const withoutCinRead = (_ctx: string, permission: string) => permission !== 'admin.cin.read';
    const hiddenPaths = getVisibleNavEntries('admin', withoutCinRead).map((e) => e.path);
    expect(hiddenPaths).not.toContain('/app/admin/cin');
  });
});
