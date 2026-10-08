import { describe, it, expect } from 'vitest';
import {
  MAX_BOTTOM_NAV_ENTRIES,
  MAX_PRIMARY_NAV_ENTRIES,
  ROUTE_MANIFEST,
  getBottomNavEntries,
  getContextNav,
  getNavChildren,
  getNavMatchEntries,
  getOrgBillingPageAlternates,
  getPrimaryNavEntries,
  getSecondaryNavEntries,
  getVisibleNavEntries,
  hasEntryPermission,
  isEntryFeatureEnabled,
  type AppContextKey,
  type PermissionPredicate,
  type RouteManifestEntry,
} from '../route-manifest';
import type { FeatureFlags } from '../feature-flags';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { NAV_ICONS } from '@/lib/nav-icons';
import { planPagePath, billingPagePath } from '@/lib/billing-routes';

const CONTEXTS: AppContextKey[] = ['short-rent', 'long-rent', 'supplier', 'admin'];

const allowAll = () => true;
const notBillingAdmin: PermissionPredicate = (_ctx, permission) => permission !== ORG_BILLING_ADMIN_PERMISSION;
const without = (...denied: string[]): PermissionPredicate => (_ctx, permission) => !denied.includes(permission);
const paths = (entries: RouteManifestEntry[]) => entries.map((entry) => entry.path);
const entryOf = (path: string) => {
  const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === path);
  if (!entry) throw new Error(`no manifest entry for ${path}`);
  return entry;
};

/** Every way of being a user of an area for the invariants: all the permissions, none, each one taken away; flags on and off. */
function userVariants(contextKey: AppContextKey) {
  const permissions = new Set<string>();
  for (const entry of ROUTE_MANIFEST.filter((candidate) => candidate.context === contextKey)) {
    entry.requiredPermissions.forEach((permission) => permissions.add(permission));
    if (entry.orgBillingAdmin) permissions.add(ORG_BILLING_ADMIN_PERMISSION);
  }
  const predicates: [string, PermissionPredicate][] = [
    ['everything', allowAll],
    ['nothing', (_ctx, permission) => !permission],
    ...[...permissions].map((permission): [string, PermissionPredicate] => [`everything but ${permission}`, without(permission)]),
  ];
  const flagSets: [string, Partial<FeatureFlags>][] = [
    ['flags off', {}],
    ['otaPartnerApi on', { otaPartnerApi: true }],
  ];
  return predicates.flatMap(([userLabel, hasPermission]) =>
    flagSets.map(([flagLabel, features]) => ({ label: `${userLabel}, ${flagLabel}`, hasPermission, features })),
  );
}

describe('route-manifest main menu (UI-04a)', () => {
  it('returns the primary short-rent entries in order, seven at most', () => {
    const primary = getPrimaryNavEntries('short-rent', allowAll);
    expect(paths(primary)).toEqual([
      '/app/short-rent',
      '/app/short-rent/bookings/calendar',
      '/app/short-rent/bookings',
      '/app/short-rent/properties',
      '/app/short-rent/vetrina',
      '/app/short-rent/marketplace',
      '/app/short-rent/payments',
    ]);
    expect(primary).toHaveLength(MAX_PRIMARY_NAV_ENTRIES);
  });

  it('puts the rest of short-rent in "Altro", the OTA channels only with their flag', () => {
    const withoutFlag = paths(getSecondaryNavEntries('short-rent', allowAll));
    expect(withoutFlag).toEqual([
      '/app/short-rent/guests',
      '/app/short-rent/compliance',
      '/app/short-rent/payments/revenue',
      '/app/short-rent/fiscal',
      '/app/short-rent/profile',
      '/app/short-rent/settings/payments',
      '/app/short-rent/settings/domain',
      '/app/short-rent/settings/organization',
    ]);

    const withFlag = paths(getSecondaryNavEntries('short-rent', allowAll, { otaPartnerApi: true }));
    expect(withFlag).toContain('/app/short-rent/ota');
    expect(withFlag.indexOf('/app/short-rent/ota')).toBe(withFlag.indexOf('/app/short-rent/fiscal') + 1);
  });

  it('keeps the long-rent, supplier and staff menus to the pages they have', () => {
    expect(paths(getPrimaryNavEntries('long-rent', allowAll))).toEqual([
      '/app/long-rent/leases',
      '/app/long-rent/properties',
    ]);
    expect(paths(getSecondaryNavEntries('long-rent', allowAll))).toEqual([
      '/app/long-rent/profile',
      '/app/long-rent/settings/organization',
    ]);

    expect(paths(getPrimaryNavEntries('supplier', allowAll))).toEqual([
      '/app/supplier/dashboard',
      '/app/supplier/inbox',
      '/app/supplier/availability',
      '/app/supplier/showcase',
    ]);
    expect(paths(getSecondaryNavEntries('supplier', allowAll))).toEqual([
      '/app/supplier/profile',
      '/app/supplier/help/ical',
    ]);

    // Staff: eight primary entries became six, the compliance audit standing for the three compliance pages.
    expect(paths(getPrimaryNavEntries('admin', allowAll))).toEqual([
      '/app/admin',
      '/app/admin/users',
      '/app/admin/suppliers',
      '/app/admin/jobs',
      '/app/admin/seo',
      '/app/admin/cin',
    ]);
    expect(paths(getSecondaryNavEntries('admin', allowAll))).toEqual([
      '/app/admin/suppliers/invite',
      '/app/admin/profile',
    ]);
  });

  it.each(CONTEXTS)('%s: at most seven primary entries for every role and flag', (contextKey) => {
    for (const { label, hasPermission, features } of userVariants(contextKey)) {
      const primary = getPrimaryNavEntries(contextKey, hasPermission, features);
      expect(primary.length, `${contextKey} for ${label}`).toBeLessThanOrEqual(MAX_PRIMARY_NAV_ENTRIES);
    }
  });

  it.each(CONTEXTS)('%s: the primary entries have a group and the groups are not interleaved', (contextKey) => {
    for (const { label, hasPermission, features } of userVariants(contextKey)) {
      const groups = getPrimaryNavEntries(contextKey, hasPermission, features).map((entry) => entry.navGroup);
      expect(groups.every((group) => group !== undefined), `${contextKey} for ${label}`).toBe(true);
      const firstSeen = [...new Set(groups)];
      // `a a b b` is fine, `a b a` is not: a group is one run of entries.
      expect(groups.join('|'), `${contextKey} for ${label}`).toBe(
        firstSeen.flatMap((group) => groups.filter((candidate) => candidate === group)).join('|'),
      );
    }
  });

  it('lists the sections of the sidebar and "Altro" from the same entries', () => {
    const nav = getContextNav('short-rent', allowAll, { otaPartnerApi: true });
    expect(nav.sections.map((section) => section.group)).toEqual(['everyday', 'offer', 'management']);
    expect(nav.sections.map((section) => section.entries.length)).toEqual([3, 3, 1]);
    expect(paths(nav.more)).toEqual(paths(getSecondaryNavEntries('short-rent', allowAll, { otaPartnerApi: true })));
  });

  it('keeps every menu entry labelled and with an icon of the table', () => {
    for (const entry of ROUTE_MANIFEST.filter((candidate) => candidate.navPlacement || candidate.navParent)) {
      expect(entry.navKey ?? entry.navLabel, entry.path).toBeTruthy();
      // An unknown icon name quietly falls back to the dashboard one.
      expect(NAV_ICONS[entry.icon ?? ''], `${entry.path} icon ${entry.icon}`).toBeDefined();
    }
  });

  it('gives a counter only to the entries whose number is already read by the app', () => {
    const counted = ROUTE_MANIFEST.filter((entry) => entry.navCount).map((entry) => [entry.path, entry.navCount]);
    expect(counted).toEqual([
      ['/app/short-rent/bookings', 'bookingRequests'],
      ['/app/supplier/inbox', 'supplierRequests'],
    ]);
  });
});

describe('route-manifest bottom bar (UI-04a, drawn by UI-04b)', () => {
  it('names the four destinations of the phone bar for short-rent', () => {
    expect(paths(getBottomNavEntries('short-rent', allowAll))).toEqual([
      '/app/short-rent',
      '/app/short-rent/bookings/calendar',
      '/app/short-rent/bookings',
      '/app/short-rent/properties',
    ]);
  });

  it.each(CONTEXTS)('%s: at most four destinations, in order, all of them in the main menu', (contextKey) => {
    for (const { label, hasPermission, features } of userVariants(contextKey)) {
      const bottom = getBottomNavEntries(contextKey, hasPermission, features);
      expect(bottom.length, `${contextKey} for ${label}`).toBeLessThanOrEqual(MAX_BOTTOM_NAV_ENTRIES);
      expect(bottom.every((entry) => entry.navPlacement === 'primary'), `${contextKey} for ${label}`).toBe(true);
    }
    const places = ROUTE_MANIFEST.filter((entry) => entry.context === contextKey && entry.navBottom !== undefined).map(
      (entry) => entry.navBottom,
    );
    expect(places.sort()).toEqual(places.map((_, index) => index + 1));
  });

  it('leaves a destination out when the user cannot open it', () => {
    const bottom = getBottomNavEntries('short-rent', without('property.read'));
    expect(paths(bottom)).not.toContain('/app/short-rent/properties');
    expect(paths(bottom)).toContain('/app/short-rent');
  });

  it('keeps what the bar does not list in the phone menu', () => {
    const nav = getContextNav('short-rent', allowAll, {}, { withoutBottom: true });
    expect(nav.sections.flatMap((section) => paths(section.entries))).toEqual([
      '/app/short-rent/vetrina',
      '/app/short-rent/marketplace',
      '/app/short-rent/payments',
    ]);
    expect(paths(nav.more)).toContain('/app/short-rent/profile');
  });
});

describe('route-manifest pages that hang from a menu entry (UI-04a)', () => {
  const hanging = ROUTE_MANIFEST.filter((entry) => entry.navParent);

  it('lists the pages that hang from the entries of the old menus', () => {
    expect(hanging.map((entry) => [entry.path, entry.navParent])).toEqual([
      ['/app/short-rent/settings/site-appearance', '/app/short-rent/vetrina'],
      ['/app/short-rent/settings/site-documents', '/app/short-rent/vetrina'],
      ['/app/short-rent/alloggiati', '/app/short-rent/compliance'],
      ['/app/short-rent/compliance/cin', '/app/short-rent/compliance'],
      ['/app/admin/compliance/tax-rates', '/app/admin/cin'],
      ['/app/admin/compliance/ltr-reference-data', '/app/admin/cin'],
      ['/app/supplier/calendar', '/app/supplier/availability'],
    ]);
  });

  it('hangs only from an entry of the menus of the same area, and never from another page that hangs', () => {
    for (const entry of hanging) {
      const parent = entryOf(entry.navParent!);
      expect(parent.context, entry.path).toBe(entry.context);
      expect(parent.navPlacement, `${entry.path} hangs from ${parent.path}`).toBeDefined();
      expect(parent.navParent, `${entry.path} hangs from ${parent.path}`).toBeUndefined();
      // A page that hangs is in no menu and has no counter or place in the bar of its own.
      expect(entry.navPlacement, entry.path).toBeUndefined();
      expect(entry.navGroup, entry.path).toBeUndefined();
      expect(entry.navBottom, entry.path).toBeUndefined();
      expect(entry.navCount, entry.path).toBeUndefined();
    }
  });

  it('is in no menu while the entry it hangs from is open to the user, and is listed by that page', () => {
    const visible = paths(getVisibleNavEntries('short-rent', allowAll));
    expect(visible).not.toContain('/app/short-rent/alloggiati');
    expect(visible).not.toContain('/app/short-rent/compliance/cin');
    expect(paths(getNavChildren('/app/short-rent/compliance', allowAll))).toEqual([
      '/app/short-rent/alloggiati',
      '/app/short-rent/compliance/cin',
    ]);
    expect(paths(getNavMatchEntries('short-rent', allowAll))).toEqual(
      expect.arrayContaining(['/app/short-rent/alloggiati', '/app/short-rent/compliance']),
    );
  });

  it('takes a place in "Altro" when the entry it hangs from is not open to the user', () => {
    // Alloggiati asks for booking.read, its parent (Adempimenti) for property.read: no page is left without a way in.
    const noProperties = without('property.read');
    expect(paths(getVisibleNavEntries('short-rent', noProperties))).not.toContain('/app/short-rent/compliance');
    const more = getSecondaryNavEntries('short-rent', noProperties);
    expect(paths(more)).toContain('/app/short-rent/alloggiati');
    expect(more.find((entry) => entry.path === '/app/short-rent/alloggiati')?.navPlacement).toBe('secondary');
    expect(paths(getVisibleNavEntries('short-rent', allowAll))).not.toContain('/app/short-rent/alloggiati');

    // The same for the LTR reference data of the staff console, which asks for another permission than the audit.
    const noAudit = without('admin.cin.read');
    expect(paths(getSecondaryNavEntries('admin', noAudit))).toContain('/app/admin/compliance/ltr-reference-data');
  });

  it('lists only the pages the user may open', () => {
    expect(paths(getNavChildren('/app/short-rent/compliance', without('booking.read')))).toEqual([
      '/app/short-rent/compliance/cin',
    ]);
    // The branding and documents pages are for the org billing administrator.
    expect(getNavChildren('/app/short-rent/vetrina', notBillingAdmin)).toEqual([]);
    expect(paths(getNavChildren('/app/short-rent/vetrina', allowAll))).toEqual([
      '/app/short-rent/settings/site-appearance',
      '/app/short-rent/settings/site-documents',
    ]);
  });
});

describe('route-manifest: no page is left without a way in (UI-04a)', () => {
  it.each(CONTEXTS)('%s: every page of the menus is in a menu or hangs from an entry in a menu', (contextKey) => {
    for (const { label, hasPermission, features } of userVariants(contextKey)) {
      const visible = paths(getVisibleNavEntries(contextKey, hasPermission, features));
      const reachable = ROUTE_MANIFEST.filter(
        (entry) =>
          entry.context === contextKey &&
          (entry.navPlacement !== undefined || entry.navParent !== undefined) &&
          hasEntryPermission(entry, hasPermission) &&
          isEntryFeatureEnabled(entry, features),
      );
      for (const entry of reachable) {
        const inMenu = visible.includes(entry.path);
        const hangsFromVisible = entry.navParent !== undefined && visible.includes(entry.navParent);
        expect(inMenu || hangsFromVisible, `${entry.path} for ${contextKey} user with ${label}`).toBe(true);
      }
    }
  });

  // The 44 pages that were in a menu before UI-04a. Plan and billing left the menus because the org badge of the header
  // leads to the plan page (`usePlanPagePath`), which links to the billing page and back.
  const MENU_PAGES_BEFORE = [
    '/app/short-rent', '/app/short-rent/properties', '/app/short-rent/fiscal', '/app/short-rent/settings/domain',
    '/app/short-rent/settings/plan', '/app/short-rent/settings/billing', '/app/short-rent/settings/organization',
    '/app/short-rent/settings/site-appearance', '/app/short-rent/settings/site-documents',
    '/app/short-rent/settings/payments', '/app/short-rent/bookings', '/app/short-rent/bookings/calendar',
    '/app/short-rent/marketplace', '/app/short-rent/alloggiati', '/app/short-rent/compliance/cin',
    '/app/short-rent/payments', '/app/short-rent/payments/revenue', '/app/short-rent/ota', '/app/short-rent/vetrina',
    '/app/short-rent/profile', '/app/short-rent/guests',
    '/app/long-rent/leases', '/app/long-rent/properties', '/app/long-rent/profile', '/app/long-rent/settings/plan',
    '/app/long-rent/settings/billing', '/app/long-rent/settings/organization',
    '/app/admin', '/app/admin/users', '/app/admin/profile', '/app/admin/suppliers', '/app/admin/suppliers/invite',
    '/app/admin/jobs', '/app/admin/seo', '/app/admin/cin', '/app/admin/compliance/tax-rates',
    '/app/admin/compliance/ltr-reference-data',
    '/app/supplier/dashboard', '/app/supplier/calendar', '/app/supplier/profile', '/app/supplier/inbox',
    '/app/supplier/availability', '/app/supplier/showcase', '/app/supplier/help/ical',
  ];
  const REACHED_BY_THE_ORG_BADGE = [
    '/app/short-rent/settings/plan',
    '/app/short-rent/settings/billing',
    '/app/long-rent/settings/plan',
    '/app/long-rent/settings/billing',
  ];

  it('keeps every page that was in a menu reachable by a full-access user, with every flag on', () => {
    expect(MENU_PAGES_BEFORE).toHaveLength(44);
    const flags: Partial<FeatureFlags> = { otaPartnerApi: true, aiSupplierDiscovery: true, rliProvider: true, eSignProvider: true };
    for (const page of MENU_PAGES_BEFORE) {
      const entry = entryOf(page);
      const visible = paths(getVisibleNavEntries(entry.context, allowAll, flags));
      const inMenu = visible.includes(page);
      const hangsFromVisible = entry.navParent !== undefined && visible.includes(entry.navParent);
      const byOrgBadge = REACHED_BY_THE_ORG_BADGE.includes(page);
      expect(inMenu || hangsFromVisible || byOrgBadge, page).toBe(true);
    }
  });

  it('keeps the plan and billing pages one click from the org badge of a rental area', () => {
    for (const context of ['short-rent', 'long-rent'] as const) {
      expect(entryOf(planPagePath(context)).context).toBe(context);
      expect(entryOf(billingPagePath(context)).context).toBe(context);
    }
    // They are in no menu any more, and the organization page stays in "Altro" of both rental areas.
    for (const page of REACHED_BY_THE_ORG_BADGE) {
      const entry = entryOf(page);
      expect(entry.navPlacement, page).toBeUndefined();
      expect(entry.navParent, page).toBeUndefined();
    }
    expect(paths(getSecondaryNavEntries('long-rent', allowAll))).toContain('/app/long-rent/settings/organization');
  });

  // Baseline of the manifest before UI-04a: every route is still there with its legacy addresses (emails and Stripe returns).
  const PATHS_BEFORE: [string, string[] | undefined][] = [
    ['/app/short-rent', ['/', '/app/short-rent/']],
    ['/app/short-rent/properties', ['/properties']],
    ['/app/short-rent/properties/create', ['/properties/create']],
    ['/app/short-rent/properties/:id', ['/properties/:id']],
    ['/app/short-rent/properties/:id/edit', ['/properties/:id/edit']],
    ['/app/short-rent/properties/:id/activation', ['/properties/:id/activation']],
    ['/app/short-rent/properties/:id/pricing', ['/properties/:id/pricing']],
    ['/app/short-rent/compliance', undefined],
    ['/app/short-rent/fiscal', undefined],
    ['/app/short-rent/fiscal/wizard', undefined],
    ['/app/short-rent/fiscal/reports', undefined],
    ['/app/short-rent/settings/domain', undefined],
    ['/app/short-rent/settings/plan', undefined],
    ['/app/short-rent/settings/billing', undefined],
    ['/app/short-rent/settings/organization', undefined],
    ['/app/short-rent/settings/site-appearance', undefined],
    ['/app/short-rent/settings/site-documents', undefined],
    ['/app/short-rent/settings/payments', undefined],
    ['/app/short-rent/bookings', ['/bookings']],
    ['/app/short-rent/bookings/create', ['/bookings/create']],
    ['/app/short-rent/bookings/calendar', ['/bookings/calendar']],
    ['/app/short-rent/bookings/:id/checkout', ['/bookings/:id/checkout']],
    ['/app/short-rent/marketplace', undefined],
    ['/app/short-rent/alloggiati', undefined],
    ['/app/short-rent/compliance/cin', ['/app/short-rent/cin', '/cin']],
    ['/app/short-rent/bookings/:id', ['/bookings/:id']],
    ['/app/short-rent/bookings/:id/edit', ['/bookings/:id/edit']],
    ['/app/short-rent/payments', ['/payments']],
    ['/app/short-rent/payments/create', ['/payments/create']],
    ['/app/short-rent/payments/revenue', ['/payments/revenue']],
    ['/app/short-rent/payments/:id', ['/payments/:id']],
    ['/app/short-rent/ota', ['/ota']],
    ['/app/short-rent/ota/create', ['/ota/create']],
    ['/app/short-rent/vetrina', undefined],
    ['/app/short-rent/profile', ['/profile']],
    ['/app/long-rent/leases', ['/leases']],
    ['/app/long-rent/leases/new', ['/leases/new']],
    ['/app/long-rent/leases/:id', ['/leases/:id']],
    ['/app/long-rent/properties', undefined],
    ['/app/long-rent/properties/new', undefined],
    ['/app/long-rent/properties/:id', undefined],
    ['/app/long-rent/properties/:id/edit', undefined],
    ['/app/long-rent/profile', ['/profile']],
    ['/app/long-rent/settings/plan', undefined],
    ['/app/long-rent/settings/billing', undefined],
    ['/app/long-rent/settings/organization', undefined],
    ['/app/admin', ['/admin']],
    ['/app/admin/users', ['/admin/users']],
    ['/app/admin/profile', undefined],
    ['/app/admin/suppliers', undefined],
    ['/app/admin/suppliers/invite', ['/admin/suppliers/invite']],
    ['/app/admin/jobs', ['/admin/jobs']],
    ['/app/admin/seo', ['/admin/seo']],
    ['/app/short-rent/guests', undefined],
    ['/app/short-rent/guests/:id', undefined],
    ['/app/admin/cin', ['/admin/cin']],
    ['/app/admin/compliance/tax-rates', ['/app/admin/tourist-tax', '/admin/tourist-tax']],
    ['/app/admin/compliance/ltr-reference-data', undefined],
    ['/app/supplier/activation', undefined],
    ['/app/supplier/dashboard', undefined],
    ['/app/supplier/calendar', undefined],
    ['/app/supplier/profile', undefined],
    ['/app/supplier/inbox', undefined],
    ['/app/supplier/inbox/:id', undefined],
    ['/app/supplier/availability', undefined],
    ['/app/supplier/showcase', undefined],
    ['/app/supplier/help/ical', undefined],
  ];

  it('changes no path and no legacy path of the manifest', () => {
    for (const [path, legacyPaths] of PATHS_BEFORE) {
      expect(entryOf(path).legacyPaths, path).toEqual(legacyPaths);
    }
  });
});

describe('route-manifest nav helpers', () => {
  const denyOta = (_ctx: string, permission: string) => permission !== 'ota.read';

  // TN-3 / PL-12: the organization page is in the menu only for the org billing administrator.
  it('shows the organization page only to the org billing administrator', () => {
    const orgPaths = ['/app/short-rent/settings/organization', '/app/long-rent/settings/organization'];
    for (const path of orgPaths) {
      const entry = entryOf(path);
      expect(entry.orgBillingAdmin).toBe(true);
      expect(entry.requiredPermissions).toEqual([]);
    }
    expect(paths(getVisibleNavEntries('short-rent', notBillingAdmin))).not.toContain(orgPaths[0]);
    expect(paths(getVisibleNavEntries('long-rent', notBillingAdmin))).not.toContain(orgPaths[1]);
    expect(paths(getVisibleNavEntries('short-rent', without('booking.read'))).includes(orgPaths[0])).toBe(true);
    // Stripe Connect does not need to be the org administrator.
    expect(paths(getVisibleNavEntries('short-rent', notBillingAdmin))).toContain('/app/short-rent/settings/payments');
  });

  // TN-3 / PL-12: plan and billing are for the org billing administrator, wherever the user finds them.
  it('keeps plan and billing for the org billing administrator and in no menu', () => {
    for (const path of ['/app/short-rent/settings/plan', '/app/short-rent/settings/billing']) {
      expect(entryOf(path).orgBillingAdmin).toBe(true);
      expect(paths(getVisibleNavEntries('short-rent', allowAll))).not.toContain(path);
    }
  });

  // BK-12 / BK-14: the public-site pages belong to the short-rent shell, for the org billing administrator only.
  it('shows the site appearance and documents pages only in the short-rent shell, to the org billing administrator', () => {
    for (const path of ['/app/short-rent/settings/site-appearance', '/app/short-rent/settings/site-documents']) {
      const entry = entryOf(path);
      expect(entry.orgBillingAdmin).toBe(true);
      expect(entry.navParent).toBe('/app/short-rent/vetrina');
      expect(ROUTE_MANIFEST.some((candidate) => candidate.path === path.replace('short-rent', 'long-rent'))).toBe(false);
      expect(paths(getNavChildren('/app/short-rent/vetrina', notBillingAdmin))).not.toContain(path);
      expect(paths(getNavChildren('/app/short-rent/vetrina', allowAll))).toContain(path);
    }
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
    const phoneMenu = getContextNav('short-rent', allowAll, { otaPartnerApi: false }, { withoutBottom: true });
    const sidebar = getContextNav('short-rent', allowAll, { otaPartnerApi: false });

    for (const entries of [flagOff, flagsNotLoaded, phoneMenu.more, sidebar.more]) {
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
    expect(entry?.navPlacement).toBe('primary');
    expect(entry?.legacyPaths).toContain('/admin/cin');

    const visible = getVisibleNavEntries('admin', allowAll).map((e) => e.path);
    expect(visible).toContain('/app/admin/cin');

    const withoutCinRead = (_ctx: string, permission: string) => permission !== 'admin.cin.read';
    const hiddenPaths = getVisibleNavEntries('admin', withoutCinRead).map((e) => e.path);
    expect(hiddenPaths).not.toContain('/app/admin/cin');

    // The old /admin/cin URL is the admin audit: no other entry may claim it (the host CIN page used to).
    const claimants = ROUTE_MANIFEST.filter((e) => e.legacyPaths?.includes('/admin/cin')).map((e) => e.path);
    expect(claimants).toEqual(['/app/admin/cin']);
  });

  it('groups the three compliance pages of the staff console in one entry', () => {
    expect(paths(getNavChildren('/app/admin/cin', allowAll))).toEqual([
      '/app/admin/compliance/tax-rates',
      '/app/admin/compliance/ltr-reference-data',
    ]);
    expect(paths(getVisibleNavEntries('admin', allowAll))).not.toContain('/app/admin/compliance/tax-rates');
  });

  // SU-16 (A4-32, #327-AC2/AC4): the iCal help page lives inside the supplier console, with its own sidebar entry.
  it('puts the iCal help page in "Altro" of the supplier console', () => {
    const entry = ROUTE_MANIFEST.find((e) => e.path === '/app/supplier/help/ical');
    expect(entry?.context).toBe('supplier');
    expect(entry?.navKey).toBe('nav.supplierHelpIcal');

    expect(paths(getSecondaryNavEntries('supplier', allowAll))).toEqual(['/app/supplier/profile', '/app/supplier/help/ical']);
    expect(paths(getContextNav('supplier', allowAll, {}, { withoutBottom: true }).more)).toContain('/app/supplier/help/ical');
  });

  // SU-13 (A4-16): the preview of the public showcase is a destination of the supplier bar.
  it('puts the showcase preview among the main entries of the supplier console', () => {
    const entry = ROUTE_MANIFEST.find((e) => e.path === '/app/supplier/showcase');
    expect(entry?.context).toBe('supplier');
    expect(entry?.navKey).toBe('nav.supplierShowcase');
    expect(entry?.navPlacement).toBe('primary');
  });

  it('lets the iCal calendar of the supplier hang from the availability', () => {
    expect(paths(getNavChildren('/app/supplier/availability', allowAll))).toEqual(['/app/supplier/calendar']);
    expect(paths(getVisibleNavEntries('supplier', allowAll))).not.toContain('/app/supplier/calendar');
  });

  // UI-00 (merged separately) opens the first page of the menu the user can open when the default one is closed to it.
  it('lists the main menu before "Altro", whatever the order numbers of the entries say', () => {
    const visible = getVisibleNavEntries('long-rent', without('lease.read'));
    expect(paths(visible)).toEqual(['/app/long-rent/properties', '/app/long-rent/profile', '/app/long-rent/settings/organization']);
    const nothing = getVisibleNavEntries('long-rent', (_ctx, permission) => !permission);
    expect(paths(nothing)).toEqual(['/app/long-rent/profile']);
  });
});
