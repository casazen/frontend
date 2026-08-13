import { describe, it, expect } from 'vitest';
import {
  getPrimaryNavEntries,
  getSecondaryNavEntries,
  getVisibleNavEntries,
} from '../route-manifest';

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

  it('hides OTA when ota.read permission is missing', () => {
    const visible = getVisibleNavEntries('short-rent', denyOta);
    expect(visible.some((e) => e.path === '/app/short-rent/ota')).toBe(false);
  });
});
