import { describe, it, expect } from 'vitest';
import {
  ROUTE_MANIFEST,
  getDesktopNavByGroup,
  getDrawerNavByGroup,
  getPrimaryNavEntries,
  getSecondaryNavEntries,
  getVisibleNavEntries,
  isEntryFeatureEnabled,
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

  it('keeps the iCal-based calendar available with the otaPartnerApi flag off', () => {
    const primary = getPrimaryNavEntries('short-rent', allowAll, { otaPartnerApi: false });
    expect(primary.some((e) => e.path === '/app/short-rent/bookings/calendar')).toBe(true);
  });
});
