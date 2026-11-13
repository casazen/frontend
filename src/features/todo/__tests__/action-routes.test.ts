import { describe, expect, it } from 'vitest';
import { matchPath } from 'react-router-dom';
import { ROUTE_MANIFEST, type AppContextKey } from '@/config/route-manifest';
import { BOOKING_TABS } from '@/features/bookings/lib/booking-tabs';
import { COMPLIANCE_ACTION_TARGETS } from '@/lib/compliance-routes';
import { ACTION_ROUTE_MAP, todoActionRoute } from '../activity-card';

const BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const NO_ID = '00000000-0000-0000-0000-000000000000';

/** Every `ActivityAction` of ADR-026-R6: the map has an entry for each (the later epics append theirs). */
const R6_ACTIONS = [
  'ReviewBooking',
  'StartCheckIn',
  'CompleteCheckOut',
  'VerifyIdentity',
  'UploadAlloggiatiProof',
  'UploadIstatProof',
  'FixListingError',
  'ReplyToMessage',
  'ApproveAiDraft',
  'ResumeWizard',
  'ReconnectChannel',
] as const;

type R6Action = (typeof R6_ACTIONS)[number];

/** An item as the API sends it: the entity it is about, its property when it has one. */
function itemFor(action: string, overrides: Partial<{ entityType: string; entityId: string; propertyId: string | null }> = {}) {
  const onProperty = action === 'FixListingError' || action === 'ResumeWizard';
  return {
    action,
    entityType: onProperty ? 'Property' : 'Booking',
    entityId: onProperty ? PROPERTY_ID : BOOKING_ID,
    propertyId: PROPERTY_ID as string | null,
    ...overrides,
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

const EXPECTED: Record<R6Action, string> = {
  ReviewBooking: `/app/short-rent/bookings/${BOOKING_ID}`,
  StartCheckIn: `/app/short-rent/bookings/${BOOKING_ID}/check-in`,
  CompleteCheckOut: `/app/short-rent/bookings/${BOOKING_ID}/checkout`,
  VerifyIdentity: '/app/short-rent/verifications',
  UploadAlloggiatiProof: '/app/short-rent/alloggiati',
  UploadIstatProof: '/app/short-rent/compliance',
  FixListingError: `/app/short-rent/properties/create?propertyId=${PROPERTY_ID}&step=channels`,
  ReplyToMessage: `/app/short-rent/bookings/${BOOKING_ID}?tab=messages`,
  ApproveAiDraft: '/app/short-rent/approval-queue',
  ResumeWizard: `/app/short-rent/properties/${PROPERTY_ID}/activation`,
  ReconnectChannel: '/app/short-rent/channels',
};

describe('ACTION_ROUTE_MAP (ADR-026-R6)', () => {
  it('actionRouteMap_EveryActionOfTheAdr_HasAnEntry', () => {
    for (const action of R6_ACTIONS) {
      expect(Object.hasOwn(ACTION_ROUTE_MAP, action), action).toBe(true);
    }
  });

  it.each(Object.entries(ACTION_ROUTE_MAP))('actionRouteMap_%s_PagesAreRoutesOfTheManifestInShortRent', (_action, target) => {
    type RouteOfEntry = { path: string; target?: string; entityType?: string; tab?: string; propertyParam?: string };
    const targetOfEntry = target as { route: RouteOfEntry; fallback?: RouteOfEntry | RouteOfEntry[] };
    const fallbacks = targetOfEntry.fallback === undefined ? [] : Array.isArray(targetOfEntry.fallback) ? targetOfEntry.fallback : [targetOfEntry.fallback];
    for (const candidate of [targetOfEntry.route, ...fallbacks]) {
      expect(
        ROUTE_MANIFEST.some((entry) => entry.path === candidate.path && entry.context === 'short-rent'),
        `${candidate.path} is not a route of the ROUTE_MANIFEST`,
      ).toBe(true);
      // A page with `:id` says whose id fills it, and a page without it does not ask for one (but for the property in its address).
      expect(candidate.path.includes(':id'), candidate.path).toBe(candidate.target !== undefined);
      if (candidate.propertyParam !== undefined) expect(candidate.target, candidate.path).toBeUndefined();
      // A page filled with the id of the entity says which kind of entity that is: the id of anything else is not a booking's.
      expect(candidate.entityType !== undefined, candidate.path).toBe(candidate.target === 'entity');
      if (candidate.tab !== undefined) expect(BOOKING_TABS as readonly string[]).toContain(candidate.tab);
    }
  });

  it.each(R6_ACTIONS)('todoActionRoute_%s_IsAShortRentRouteOfTheManifest', (action) => {
    const route = todoActionRoute(itemFor(action));

    expect(route).not.toBeNull();
    const { entry, pathname, tab } = manifestEntryOf(route!);
    expect(entry, `${route} is not a route of the ROUTE_MANIFEST`).toBeDefined();
    expect(entry!.context).toBe('short-rent');
    expect(pathname).not.toContain(':');
    if (tab !== null) expect(BOOKING_TABS as readonly string[]).toContain(tab);
  });

  it.each(R6_ACTIONS)('todoActionRoute_%s_OpensThePageOfTheAction', (action) => {
    expect(todoActionRoute(itemFor(action))).toBe(EXPECTED[action]);
  });

  it('todoActionRoute_WithTheWritePermissions_OpensThePageOfTheAction', () => {
    const everything = permissions(['property.read', 'property.write', 'booking.read', 'booking.write', 'verification.decide', 'approval.decide']);

    for (const action of R6_ACTIONS) {
      expect(todoActionRoute(itemFor(action), everything), action).toBe(EXPECTED[action]);
    }
  });

  it('todoActionRoute_WithoutTheRightToWrite_FallsBackToThePageOfTheSameThingInReadOnly', () => {
    const readOnly = permissions(['property.read', 'booking.read']);

    // Check-out is written (`booking.write`): who may only read the bookings finds the stay.
    expect(todoActionRoute(itemFor('CompleteCheckOut'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
    // The wizard "Guest check-in" saves the guests (`booking.write`): who may only read the bookings finds the documents of the stay.
    expect(todoActionRoute(itemFor('StartCheckIn'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=guest`);
    // The queue of the verifications is decided by who holds `verification.decide`: the others find the documents of the stay.
    expect(todoActionRoute(itemFor('VerifyIdentity'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=guest`);
    // The queue of the approvals is decided by who holds `approval.decide`: the others find the messages of the stay.
    expect(todoActionRoute(itemFor('ApproveAiDraft'), permissions(['property.read', 'property.write', 'booking.read', 'booking.write']))).toBe(
      `/app/short-rent/bookings/${BOOKING_ID}?tab=messages`,
    );
    expect(todoActionRoute(itemFor('ApproveAiDraft'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=messages`);
  });

  it('todoActionRoute_NoPageThePersonCanOpen_ReturnsNull', () => {
    expect(todoActionRoute(itemFor('VerifyIdentity'), permissions(['property.read']))).toBeNull();
    expect(todoActionRoute(itemFor('ReviewBooking'), permissions([]))).toBeNull();
    // The wizard of the activation is written: `property.write`, and the activation has no read-only page.
    expect(todoActionRoute(itemFor('ResumeWizard'), permissions(['property.read']))).toBeNull();
  });

  it('todoActionRoute_FixListingError_OpensTheWizardOfThePropertyAtTheChannelsStep', () => {
    // The three types of the story (a publication error, a silent channel, a change made outside CasaZen) share the action (E02/F03/US01/T04).
    for (const entityType of ['Property', 'Channel', 'ListingChannelState']) {
      const item = itemFor('FixListingError', { entityType, entityId: BOOKING_ID, propertyId: PROPERTY_ID });
      expect(todoActionRoute(item), entityType).toBe(`/app/short-rent/properties/create?propertyId=${PROPERTY_ID}&step=channels`);
    }
  });

  it('todoActionRoute_FixListingErrorForWhoCannotWriteTheProperties_OpensThePageOfTheProperty', () => {
    const readOnly = permissions(['property.read']);

    expect(todoActionRoute(itemFor('FixListingError'), readOnly)).toBe(`/app/short-rent/properties/${PROPERTY_ID}`);
    // No property named: the channels, which every reader of the properties can open; and nothing for who can open nothing.
    expect(todoActionRoute(itemFor('FixListingError', { propertyId: null, entityType: 'Channel' }), readOnly)).toBe('/app/short-rent/channels');
    expect(todoActionRoute(itemFor('FixListingError'), permissions([]))).toBeNull();
  });

  it('todoActionRoute_ItemOfTheWholeAccount_UsesTheFallbackThatNeedsNoProperty', () => {
    // A publication error with no property (a lost connection): the property page needs one, the channels do not.
    const item = itemFor('FixListingError', { entityType: 'Channel', entityId: BOOKING_ID, propertyId: null });

    expect(todoActionRoute(item)).toBe('/app/short-rent/channels');
  });

  it('todoActionRoute_PropertyNamedByTheItem_WinsOverTheEntity', () => {
    const item = itemFor('ResumeWizard', { entityType: 'Draft', entityId: BOOKING_ID, propertyId: PROPERTY_ID });

    expect(todoActionRoute(item)).toBe(`/app/short-rent/properties/${PROPERTY_ID}/activation`);
  });

  it('todoActionRoute_ItemsOfTheActivationWithOctorate_OpenTheirOwnPageNotTheWizardOfAProperty', () => {
    const STEP_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const item = (entityType: string, overrides: Partial<{ entityId: string; propertyId: string | null }> = {}) =>
      itemFor('ResumeWizard', { entityType, entityId: STEP_ID, propertyId: PROPERTY_ID, ...overrides });
    const everything = permissions(['property.read', 'property.write']);

    // A guided step of the panel finds its kind from the id of the step (the item knows the step, not its kind); its property does not take it to the activation of the property.
    expect(todoActionRoute(item('OnboardingPanelStep'), everything)).toBe(`/app/short-rent/onboarding/panel?step=${STEP_ID}`);
    // A part put off or left half way, and a «Fallo per me» request, know the id of a stored row and no part: the plan, where the part that is open is highlighted.
    expect(todoActionRoute(item('OnboardingPart', { propertyId: null }), everything)).toBe('/app/short-rent/onboarding');
    expect(todoActionRoute(item('OnboardingAssistRequest', { propertyId: null }), everything)).toBe('/app/short-rent/onboarding');
    // A flow to complete opens the summary of the activation (readable by whoever reads the properties).
    expect(todoActionRoute(item('OnboardingFlow', { propertyId: null }), permissions(['property.read']))).toBe('/app/short-rent/onboarding/summary');
    // The panel steps are written: a reader is not sent to a page that would refuse them.
    expect(todoActionRoute(item('OnboardingPanelStep'), permissions(['property.read']))).toBeNull();
    // Everything else about a property still opens its activation.
    expect(todoActionRoute(item('Property'), everything)).toBe(`/app/short-rent/properties/${PROPERTY_ID}/activation`);
  });

  it('todoActionRoute_ItemWithoutTheIdThePageNeeds_ReturnsNullNeverAHalfBuiltAddress', () => {
    expect(todoActionRoute(itemFor('ReviewBooking', { entityId: NO_ID }))).toBeNull();
    expect(todoActionRoute(itemFor('ResumeWizard', { entityType: 'Draft', entityId: NO_ID, propertyId: null }))).toBeNull();
  });

  it('todoActionRoute_ItemAboutAnotherKindOfEntity_ReturnsNullNeverTheIdOfSomethingThatIsNotABooking', () => {
    const readOnly = permissions(['property.read', 'booking.read']);

    // A message thread of a channel is not a booking: its id opens no booking page.
    expect(todoActionRoute(itemFor('ReplyToMessage', { entityType: 'OtaMessageThread' }))).toBeNull();
    // A queue item reaches the queue, which needs no booking id, but not the read-only fallback that is a booking page.
    const queueItem = itemFor('ApproveAiDraft', { entityType: 'ApprovalQueueItem' });
    expect(todoActionRoute(queueItem)).toBe('/app/short-rent/approval-queue');
    expect(todoActionRoute(queueItem, readOnly)).toBeNull();
    // The same item about a booking still finds the stay.
    expect(todoActionRoute(itemFor('ApproveAiDraft'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=messages`);
  });

  it('todoActionRoute_ReviewFiscalDocument_OpensTheFiscalPageOfTheHostForWhoMayReadTheProperties', () => {
    // `ActivityAction` 30 (E06/F03/US02/T01): a rejected or to-collect fiscal document of the channel manager. Its page is the fiscal page of the
    // host until the list of the documents exists; the item is about a document, never a booking, so no id fills the address.
    const item = itemFor('ReviewFiscalDocument', { entityType: 'FiscalDocument', entityId: BOOKING_ID, propertyId: null });

    expect(todoActionRoute(item)).toBe('/app/short-rent/fiscal');
    expect(todoActionRoute(item, permissions(['property.read']))).toBe('/app/short-rent/fiscal');
    // Who cannot open the page is not offered a button that ends on «nessun accesso».
    expect(todoActionRoute(item, permissions([]))).toBeNull();
  });

  it('todoActionRoute_UnknownAction_ReturnsNullNeverTheDashboard', () => {
    // A later version of the server may send an action this one does not know yet; an inherited name is not one either.
    expect(todoActionRoute(itemFor('SomethingNew'))).toBeNull();
    expect(todoActionRoute(itemFor('toString'))).toBeNull();
    expect(todoActionRoute(itemFor(''))).toBeNull();
  });
});

// E03/F02/US01/T03 (NF-52): the feeder opens a "To do" for each red or yellow item of the cockpit, with the action of the cockpit. The «Adesso» block of the
// Home must lead where the cockpit leads.
describe('ACTION_ROUTE_MAP: the actions of the traffic light', () => {
  const stay = (action: string) => ({ action, entityType: 'Booking', entityId: BOOKING_ID, propertyId: PROPERTY_ID as string | null });
  const ofProperty = (action: string, entityType = 'Property') => ({ action, entityType, entityId: PROPERTY_ID, propertyId: PROPERTY_ID as string | null });
  const ACTIONS_OF_THE_LIGHT = ['SendAlloggiatiManually', 'ActivateOctorateSend', 'RenewPoliceCredentials', 'EnterMunicipalityTaxRate', 'DeclareTouristTax'] as const;

  it.each(ACTIONS_OF_THE_LIGHT)('actionRouteMap_%s_HasAnEntryThatLeadsWhereTheCockpitLeads', (action) => {
    expect(Object.hasOwn(ACTION_ROUTE_MAP, action)).toBe(true);
    const todo = ACTION_ROUTE_MAP[action].route;
    const cockpit = COMPLIANCE_ACTION_TARGETS[action].route;

    expect(todo.path).toBe(cockpit.path);
    if ('tab' in todo) expect(todo.tab).toBe(cockpit.tab);
  });

  it('todoActionRoute_SendAlloggiatiManually_OpensTheAlloggiatiSectionOfTheStay', () => {
    expect(todoActionRoute(stay('SendAlloggiatiManually'))).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`);
    // The id of anything else than a booking is not a booking's.
    expect(todoActionRoute({ ...stay('SendAlloggiatiManually'), entityType: 'Property' })).toBeNull();
  });

  it.each(['ActivateOctorateSend', 'EnterMunicipalityTaxRate'])('todoActionRoute_%s_OpensThePageOfTheProperty', (action) => {
    expect(todoActionRoute(ofProperty(action))).toBe(`/app/short-rent/properties/${PROPERTY_ID}`);
    // The property is the one the item names, or the entity itself.
    expect(todoActionRoute({ ...ofProperty(action), propertyId: null })).toBe(`/app/short-rent/properties/${PROPERTY_ID}`);
    expect(todoActionRoute({ ...ofProperty(action, 'Booking'), propertyId: null })).toBeNull();
  });

  it('todoActionRoute_RenewPoliceCredentials_OpensTheAlloggiatiDashboard', () => {
    expect(todoActionRoute(ofProperty('RenewPoliceCredentials'))).toBe('/app/short-rent/alloggiati');
  });

  it('todoActionRoute_DeclareTouristTax_OpensTheArchiveOnTheTaxDeclarationOfTheProperty', () => {
    // The item of a month is about the property and carries the month in its entity type.
    expect(todoActionRoute(ofProperty('DeclareTouristTax', 'PropertyPeriod:2026-08'))).toBe(
      `/app/short-rent/alloggiati/reports?property=${PROPERTY_ID}&kind=TouristTaxDeclaration`,
    );
    // Without a property there is nothing to filter on: no half-built address.
    expect(todoActionRoute({ ...ofProperty('DeclareTouristTax', 'PropertyPeriod:2026-08'), propertyId: null })).toBeNull();
  });

  it('todoActionRoute_ActionsOfTheLight_NeverOfferAPageThePersonCannotOpen', () => {
    // The page of a property asks `property.read`; the Alloggiati pages and the archive ask `booking.read`.
    const bookingsOnly = permissions(['booking.read']);
    const propertiesOnly = permissions(['property.read']);

    expect(todoActionRoute(ofProperty('ActivateOctorateSend'), bookingsOnly)).toBeNull();
    expect(todoActionRoute(ofProperty('RenewPoliceCredentials'), propertiesOnly)).toBeNull();
    expect(todoActionRoute(ofProperty('DeclareTouristTax', 'PropertyPeriod:2026-08'), propertiesOnly)).toBeNull();
    expect(todoActionRoute(stay('SendAlloggiatiManually'), propertiesOnly)).toBeNull();
    expect(todoActionRoute(ofProperty('ActivateOctorateSend'), propertiesOnly)).toBe(`/app/short-rent/properties/${PROPERTY_ID}`);
    expect(todoActionRoute(stay('SendAlloggiatiManually'), bookingsOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`);
  });
});

// Every `ActivityAction` of the backend (`Casazen.Core/Entities/Enums/ActivityAction.cs`, today 21 values): the map has an entry for each, or the action is
// in the list of those whose page does not exist yet. An action that is in neither is a "To do" with no button that nobody noticed; the task that builds
// the page adds the entry and takes the action out of the list (the test below fails until it does).
const BACKEND_ACTIONS = [
  'ReviewBooking',
  'StartCheckIn',
  'CompleteCheckOut',
  'VerifyIdentity',
  'UploadAlloggiatiProof',
  'UploadIstatProof',
  'FixListingError',
  'ReplyToMessage',
  'ApproveAiDraft',
  'ResumeWizard',
  'ReconnectChannel',
  'ConfirmChannelMapping',
  'CheckImportedListing',
  'SendAlloggiatiManually',
  'ActivateOctorateSend',
  'EnterMunicipalityTaxRate',
  'DeclareTouristTax',
  'RenewPoliceCredentials',
  'ReviewFiscalDocument',
  'ReviewOwnerStay',
  'RenewOwnerDocument',
] as const;

/** The actions whose page does not exist in the app yet: the mapping of the listings of the channel manager and the stays and documents of the owner portal. */
const ACTIONS_WITHOUT_A_PAGE_YET: readonly string[] = ['ConfirmChannelMapping', 'CheckImportedListing', 'ReviewOwnerStay', 'RenewOwnerDocument'];

describe('ACTION_ROUTE_MAP and the actions of the backend', () => {
  it.each(BACKEND_ACTIONS)('actionRouteMap_BackendAction_%s_HasAnEntryOrIsInTheListOfThoseWithoutAPageYet', (action) => {
    expect(Object.hasOwn(ACTION_ROUTE_MAP, action), action).toBe(!ACTIONS_WITHOUT_A_PAGE_YET.includes(action));
  });

  it('actionRouteMap_EveryEntry_IsAnActionOfTheBackend', () => {
    expect(Object.keys(ACTION_ROUTE_MAP).filter((action) => !(BACKEND_ACTIONS as readonly string[]).includes(action))).toEqual([]);
  });

  it.each(ACTIONS_WITHOUT_A_PAGE_YET)('todoActionRoute_%s_WithoutAPageYet_OffersNoButtonAndNeverADeadOne', (action) => {
    expect(todoActionRoute(itemFor(action))).toBeNull();
  });
});
