import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContextRouteGuard } from '@/components/auth/context-route-guard';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { REPORTS, reportsFor } from '@/features/reports/report-catalog';
import { useWorkspace } from '@/hooks/use-workspace';
import { getManifestCrumbs } from '@/lib/page-crumbs';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '../feature-flags';
import { ROUTE_MANIFEST, getNavMatchEntries, getVisibleNavEntries, hasEntryPermission, isEntryFeatureEnabled, type RouteManifestEntry } from '../route-manifest';

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));

const PATH = '/app/short-rent/reports/tourist-tax/year-end';

const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === PATH) as RouteManifestEntry;
const allowAll = () => true;
const without = (denied: string) => (_context: string, permission: string) => permission !== denied;

/** The rows of the list of reports before the year-end page existed: with the flag off the list is exactly this one. */
const ROWS_BEFORE = ['revenue', 'occupancy', 'channels', 'channelCosts', 'collections', 'touristTax', 'touristTaxSummary', 'annual', 'withholding', 'alloggiati', 'payments'];

describe('route manifest: the tourist tax at year end (E18/F01/US02/T03, NF-117)', () => {
  it('RouteManifest_TouristTaxYearEnd_IsAPageOfShortRentThatAsksForPaymentRead', () => {
    expect(entry).toBeDefined();
    expect(entry.context).toBe('short-rent');
    expect(entry.requiredPermissions).toEqual(['payment.read']);

    // The money of the agency: whoever may not read payments does not open it (the backend refuses every file to them too).
    expect(hasEntryPermission(entry, without('payment.read'))).toBe(false);
    expect(hasEntryPermission(entry, allowAll)).toBe(true);
  });

  it('RouteManifest_TouristTaxYearEnd_ExistsOnlyWhileTheFlagOfTheTaxExportsIsOn_AndIsInNoMenuAndNoTab', () => {
    expect(entry.featureFlag).toBe('taxReportingExports');
    expect(DEFAULT_FEATURE_FLAGS.taxReportingExports).toBe(false);
    expect(isEntryFeatureEnabled(entry, undefined)).toBe(false);
    expect(isEntryFeatureEnabled(entry, {})).toBe(false);
    expect(isEntryFeatureEnabled(entry, DEFAULT_FEATURE_FLAGS)).toBe(false);
    expect(isEntryFeatureEnabled(entry, { taxReportingExports: true })).toBe(true);

    // A page of the list of reports like its sister of the tourist tax: no entry of a menu, no tab, none of the bar.
    expect(entry.navKey).toBeUndefined();
    expect(entry.navParent).toBeUndefined();
    expect(entry.navPlacement).toBeUndefined();
    const on = { ...DEFAULT_FEATURE_FLAGS, taxReportingExports: true };
    for (const flags of [DEFAULT_FEATURE_FLAGS, on]) {
      expect(getVisibleNavEntries('short-rent', allowAll, flags).map((page) => page.path)).not.toContain(PATH);
      expect(getNavMatchEntries('short-rent', allowAll, flags).map((page) => page.path)).not.toContain(PATH);
    }
  });

  it('RouteManifest_TouristTaxYearEnd_HasATrailThroughIncassiAndTheListOfReports', () => {
    const trail = getManifestCrumbs({ contextKey: 'short-rent', pathname: PATH, current: 'Fine anno', t: ((key: string) => key) as never });

    expect(trail.map((step) => step.to)).toEqual(['/app/short-rent/payments', '/app/short-rent/reports', undefined]);
  });
});

describe('the list of reports follows the flag as the page does', () => {
  it('ReportCatalog_FlagOff_TheListIsTheOneItAlwaysWas', () => {
    expect(reportsFor(DEFAULT_FEATURE_FLAGS).map((report) => report.id)).toEqual(ROWS_BEFORE);
    expect(reportsFor(undefined).map((report) => report.id)).toEqual(ROWS_BEFORE);
    // The row exists in the catalog, behind its flag, and nowhere else.
    expect(REPORTS.filter((report) => report.featureFlag !== undefined).map((report) => report.id)).toEqual(['touristTaxYearEnd']);
  });

  it('ReportCatalog_FlagOn_TheRowOfTheYearEndPageFollowsTheOneOfTheTouristTaxAndLeadsToThePage', () => {
    const rows = reportsFor({ ...DEFAULT_FEATURE_FLAGS, taxReportingExports: true });

    expect(rows.map((report) => report.id)).toEqual([...ROWS_BEFORE.slice(0, 7), 'touristTaxYearEnd', ...ROWS_BEFORE.slice(7)]);
    const row = rows.find((report) => report.id === 'touristTaxYearEnd');
    expect(row).toMatchObject({ type: 'fiscal', suggested: null, formats: [] });
    expect(row?.source.kind === 'page' && row.source.href('2026-10-09')).toBe(PATH);
  });
});

function renderRoute(options: { permissions: string[]; flags: Partial<FeatureFlags> }) {
  vi.mocked(useWorkspace).mockReturnValue({
    contexts: [
      {
        contextKey: 'short-rent',
        displayName: 'Affitti brevi',
        roleKey: 'property_owner',
        permissions: options.permissions,
        defaultRoute: '/app/short-rent',
      },
    ],
    activeContext: 'short-rent',
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission: vi.fn().mockReturnValue(true),
    getDefaultRoute: vi.fn().mockReturnValue('/app/short-rent'),
  });

  // The guard as the router builds it from the entry of the manifest: its permissions and its flag, nothing typed by hand.
  return render(
    <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, ...options.flags }, isLoading: false }}>
      <MemoryRouter initialEntries={[PATH]}>
        <Routes>
          <Route path="/app/short-rent" element={<p>home</p>} />
          <Route
            path={PATH}
            element={
              <ContextRouteGuard contextKey="short-rent" requiredPermissions={entry.requiredPermissions} featureFlag={entry.featureFlag}>
                <p>year end page</p>
              </ContextRouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </FeatureFlagsContext.Provider>,
  );
}

describe('the route of the year-end page (permission rule: hidden while the flag is off, routable only with the permission)', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => cleanup());

  it('RouteGuard_FlagOff_TheAddressLeadsToTheHomeOfTheAreaEvenForWhoMayReadPayments', () => {
    renderRoute({ permissions: ['payment.read'], flags: {} });

    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByText('year end page')).toBeNull();
    expect(screen.queryByTestId('reserved-page')).toBeNull();
  });

  it('RouteGuard_FlagOnAndThePermission_OpensThePage', () => {
    renderRoute({ permissions: ['payment.read'], flags: { taxReportingExports: true } });

    expect(screen.getByText('year end page')).toBeInTheDocument();
  });

  it('RouteGuard_FlagOnButNoPaymentRead_ShowsTheReservedPageAndNotTheFiles', () => {
    renderRoute({ permissions: ['booking.read'], flags: { taxReportingExports: true } });

    expect(screen.getByTestId('reserved-page')).toBeInTheDocument();
    expect(screen.queryByText('year end page')).toBeNull();
  });
});
