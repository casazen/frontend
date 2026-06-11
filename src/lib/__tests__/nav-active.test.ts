import { describe, it, expect } from 'vitest';
import type { RouteManifestEntry } from '@/config/route-manifest';
import { isNavEntryActive } from '@/lib/nav-active';

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
});
