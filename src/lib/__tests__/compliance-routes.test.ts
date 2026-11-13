import { describe, expect, it } from 'vitest';
import { matchPath } from 'react-router-dom';
import { ROUTE_MANIFEST, type AppContextKey } from '@/config/route-manifest';
import { BOOKING_TABS } from '@/features/bookings/lib/booking-tabs';
import { guestDataCompletionPath } from '@/features/bookings/lib/stay-actions';
import { COMPLIANCE_ACTION_TARGETS, complianceActionRoute, isCurrentAddress } from '@/lib/compliance-routes';
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
  // CHK-12 (NF-52): without a month the archive opens on the kind and the property only.
  VerifyIdentity: `/app/short-rent/bookings/${BOOKING_ID}?tab=guest`,
  UploadAlloggiatiReceipt: `/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`,
  // The wizard that activates the police send of the property (E03/F01/US02/T02); who may only read the property is led to its section (E03/F03/US02/T01).
  ActivateOctorateSend: `/app/short-rent/compliance/sender?property=${PROPERTY_ID}`,
  SendAlloggiatiManually: `/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`,
  UploadIstatProof: `/app/short-rent/alloggiati/reports?kind=IstatProof&property=${PROPERTY_ID}`,
  EnterMunicipalityTaxRate: `/app/short-rent/properties/${PROPERTY_ID}`,
  DeclareTouristTax: `/app/short-rent/alloggiati/reports?kind=TouristTaxDeclaration&property=${PROPERTY_ID}`,
  RenewPoliceCredentials: '/app/short-rent/alloggiati',
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

  it('complianceActionTargets_EveryAction_SaysWhichPermissionDoesWhatItAsks', () => {
    // Whoever lacks it is led to the page and told "Apri" (the cockpit), never asked to do what the page will not let them do.
    expect(COMPLIANCE_ACTION_TARGETS.ActivateProperty.write).toBe('property.write');
    expect(COMPLIANCE_ACTION_TARGETS.SendAlloggiati.write).toBe('booking.write');
    expect(COMPLIANCE_ACTION_TARGETS.EnterMunicipalityTaxRate.write).toBe('property.write');
    // A tax receipt is a record of money.
    expect(COMPLIANCE_ACTION_TARGETS.DeclareTouristTax.write).toBe('payment.write');
    for (const action of COMPLIANCE_COCKPIT_ACTIONS) {
      expect(['property.write', 'booking.write', 'payment.write']).toContain(COMPLIANCE_ACTION_TARGETS[action].write);
    }
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

describe('complianceActionRoute of the periods (E03/F03/US01/T01, AC-NF52-5)', () => {
  const periodItem = (action: ComplianceCockpitAction, period: string | null | undefined): ComplianceSummaryItem => ({ ...itemFor(action), period });

  it.each([
    ['UploadIstatProof', 'IstatProof'],
    ['DeclareTouristTax', 'TouristTaxDeclaration'],
  ] as const)('complianceActionRoute_%s_WithAMonth_OpensTheArchiveOnTheKindThePropertyAndTheMonth', (action, kind) => {
    const url = complianceActionRoute(periodItem(action, '2026-09'));

    expect(url).toBe(`/app/short-rent/alloggiati/reports?kind=${kind}&property=${PROPERTY_ID}&period=2026-09`);
    // The archive is a page of the manifest, and the address carries what the page filters on.
    const { entry } = manifestEntryOf(url!);
    expect(entry?.path).toBe('/app/short-rent/alloggiati/reports');
    const query = new URL(url!, 'https://app.test').searchParams;
    expect(query.get('kind')).toBe(kind);
    expect(query.get('property')).toBe(PROPERTY_ID);
    expect(query.get('period')).toBe('2026-09');
  });

  it.each(['2026-13', '2026-9', '2026-09-01', '../x', '<script>', ''])('complianceActionRoute_PeriodThatIsNotAMonth_%s_IsLeftOutOfTheAddress', (period) => {
    const url = complianceActionRoute(periodItem('UploadIstatProof', period));

    expect(url).toBe(`/app/short-rent/alloggiati/reports?kind=IstatProof&property=${PROPERTY_ID}`);
  });

  it('complianceActionRoute_PeriodOnAnActionThatTakesNone_IsNotInTheAddress', () => {
    // Only the pages that open filtered take the month: the others are the same address whatever the item says.
    expect(complianceActionRoute(periodItem('EnterMunicipalityTaxRate', '2026-09'))).toBe(EXPECTED.EnterMunicipalityTaxRate);
    expect(complianceActionRoute(periodItem('SendAlloggiatiManually', '2026-09'))).toBe(EXPECTED.SendAlloggiatiManually);
  });

  it('complianceActionRoute_ArchiveWithoutBookingRead_IsNullNeverADeadButton', () => {
    // The archive and the Alloggiati dashboard ask what the bookings ask; the property page asks `property.read`.
    const propertyOnly = permissions(['property.read', 'property.write']);
    const bookingOnly = permissions(['booking.read', 'booking.write']);

    expect(complianceActionRoute(periodItem('UploadIstatProof', '2026-09'), propertyOnly)).toBeNull();
    expect(complianceActionRoute(itemFor('RenewPoliceCredentials'), propertyOnly)).toBeNull();
    expect(complianceActionRoute(itemFor('ActivateOctorateSend'), bookingOnly)).toBeNull();
    expect(complianceActionRoute(itemFor('EnterMunicipalityTaxRate'), bookingOnly)).toBeNull();
    expect(complianceActionRoute(periodItem('UploadIstatProof', '2026-09'), bookingOnly)).toBe(
      `/app/short-rent/alloggiati/reports?kind=IstatProof&property=${PROPERTY_ID}&period=2026-09`,
    );
    expect(complianceActionRoute(itemFor('ActivateOctorateSend'), propertyOnly)).toBe(EXPECTED.ActivateOctorateSend);
    // The wizard changes the sender (`property.write`): who may only read the property finds the section that tells it, never a page that would refuse them.
    expect(complianceActionRoute(itemFor('ActivateOctorateSend'), permissions(['property.read']))).toBe(`/app/short-rent/properties/${PROPERTY_ID}?section=connection-health`);
  });

  it('complianceActionRoute_PropertyItemWithoutItsProperty_HasNoLink', () => {
    // A property item without its property has no target at all: no link, never the archive of the whole organisation.
    expect(complianceActionRoute({ ...periodItem('UploadIstatProof', '2026-09'), propertyId: null })).toBeNull();
  });
});

// A card on the page of the property must not offer a button that opens the page it is on (the tourist tax rate leads there; the police send opens its wizard, or its section for who may only read).
describe('isCurrentAddress', () => {
  const propertyPage = `/app/short-rent/properties/${PROPERTY_ID}`;

  it('isCurrentAddress_EnterMunicipalityTaxRate_IsThePageOfThePropertyWhateverTabItIsOn', () => {
    const address = complianceActionRoute(itemFor('EnterMunicipalityTaxRate'))!;

    expect(address).toBe(propertyPage);
    expect(isCurrentAddress(address, { pathname: propertyPage, search: '' })).toBe(true);
    // The tab is what a button may change, but the page of the property has no field for the rate in any tab: nothing to offer.
    expect(isCurrentAddress(address, { pathname: propertyPage, search: '?tab=documents' })).toBe(true);
  });

  it('isCurrentAddress_ActivateOctorateSend_IsTheWizardAndNeverThePageOfThePropertyTheCardIsOn', () => {
    const address = complianceActionRoute(itemFor('ActivateOctorateSend'))!;

    expect(address).toBe(`/app/short-rent/compliance/sender?property=${PROPERTY_ID}`);
    // The card sits on the page of the property: the wizard is another page, so the button is offered whatever the tab is.
    expect(isCurrentAddress(address, { pathname: propertyPage, search: '' })).toBe(false);
    expect(isCurrentAddress(address, { pathname: propertyPage, search: '?section=connection-health' })).toBe(false);
    expect(isCurrentAddress(address, { pathname: '/app/short-rent/compliance/sender', search: `?property=${PROPERTY_ID}` })).toBe(true);
  });

  it('isCurrentAddress_ActivateOctorateSendForWhoMayOnlyRead_IsSomewhereToGoUntilTheSectionIsOpen', () => {
    const address = complianceActionRoute(itemFor('ActivateOctorateSend'), permissions(['property.read']))!;

    expect(address).toBe(`${propertyPage}?section=connection-health`);
    // On the plain page the section is a place to go to: the button is offered. Once it is in the address there is nothing left to open.
    expect(isCurrentAddress(address, { pathname: propertyPage, search: '' })).toBe(false);
    expect(isCurrentAddress(address, { pathname: propertyPage, search: '?tab=documents' })).toBe(false);
    expect(isCurrentAddress(address, { pathname: propertyPage, search: '?section=connection-health' })).toBe(true);
  });

  it('isCurrentAddress_AnotherPageOrAnotherTab_IsNotTheCurrentAddress', () => {
    expect(isCurrentAddress(propertyPage, { pathname: '/app/short-rent/properties', search: '' })).toBe(false);
    expect(isCurrentAddress(propertyPage, { pathname: '/app/short-rent/bookings/b1', search: '' })).toBe(false);
    // The same page on another tab is somewhere to go: the tab of the address is a parameter the person is not on yet.
    const guestTab = complianceActionRoute(itemFor('VerifyIdentity'))!;
    expect(isCurrentAddress(guestTab, { pathname: `/app/short-rent/bookings/${BOOKING_ID}`, search: '' })).toBe(false);
    expect(isCurrentAddress(guestTab, { pathname: `/app/short-rent/bookings/${BOOKING_ID}`, search: '?tab=alloggiati' })).toBe(false);
    expect(isCurrentAddress(guestTab, { pathname: `/app/short-rent/bookings/${BOOKING_ID}`, search: '?tab=guest' })).toBe(true);
  });

  it('isCurrentAddress_ArchiveOfAnotherMonthOrKind_IsNotTheCurrentAddress', () => {
    const address = complianceActionRoute({ ...itemFor('UploadIstatProof'), period: '2026-08' })!;
    const archive = '/app/short-rent/alloggiati/reports';

    expect(isCurrentAddress(address, { pathname: archive, search: '' })).toBe(false);
    expect(isCurrentAddress(address, { pathname: archive, search: `?kind=IstatProof&property=${PROPERTY_ID}&period=2026-07` })).toBe(false);
    expect(isCurrentAddress(address, { pathname: archive, search: `?kind=IstatProof&property=${PROPERTY_ID}&period=2026-08` })).toBe(true);
  });
});
