import { describe, it, expect } from 'vitest';
import { getNavMatchEntries, type RouteManifestEntry } from '@/config/route-manifest';
import { isNavEntryActive, resolveActiveNavEntry } from '@/lib/nav-active';

const bookings: RouteManifestEntry = {
  path: '/app/short-rent/bookings',
  context: 'short-rent',
  requiredPermissions: ['booking.read'],
  navKey: 'nav.bookings',
  component: async () => ({ default: () => null }),
};

const calendar: RouteManifestEntry = {
  path: '/app/short-rent/bookings/calendar',
  context: 'short-rent',
  requiredPermissions: ['booking.read'],
  navKey: 'nav.calendar',
  component: async () => ({ default: () => null }),
};

const navEntries = [bookings, calendar];

describe('isNavEntryActive', () => {
  it('activates only calendar on calendar route (not parent bookings)', () => {
    const pathname = '/app/short-rent/bookings/calendar';
    expect(isNavEntryActive(pathname, calendar, navEntries)).toBe(true);
    expect(isNavEntryActive(pathname, bookings, navEntries)).toBe(false);
  });

  it('activates bookings on bookings list route', () => {
    const pathname = '/app/short-rent/bookings';
    expect(isNavEntryActive(pathname, bookings, navEntries)).toBe(true);
    expect(isNavEntryActive(pathname, calendar, navEntries)).toBe(false);
  });

  it('activates bookings on booking detail route', () => {
    const pathname = '/app/short-rent/bookings/abc-123';
    expect(isNavEntryActive(pathname, bookings, navEntries)).toBe(true);
    expect(isNavEntryActive(pathname, calendar, navEntries)).toBe(false);
  });

  it('activates nothing on a page no entry stands for', () => {
    expect(resolveActiveNavEntry('/app/short-rent/properties', navEntries)).toBeUndefined();
    expect(isNavEntryActive('/app/short-rent/properties', bookings, navEntries)).toBe(false);
  });

  it('does not take a path that only starts like the entry for a page of it', () => {
    expect(isNavEntryActive('/app/short-rent/bookings-archive', bookings, navEntries)).toBe(false);
  });
});

// UI-04a: the pages that hang from an entry (`navParent`) stand for that entry.
describe('isNavEntryActive for pages that hang from an entry', () => {
  const compliance: RouteManifestEntry = {
    path: '/app/short-rent/compliance',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.compliance',
    navPlacement: 'secondary',
    component: async () => ({ default: () => null }),
  };
  // Not under the path of its parent: the page of the Alloggiati has an address of its own.
  const alloggiati: RouteManifestEntry = {
    path: '/app/short-rent/alloggiati',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.alloggiati',
    navParent: '/app/short-rent/compliance',
    component: async () => ({ default: () => null }),
  };
  const cin: RouteManifestEntry = {
    path: '/app/short-rent/compliance/cin',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.cin',
    navParent: '/app/short-rent/compliance',
    component: async () => ({ default: () => null }),
  };
  const entries = [bookings, compliance, alloggiati, cin];

  it('highlights the entry a page hangs from, even when the page has another address', () => {
    expect(isNavEntryActive('/app/short-rent/alloggiati', compliance, entries)).toBe(true);
    expect(isNavEntryActive('/app/short-rent/alloggiati/anything', compliance, entries)).toBe(true);
    expect(isNavEntryActive('/app/short-rent/alloggiati', bookings, entries)).toBe(false);
  });

  it('highlights the entry once, not the page and the entry', () => {
    expect(isNavEntryActive('/app/short-rent/alloggiati', alloggiati, entries)).toBe(false);
    expect(isNavEntryActive('/app/short-rent/compliance/cin', cin, entries)).toBe(false);
    expect(isNavEntryActive('/app/short-rent/compliance/cin', compliance, entries)).toBe(true);
    expect(resolveActiveNavEntry('/app/short-rent/compliance/cin', entries)).toBe(compliance);
  });

  it('keeps the entry highlighted on its own page', () => {
    expect(isNavEntryActive('/app/short-rent/compliance', compliance, entries)).toBe(true);
  });

  it('lets the page stand for itself when the entry it hangs from is not among the entries', () => {
    expect(isNavEntryActive('/app/short-rent/alloggiati', alloggiati, [bookings, alloggiati])).toBe(true);
  });
});

describe('isNavEntryActive on the route manifest', () => {
  const allowAll = () => true;
  const activePath = (contextKey: Parameters<typeof getNavMatchEntries>[0], pathname: string) =>
    resolveActiveNavEntry(pathname, getNavMatchEntries(contextKey, allowAll, { otaPartnerApi: true }))?.path;

  it.each([
    ['short-rent', '/app/short-rent', '/app/short-rent'],
    ['short-rent', '/app/short-rent/bookings/calendar', '/app/short-rent/bookings/calendar'],
    ['short-rent', '/app/short-rent/bookings/abc', '/app/short-rent/bookings'],
    ['short-rent', '/app/short-rent/bookings/create', '/app/short-rent/bookings'],
    ['short-rent', '/app/short-rent/properties/p1/pricing', '/app/short-rent/properties'],
    ['short-rent', '/app/short-rent/payments/revenue', '/app/short-rent/payments/revenue'],
    ['short-rent', '/app/short-rent/payments/create', '/app/short-rent/payments'],
    ['short-rent', '/app/short-rent/alloggiati', '/app/short-rent/compliance'],
    ['short-rent', '/app/short-rent/compliance/cin', '/app/short-rent/compliance'],
    ['short-rent', '/app/short-rent/settings/site-appearance', '/app/short-rent/vetrina'],
    ['short-rent', '/app/short-rent/settings/site-documents', '/app/short-rent/vetrina'],
    ['short-rent', '/app/short-rent/guests/g1', '/app/short-rent/guests'],
    ['short-rent', '/app/short-rent/fiscal/wizard', '/app/short-rent/fiscal'],
    ['short-rent', '/app/short-rent/ota/create', '/app/short-rent/ota'],
    // Plan and billing are in no menu: no entry stands for them.
    ['short-rent', '/app/short-rent/settings/plan', undefined],
    ['long-rent', '/app/long-rent/leases', '/app/long-rent/leases'],
    // Contratti stays highlighted on the pages of a contract (it was not, as an "exact" entry).
    ['long-rent', '/app/long-rent/leases/new', '/app/long-rent/leases'],
    ['long-rent', '/app/long-rent/leases/l1', '/app/long-rent/leases'],
    ['long-rent', '/app/long-rent/properties/p1/edit', '/app/long-rent/properties'],
    ['supplier', '/app/supplier/calendar', '/app/supplier/availability'],
    ['supplier', '/app/supplier/inbox/r1', '/app/supplier/inbox'],
    ['supplier', '/app/supplier/help/ical', '/app/supplier/help/ical'],
    ['admin', '/app/admin', '/app/admin'],
    ['admin', '/app/admin/compliance/tax-rates', '/app/admin/cin'],
    ['admin', '/app/admin/compliance/ltr-reference-data', '/app/admin/cin'],
    ['admin', '/app/admin/suppliers/invite', '/app/admin/suppliers/invite'],
  ] as const)('%s %s highlights %s', (contextKey, pathname, expected) => {
    expect(activePath(contextKey, pathname)).toBe(expected);
  });
});
