import { describe, expect, it } from 'vitest';
import { DEFAULT_FEATURE_FLAGS } from '../feature-flags';
import { ROUTE_MANIFEST, getNavChildren, getNavMatchEntries, getNavSection, hasEntryPermission, isEntryFeatureEnabled, type RouteManifestEntry } from '../route-manifest';

const PATH = '/app/short-rent/accountant';
const PAYMENTS = '/app/short-rent/payments';

const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === PATH) as RouteManifestEntry;
const allowAll = () => true;
const without = (denied: string) => (_context: string, permission: string) => permission !== denied;
const paths = (entries: RouteManifestEntry[]) => entries.map((candidate) => candidate.path);

describe('route manifest: the page «Commercialista» (E15/F02/US01/T01, NF-101, NF-115)', () => {
  it('RouteManifest_Accountant_IsAPageOfShortRentThatAsksForPaymentRead', () => {
    expect(entry).toBeDefined();
    expect(entry.context).toBe('short-rent');
    expect(entry.requiredPermissions).toEqual(['payment.read']);

    // The money of the agency: whoever may not read payments does not open it (the backend refuses both endpoints to them too).
    expect(hasEntryPermission(entry, without('payment.read'))).toBe(false);
    expect(hasEntryPermission(entry, allowAll)).toBe(true);
  });

  it('RouteManifest_Accountant_ExistsOnlyWhileItsFlagIsOnAndWithTheFlagOffNothingChanges', () => {
    expect(entry.featureFlag).toBe('accountantPackage');
    expect(DEFAULT_FEATURE_FLAGS.accountantPackage).toBe(false);
    expect(isEntryFeatureEnabled(entry, undefined)).toBe(false);
    expect(isEntryFeatureEnabled(entry, {})).toBe(false);
    expect(isEntryFeatureEnabled(entry, DEFAULT_FEATURE_FLAGS)).toBe(false);
    expect(isEntryFeatureEnabled(entry, { accountantPackage: true })).toBe(true);

    // Off: no tab of Incassi, nothing the open page could stand for, and the tabs of the section are the ones it always had.
    expect(paths(getNavChildren(PAYMENTS, allowAll, DEFAULT_FEATURE_FLAGS))).not.toContain(PATH);
    expect(paths(getNavMatchEntries('short-rent', allowAll, DEFAULT_FEATURE_FLAGS))).not.toContain(PATH);
    expect(paths(getNavSection(PAYMENTS, allowAll, DEFAULT_FEATURE_FLAGS))).toEqual([
      PAYMENTS,
      '/app/short-rent/payments/revenue',
      '/app/short-rent/reports',
      '/app/short-rent/documents',
      '/app/short-rent/fiscal',
      '/app/short-rent/settings/payments',
    ]);
  });

  it('RouteManifest_Accountant_IsATabOfIncassiNextToReportForWhoMayReadPayments', () => {
    const on = { accountantPackage: true };
    expect(entry.navParent).toBe(PAYMENTS);
    // A tab: in no menu of its own and in none of the bar.
    expect(entry.navPlacement).toBeUndefined();
    expect(entry.navBottom).toBeUndefined();

    const tabs = paths(getNavSection(PATH, allowAll, on));
    expect(tabs[0]).toBe(PAYMENTS);
    expect(tabs.indexOf(PATH)).toBe(tabs.indexOf('/app/short-rent/reports') + 1);
    expect(paths(getNavMatchEntries('short-rent', allowAll, on))).toContain(PATH);

    // Without the permission there is no tab of it, and none of the section lists it.
    expect(paths(getNavChildren(PAYMENTS, without('payment.read'), on))).not.toContain(PATH);
    expect(paths(getNavSection(PATH, without('payment.read'), on))).toEqual([]);
  });
});
