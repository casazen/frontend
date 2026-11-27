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

    expect(paths(getNavChildren(PAYMENTS, allowAll, DEFAULT_FEATURE_FLAGS))).not.toContain(PATH);
    expect(paths(getNavMatchEntries('short-rent', allowAll, DEFAULT_FEATURE_FLAGS))).not.toContain(PATH);
    expect(paths(getNavSection(PAYMENTS, allowAll, DEFAULT_FEATURE_FLAGS))).toEqual([
      PAYMENTS,
      '/app/short-rent/payments/revenue',
      '/app/short-rent/reports',
      '/app/short-rent/documents',
      '/app/short-rent/fiscal',
    ]);
  });

  it('RouteManifest_Accountant_IsATabOfIncassiNextToReportForWhoMayReadPayments', () => {
    const on = { accountantPackage: true };
    expect(entry.navParent).toBe(PAYMENTS);
    expect(entry.navPlacement).toBeUndefined();
    expect(entry.navBottom).toBeUndefined();

    const tabs = paths(getNavSection(PATH, allowAll, on));
    expect(tabs[0]).toBe(PAYMENTS);
    expect(tabs.indexOf(PATH)).toBe(tabs.indexOf('/app/short-rent/reports') + 1);
    expect(paths(getNavMatchEntries('short-rent', allowAll, on))).toContain(PATH);

    expect(paths(getNavChildren(PAYMENTS, without('payment.read'), on))).not.toContain(PATH);
    expect(paths(getNavSection(PATH, without('payment.read'), on))).toEqual([]);
  });
});
