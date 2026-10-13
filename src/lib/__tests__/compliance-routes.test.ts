import { describe, expect, it } from 'vitest';
import { matchPath } from 'react-router-dom';
import { ROUTE_MANIFEST, type AppContextKey } from '@/config/route-manifest';
import { BOOKING_TABS } from '@/features/bookings/lib/booking-tabs';
import { guestDataCompletionPath } from '@/features/bookings/lib/stay-actions';
import { COMPLIANCE_ACTION_TARGETS, complianceActionRoute } from '@/lib/compliance-routes';
import {
  COMPLIANCE_COCKPIT_ACTIONS,
  type ComplianceCockpitAction,
  type ComplianceSummaryItem,
} from '@/types/compliance.types';

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

/** An item as the API sends it: the id of the target in `propertyId` or `bookingId` (CO-04). */
function itemFor(action: ComplianceCockpitAction): ComplianceSummaryItem {
  const onProperty = COMPLIANCE_ACTION_TARGETS[action].target === 'property';
  return {
    id: onProperty ? PROPERTY_ID : BOOKING_ID,
    label: 'Item',
    action,
    propertyId: onProperty ? PROPERTY_ID : null,
    bookingId: onProperty ? null : BOOKING_ID,
  };
}

/** The manifest entry the router renders for a URL (same matching as the router: whole path). */
function manifestEntryOf(url: string) {
  const { pathname, search } = new URL(url, 'https://app.test');
  const entry = ROUTE_MANIFEST.find((candidate) => matchPath({ path: candidate.path, end: true }, pathname));
  return { entry, pathname, tab: new URLSearchParams(search).get('tab') };
}

const permissions =
  (granted: string[]) =>
  (contextKey: AppContextKey, permission: string): boolean =>
    contextKey === 'short-rent' && granted.includes(permission);

const EXPECTED: Record<ComplianceCockpitAction, string> = {
  ActivateProperty: `/app/short-rent/properties/${PROPERTY_ID}/activation`,
  CompleteGuestCheckIn: `/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`,
  CheckOut: `/app/short-rent/bookings/${BOOKING_ID}/checkout`,
  SendAlloggiati: `/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`,
  ResolveAlloggiatiFailure: `/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`,
  ConfirmPropertyReady: `/app/short-rent/bookings/${BOOKING_ID}/checkout`,
};

describe('complianceActionRoute (CO-04, A5-09)', () => {
  it.each(COMPLIANCE_COCKPIT_ACTIONS)('complianceActionRoute_%s_IsAShortRentRouteOfTheManifest', (action) => {
    const route = complianceActionRoute(itemFor(action));

    expect(route).not.toBeNull();
    const { entry, pathname, tab } = manifestEntryOf(route!);
    expect(entry, `${route} is not a route of the ROUTE_MANIFEST`).toBeDefined();
    expect(entry!.context).toBe('short-rent');
    expect(entry!.path.startsWith('/app/')).toBe(true);
    expect(pathname).not.toContain(':');
    if (tab !== null) expect(BOOKING_TABS).toContain(tab);
  });

  it.each(COMPLIANCE_COCKPIT_ACTIONS)('complianceActionRoute_%s_OpensTheScreenOfTheAction', (action) => {
    expect(complianceActionRoute(itemFor(action))).toBe(EXPECTED[action]);
  });

  it.each(COMPLIANCE_COCKPIT_ACTIONS)('complianceActionTargets_%s_FallbackIsAManifestRoute', (action) => {
    const { route, fallback } = COMPLIANCE_ACTION_TARGETS[action];
    for (const candidate of [route, ...(fallback ? [fallback] : [])]) {
      expect(ROUTE_MANIFEST.some((entry) => entry.path === candidate.path && entry.context === 'short-rent')).toBe(true);
    }
  });

  it('complianceActionRoute_CompleteGuestCheckIn_IsTheGuestDataLinkOfTheApp', () => {
    // One place where the host completes the guest data: the cockpit, the arrival and the check-out agree (CO-08).
    expect(complianceActionRoute(itemFor('CompleteGuestCheckIn'))).toBe(guestDataCompletionPath(BOOKING_ID));
  });

  it('complianceActionTargets_EveryBackendAction_HasATarget', () => {
    expect(Object.keys(COMPLIANCE_ACTION_TARGETS).sort()).toEqual([...COMPLIANCE_COCKPIT_ACTIONS].sort());
  });

  it('complianceActionRoute_WithoutWritePermission_FallsBackToTheReadOnlyPage', () => {
    const readOnly = permissions(['property.read', 'booking.read']);

    expect(complianceActionRoute(itemFor('ActivateProperty'), readOnly)).toBe(`/app/short-rent/properties/${PROPERTY_ID}`);
    expect(complianceActionRoute(itemFor('CheckOut'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
    expect(complianceActionRoute(itemFor('SendAlloggiati'), readOnly)).toBe(EXPECTED.SendAlloggiati);
  });

  it('complianceActionRoute_WithTheWritePermissions_OpensTheScreenOfTheAction', () => {
    const writer = permissions(['property.read', 'property.write', 'booking.read', 'booking.write']);

    for (const action of COMPLIANCE_COCKPIT_ACTIONS) {
      expect(complianceActionRoute(itemFor(action), writer)).toBe(EXPECTED[action]);
    }
  });

  it('complianceActionRoute_NoPageTheUserCanOpen_ReturnsNull', () => {
    expect(complianceActionRoute(itemFor('ActivateProperty'), permissions(['booking.read']))).toBeNull();
    expect(complianceActionRoute(itemFor('CompleteGuestCheckIn'), permissions([]))).toBeNull();
  });

  it('complianceActionRoute_UnknownActionOrMissingTarget_ReturnsNullNeverTheDashboard', () => {
    const unknown = { ...itemFor('CheckOut'), action: 'SomethingNew' as ComplianceCockpitAction };
    const inherited = { ...itemFor('CheckOut'), action: 'toString' as ComplianceCockpitAction };
    const withoutBooking = { ...itemFor('CheckOut'), bookingId: null };
    const bookingIdOnProperty = { ...itemFor('ActivateProperty'), propertyId: null, bookingId: BOOKING_ID };

    expect(complianceActionRoute(unknown)).toBeNull();
    expect(complianceActionRoute(inherited)).toBeNull();
    expect(complianceActionRoute(withoutBooking)).toBeNull();
    expect(complianceActionRoute(bookingIdOnProperty)).toBeNull();
  });

  it('complianceActionRoute_OldBackendPaths_AreNotRoutesOfTheManifest', () => {
    // The links of the old API (A5-09): neither a page nor a legacy redirect, the router sent them to the dashboard.
    const known = ROUTE_MANIFEST.flatMap((entry) => [entry.path, ...(entry.legacyPaths ?? [])]);
    for (const old of [
      `/properties/${PROPERTY_ID}/compliance/activation`,
      `/bookings/${BOOKING_ID}/check-in`,
      `/bookings/${BOOKING_ID}/checkout-wizard`,
      `/bookings/${BOOKING_ID}/alloggiati`,
    ]) {
      expect(known.some((path) => matchPath({ path, end: true }, old))).toBe(false);
    }
  });
});
