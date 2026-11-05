import { describe, expect, it } from 'vitest';
import { matchPath } from 'react-router-dom';
import { ROUTE_MANIFEST, type AppContextKey } from '@/config/route-manifest';
import { BOOKING_TABS } from '@/features/bookings/lib/booking-tabs';
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
  StartCheckIn: `/app/short-rent/bookings/${BOOKING_ID}?tab=guest`,
  CompleteCheckOut: `/app/short-rent/bookings/${BOOKING_ID}/checkout`,
  VerifyIdentity: '/app/short-rent/verifications',
  UploadAlloggiatiProof: '/app/short-rent/alloggiati',
  UploadIstatProof: '/app/short-rent/compliance',
  FixListingError: `/app/short-rent/properties/${PROPERTY_ID}`,
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
    const targetOfEntry = target as { route: { path: string; target?: string; tab?: string }; fallback?: { path: string; target?: string; tab?: string } };
    for (const candidate of [targetOfEntry.route, ...(targetOfEntry.fallback ? [targetOfEntry.fallback] : [])]) {
      expect(
        ROUTE_MANIFEST.some((entry) => entry.path === candidate.path && entry.context === 'short-rent'),
        `${candidate.path} is not a route of the ROUTE_MANIFEST`,
      ).toBe(true);
      // A page with `:id` says whose id fills it, and a page without it does not ask for one.
      expect(candidate.path.includes(':id'), candidate.path).toBe(candidate.target !== undefined);
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
    const everything = permissions(['property.read', 'property.write', 'booking.read', 'booking.write', 'verification.decide']);

    for (const action of R6_ACTIONS) {
      expect(todoActionRoute(itemFor(action), everything), action).toBe(EXPECTED[action]);
    }
  });

  it('todoActionRoute_WithoutTheRightToWrite_FallsBackToThePageOfTheSameThingInReadOnly', () => {
    const readOnly = permissions(['property.read', 'booking.read']);

    // Check-out is written (`booking.write`): who may only read the bookings finds the stay.
    expect(todoActionRoute(itemFor('CompleteCheckOut'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
    // The queue of the verifications is decided by who holds `verification.decide`: the others find the documents of the stay.
    expect(todoActionRoute(itemFor('VerifyIdentity'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=guest`);
    // The queue of the approvals is `property.write`: the others find the messages of the stay.
    expect(todoActionRoute(itemFor('ApproveAiDraft'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=messages`);
  });

  it('todoActionRoute_NoPageThePersonCanOpen_ReturnsNull', () => {
    expect(todoActionRoute(itemFor('VerifyIdentity'), permissions(['property.read']))).toBeNull();
    expect(todoActionRoute(itemFor('ReviewBooking'), permissions([]))).toBeNull();
    // The wizard of the activation is written: `property.write`, and the activation has no read-only page.
    expect(todoActionRoute(itemFor('ResumeWizard'), permissions(['property.read']))).toBeNull();
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

  it('todoActionRoute_ItemWithoutTheIdThePageNeeds_ReturnsNullNeverAHalfBuiltAddress', () => {
    expect(todoActionRoute(itemFor('ReviewBooking', { entityId: NO_ID }))).toBeNull();
    expect(todoActionRoute(itemFor('ResumeWizard', { entityType: 'Draft', entityId: NO_ID, propertyId: null }))).toBeNull();
  });

  it('todoActionRoute_UnknownAction_ReturnsNullNeverTheDashboard', () => {
    // A later version of the server may send an action this one does not know yet; an inherited name is not one either.
    expect(todoActionRoute(itemFor('SomethingNew'))).toBeNull();
    expect(todoActionRoute(itemFor('toString'))).toBeNull();
    expect(todoActionRoute(itemFor(''))).toBeNull();
  });
});
