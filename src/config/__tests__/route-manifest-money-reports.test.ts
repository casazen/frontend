import { describe, expect, it } from 'vitest';
import { REPORTS } from '@/features/reports/report-catalog';
import { DEFAULT_FEATURE_FLAGS } from '../feature-flags';
import { ROUTE_MANIFEST, getNavMatchEntries, getVisibleNavEntries, hasEntryPermission } from '../route-manifest';

const PATHS = ['/app/short-rent/reports/collections', '/app/short-rent/reports/channel-costs'] as const;

describe('route manifest: the money reports (NF-97, NF-98, E07/F03/US02)', () => {
  it.each(PATHS)('RouteManifest_%s_IsAPageOfShortRentThatAsksForPaymentRead', (path) => {
    const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === path);

    expect(entry).toBeDefined();
    expect(entry?.context).toBe('short-rent');
    expect(entry?.requiredPermissions).toEqual(['payment.read']);

    // Aggregated money: whoever may not read payments does not open it (the backend refuses the read too).
    const withoutPayments = (_context: string, permission: string) => permission !== 'payment.read';
    expect(entry && hasEntryPermission(entry, withoutPayments)).toBe(false);
    expect(entry && hasEntryPermission(entry, () => true)).toBe(true);
  });

  it.each(PATHS)('RouteManifest_%s_IsInNoMenuAndNoTab', (path) => {
    const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === path);

    expect(entry?.navKey).toBeUndefined();
    expect(entry?.navParent).toBeUndefined();
    expect(entry?.navPlacement).toBeUndefined();
    expect(entry?.featureFlag).toBeUndefined();
    expect(getVisibleNavEntries('short-rent', () => true, DEFAULT_FEATURE_FLAGS).map((page) => page.path)).not.toContain(path);
    expect(getNavMatchEntries('short-rent', () => true, DEFAULT_FEATURE_FLAGS).map((page) => page.path)).not.toContain(path);
  });

  // The pages are loaded for the first time here, with their tables behind them: the 5 s of the default are not enough on a loaded CI runner.
  it.each(PATHS)('RouteManifest_%s_LoadsAPageThatIsAComponent', { timeout: 30_000 }, async (path) => {
    const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === path);
    const page = await entry?.component();

    expect(typeof page?.default).toBe('function');
  });

  it('ReportCatalog_CollectionsAndChannelCosts_AreFinancialRowsThatOpenTheirPageWithNoFormat', () => {
    const collections = REPORTS.find((report) => report.id === 'collections');
    const costs = REPORTS.find((report) => report.id === 'channelCosts');

    expect(collections).toMatchObject({ type: 'financial', suggested: null, formats: [] });
    expect(costs).toMatchObject({ type: 'financial', suggested: null, formats: [] });
    expect(collections?.source.kind === 'page' && collections.source.href('2026-10-09')).toBe(PATHS[0]);
    expect(costs?.source.kind === 'page' && costs.source.href('2026-10-09')).toBe(PATHS[1]);
  });
});
