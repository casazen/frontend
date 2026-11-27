import { describe, expect, it } from 'vitest';
import { matchPath } from 'react-router-dom';
import type { ContextBootstrapDto } from '@/api/contexts';
import { ROUTE_MANIFEST, type AppContextKey, type PermissionPredicate } from '@/config/route-manifest';
import { BOOKING_TABS } from '@/features/bookings/lib/booking-tabs';
import { COMPLIANCE_ACTION_TARGETS } from '@/lib/compliance-routes';
import { ORG_BILLING_ADMIN_PERMISSION, isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { SHORT_RENT_ROLE_KEYS, SHORT_RENT_ROLE_PERMISSIONS, hostContextsOf, workspacePredicateOf } from '@/test/host-roles';
import { MEMBER_ROLE_KEYS, contextOf } from '@/test/org-contexts';
import { ACTION_ROUTE_MAP, todoActionRoute } from '../activity-card';

const BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const NO_ID = '00000000-0000-0000-0000-000000000000';
const DOCUMENT_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const OWNER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

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

const ACTIONS_OF_THE_ACCOUNT_AREA: readonly string[] = ['ReviewOwnerStatement', 'ReviewSelfBilling'];

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
  ReplyToMessage: `/app/short-rent/messages/direct%3A${BOOKING_ID}`,
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

  it.each(Object.entries(ACTION_ROUTE_MAP))('actionRouteMap_%s_PagesAreRoutesOfTheManifestOfTheirArea', (action, target) => {
    type RouteOfEntry = { path: string; target?: string; entityType?: string; tab?: string; propertyParam?: string; idParam?: string };
    const targetOfEntry = target as { route: RouteOfEntry; fallback?: RouteOfEntry | RouteOfEntry[] };
    const fallbacks = targetOfEntry.fallback === undefined ? [] : Array.isArray(targetOfEntry.fallback) ? targetOfEntry.fallback : [targetOfEntry.fallback];
    const area = ACTIONS_OF_THE_ACCOUNT_AREA.includes(action) ? 'account' : 'short-rent';
    for (const candidate of [targetOfEntry.route, ...fallbacks]) {
      expect(
        ROUTE_MANIFEST.some((entry) => entry.path === candidate.path && entry.context === area),
        `${candidate.path} is not a route of the ROUTE_MANIFEST in ${area}`,
      ).toBe(true);
      expect(/:[A-Za-z]+/.test(candidate.path), candidate.path).toBe(candidate.target !== undefined);
      if (candidate.idParam !== undefined) expect(candidate.path, candidate.path).toContain(`:${candidate.idParam}`);
      if (candidate.propertyParam !== undefined) expect(candidate.target, candidate.path).toBeUndefined();
      expect(candidate.entityType !== undefined, candidate.path).toBe(candidate.target === 'entity' || candidate.target === 'thread');
      if (candidate.target === 'thread') expect(['ota', 'direct'], candidate.path).toContain((candidate as { threadKind?: string }).threadKind);
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
    const everything = permissions(['property.read', 'property.write', 'booking.read', 'booking.write', 'verification.decision', 'approval.decide']);

    for (const action of R6_ACTIONS) {
      expect(todoActionRoute(itemFor(action), everything), action).toBe(EXPECTED[action]);
    }
  });

  it('todoActionRoute_WithoutTheRightToWrite_FallsBackToThePageOfTheSameThingInReadOnly', () => {
    const readOnly = permissions(['property.read', 'booking.read']);

    expect(todoActionRoute(itemFor('CompleteCheckOut'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
    expect(todoActionRoute(itemFor('StartCheckIn'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=guest`);
    expect(todoActionRoute(itemFor('VerifyIdentity'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=guest`);
    expect(todoActionRoute(itemFor('ApproveAiDraft'), permissions(['property.read', 'property.write', 'booking.read', 'booking.write']))).toBe(
      `/app/short-rent/bookings/${BOOKING_ID}?tab=messages`,
    );
    expect(todoActionRoute(itemFor('ApproveAiDraft'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=messages`);
  });

  it('todoActionRoute_NoPageThePersonCanOpen_ReturnsNull', () => {
    expect(todoActionRoute(itemFor('VerifyIdentity'), permissions(['property.read']))).toBeNull();
    expect(todoActionRoute(itemFor('ReviewBooking'), permissions([]))).toBeNull();
    expect(todoActionRoute(itemFor('ResumeWizard'), permissions(['property.read']))).toBeNull();
  });

  it('todoActionRoute_FixListingError_OpensTheWizardOfThePropertyAtTheChannelsStep', () => {
    for (const entityType of ['Property', 'Channel', 'ListingChannelState']) {
      const item = itemFor('FixListingError', { entityType, entityId: BOOKING_ID, propertyId: PROPERTY_ID });
      expect(todoActionRoute(item), entityType).toBe(`/app/short-rent/properties/create?propertyId=${PROPERTY_ID}&step=channels`);
    }
  });

  it('todoActionRoute_FixListingErrorForWhoCannotWriteTheProperties_OpensThePageOfTheProperty', () => {
    const readOnly = permissions(['property.read']);

    expect(todoActionRoute(itemFor('FixListingError'), readOnly)).toBe(`/app/short-rent/properties/${PROPERTY_ID}`);
    expect(todoActionRoute(itemFor('FixListingError', { propertyId: null, entityType: 'Channel' }), readOnly)).toBe('/app/short-rent/channels');
    expect(todoActionRoute(itemFor('FixListingError'), permissions([]))).toBeNull();
  });

  it('todoActionRoute_ItemOfTheWholeAccount_UsesTheFallbackThatNeedsNoProperty', () => {
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

    expect(todoActionRoute(item('OnboardingPanelStep'), everything)).toBe(`/app/short-rent/onboarding/panel?step=${STEP_ID}`);
    expect(todoActionRoute(item('OnboardingPart', { propertyId: null }), everything)).toBe('/app/short-rent/onboarding');
    expect(todoActionRoute(item('OnboardingAssistRequest', { propertyId: null }), everything)).toBe('/app/short-rent/onboarding');
    expect(todoActionRoute(item('OnboardingFlow', { propertyId: null }), permissions(['property.read']))).toBe('/app/short-rent/onboarding/summary');
    expect(todoActionRoute(item('OnboardingPanelStep'), permissions(['property.read']))).toBeNull();
    expect(todoActionRoute(item('Property'), everything)).toBe(`/app/short-rent/properties/${PROPERTY_ID}/activation`);
  });

  it('todoActionRoute_ItemWithoutTheIdThePageNeeds_ReturnsNullNeverAHalfBuiltAddress', () => {
    expect(todoActionRoute(itemFor('ReviewBooking', { entityId: NO_ID }))).toBeNull();
    expect(todoActionRoute(itemFor('ResumeWizard', { entityType: 'Draft', entityId: NO_ID, propertyId: null }))).toBeNull();
  });

  it('todoActionRoute_ItemAboutAnotherKindOfEntity_ReturnsNullNeverTheIdOfSomethingThatIsNotABooking', () => {
    const readOnly = permissions(['property.read', 'booking.read']);

    expect(todoActionRoute(itemFor('ReplyToMessage', { entityType: 'OtaMessageThread' }))).toBe(`/app/short-rent/messages/ota%3A${BOOKING_ID}`);
    expect(todoActionRoute(itemFor('ReplyToMessage', { entityType: 'ApprovalQueueItem' }))).toBeNull();
    expect(todoActionRoute(itemFor('ReplyToMessage', { entityType: 'OtaMessageThread', entityId: NO_ID }))).toBeNull();
    expect(todoActionRoute(itemFor('ReplyToMessage', { entityType: 'OtaMessageThread' }), permissions(['property.read']))).toBeNull();
    const queueItem = itemFor('ApproveAiDraft', { entityType: 'ApprovalQueueItem' });
    expect(todoActionRoute(queueItem)).toBe('/app/short-rent/approval-queue');
    expect(todoActionRoute(queueItem, readOnly)).toBeNull();
    expect(todoActionRoute(itemFor('ApproveAiDraft'), readOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=messages`);
  });

  it('todoActionRoute_ReviewFiscalDocument_OpensTheFiscalPageOfTheHostForWhoMayReadTheProperties', () => {
    const item = itemFor('ReviewFiscalDocument', { entityType: 'FiscalDocument', entityId: BOOKING_ID, propertyId: null });

    expect(todoActionRoute(item)).toBe('/app/short-rent/fiscal');
    expect(todoActionRoute(item, permissions(['property.read']))).toBe('/app/short-rent/fiscal');
    expect(todoActionRoute(item, permissions([]))).toBeNull();
  });

  it('todoActionRoute_ReviewFiscalDocumentAboutAnOwner_OpensTheStepOfTheOwnersWhoIssueAndFallsBackToTheFiscalPage', () => {
    // E17/F03/US01/T01: the owner of an Italian stay has no issuer profile that can issue (the item is about the owner, never a booking): the step of the wizard Fatturazione where the profile is made.
    const item = itemFor('ReviewFiscalDocument', { entityType: 'PropertyOwner', entityId: OWNER_ID, propertyId: PROPERTY_ID });

    expect(todoActionRoute(item)).toBe('/app/short-rent/fiscal/setup?step=owner-issuers');
    expect(todoActionRoute(item, permissions(['property.read', 'payment.read']))).toBe('/app/short-rent/fiscal/setup?step=owner-issuers');
    expect(todoActionRoute(item, permissions(['property.read']))).toBe('/app/short-rent/fiscal');
    expect(todoActionRoute(item, permissions([]))).toBeNull();
  });

  it('todoActionRoute_CorrectInvoice_OpensTheRejectedDocumentAtTheStepOfTheCorrection', () => {
    // `ActivityAction` 31 (E17/F01/US02/T03): the SDI rejected an invoice of CasaZen; the item is about the document and the page of the documents opens its detail at the guided correction.
    const item = itemFor('CorrectInvoice', { entityType: 'FiscalDocument', entityId: DOCUMENT_ID, propertyId: null });
    const expected = `/app/short-rent/fiscal/documents?document=${DOCUMENT_ID}&step=correct`;

    expect(todoActionRoute(item)).toBe(expected);
    expect(todoActionRoute(item, permissions(['property.read', 'payment.read']))).toBe(expected);
    // Who may not open the documents page is led to the fiscal page when they read the properties, and is not offered a button at all otherwise.
    expect(todoActionRoute(item, permissions(['property.read']))).toBe('/app/short-rent/fiscal');
    expect(todoActionRoute(item, permissions([]))).toBeNull();
  });

  it('todoActionRoute_CorrectInvoice_AnItemOfAnotherKindOfEntity_NeverNamesADocumentThatIsNotOne', () => {
    const item = itemFor('CorrectInvoice', { entityType: 'Booking', entityId: BOOKING_ID, propertyId: null });

    expect(todoActionRoute(item)).toBe('/app/short-rent/fiscal');
    expect(todoActionRoute(itemFor('CorrectInvoice', { entityType: 'FiscalDocument', entityId: NO_ID, propertyId: null }))).toBe('/app/short-rent/fiscal');
  });

  it('todoActionRoute_UnknownAction_ReturnsNullNeverTheDashboard', () => {
    expect(todoActionRoute(itemFor('SomethingNew'))).toBeNull();
    expect(todoActionRoute(itemFor('toString'))).toBeNull();
    expect(todoActionRoute(itemFor(''))).toBeNull();
  });
});

describe('ACTION_ROUTE_MAP: the actions of the traffic light', () => {
  const stay = (action: string) => ({ action, entityType: 'Booking', entityId: BOOKING_ID, propertyId: PROPERTY_ID as string | null });
  const ofProperty = (action: string, entityType = 'Property') => ({ action, entityType, entityId: PROPERTY_ID, propertyId: PROPERTY_ID as string | null });
  const ACTIONS_OF_THE_LIGHT = ['SendAlloggiatiManually', 'ActivateOctorateSend', 'RenewPoliceCredentials', 'DeclareTouristTax'] as const;

  it.each(ACTIONS_OF_THE_LIGHT)('actionRouteMap_%s_HasAnEntryThatLeadsWhereTheCockpitLeads', (action) => {
    expect(Object.hasOwn(ACTION_ROUTE_MAP, action)).toBe(true);
    const todo = ACTION_ROUTE_MAP[action].route;
    const cockpit = COMPLIANCE_ACTION_TARGETS[action].route;

    expect(todo.path).toBe(cockpit.path);
    if ('tab' in todo) expect(todo.tab).toBe(cockpit.tab);
  });

  it('todoActionRoute_SendAlloggiatiManually_OpensTheAlloggiatiSectionOfTheStay', () => {
    expect(todoActionRoute(stay('SendAlloggiatiManually'))).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`);
    expect(todoActionRoute({ ...stay('SendAlloggiatiManually'), entityType: 'Property' })).toBeNull();
  });

  it.each([
    ['ActivateOctorateSend', `/app/short-rent/compliance/sender?property=${PROPERTY_ID}`],
  ])('todoActionRoute_%s_OpensThePageOfTheProperty', (action, address) => {
    expect(todoActionRoute(ofProperty(action))).toBe(address);
    expect(todoActionRoute({ ...ofProperty(action), propertyId: null })).toBe(address);
    expect(todoActionRoute({ ...ofProperty(action, 'Booking'), propertyId: null })).toBeNull();
  });

  it('todoActionRoute_ActivateOctorateSend_IsTheWizardOnlyForWhoMayChangeTheSenderAndTheSectionOfThePropertyForWhoMayOnlyRead', () => {
    const everything = permissions(['property.read', 'property.write']);
    const readOnly = permissions(['property.read']);

    expect(todoActionRoute(ofProperty('ActivateOctorateSend'), everything)).toBe(`/app/short-rent/compliance/sender?property=${PROPERTY_ID}`);
    expect(todoActionRoute(ofProperty('ActivateOctorateSend'), readOnly)).toBe(`/app/short-rent/properties/${PROPERTY_ID}?section=connection-health`);
  });

  it('todoActionRoute_RenewPoliceCredentials_OpensTheAlloggiatiDashboard', () => {
    expect(todoActionRoute(ofProperty('RenewPoliceCredentials'))).toBe('/app/short-rent/alloggiati');
  });

  it('todoActionRoute_DeclareTouristTax_OpensTheArchiveOnTheTaxDeclarationOfTheProperty', () => {
    expect(todoActionRoute(ofProperty('DeclareTouristTax', 'PropertyPeriod:2026-08'))).toBe(
      `/app/short-rent/alloggiati/reports?property=${PROPERTY_ID}&kind=TouristTaxDeclaration`,
    );
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
    expect(todoActionRoute(ofProperty('ActivateOctorateSend'), propertiesOnly)).toBe(`/app/short-rent/properties/${PROPERTY_ID}?section=connection-health`);
    expect(todoActionRoute(stay('SendAlloggiatiManually'), bookingsOnly)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`);
  });
});

describe('ACTION_ROUTE_MAP: the check-in link of a portal booking', () => {
  const item = { action: 'CopyCheckInLink', entityType: 'Booking', entityId: BOOKING_ID, propertyId: PROPERTY_ID as string | null };

  it('todoActionRoute_CopyCheckInLink_OpensTheGuestTabOfTheBooking', () => {
    expect(todoActionRoute(item)).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=guest`);
    expect(todoActionRoute(item, permissions(['booking.read']))).toBe(`/app/short-rent/bookings/${BOOKING_ID}?tab=guest`);
  });

  it('todoActionRoute_CopyCheckInLink_NeverOffersAPageThePersonCannotOpenOrTheIdOfSomethingThatIsNotABooking', () => {
    expect(todoActionRoute(item, permissions(['property.read']))).toBeNull();
    expect(todoActionRoute({ ...item, entityType: 'Property' })).toBeNull();
    expect(todoActionRoute({ ...item, entityId: NO_ID })).toBeNull();
  });
});

describe('ROUTE_MAP_BY_TYPE: the decision about a company tenant', () => {
  const item = { action: 'ReviewBooking', activityType: 'CompanyTenantDecision', entityType: 'Booking', entityId: BOOKING_ID, propertyId: PROPERTY_ID as string | null };

  it('todoActionRoute_CompanyTenantDecision_OpensTheDialogOfTheDecisionOnThePageOfTheWithholding', () => {
    expect(todoActionRoute(item)).toBe(`/app/account/withholding?decision=${BOOKING_ID}`);
    expect(todoActionRoute({ ...item, activityType: 'BookingSpecialRequest' })).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
  });

  it('todoActionRoute_CompanyTenantDecision_NeverOffersTheIdOfSomethingThatIsNotABookingOrNoId', () => {
    expect(todoActionRoute({ ...item, entityType: 'Property' })).toBeNull();
    expect(todoActionRoute({ ...item, entityId: NO_ID })).toBeNull();
  });

  const administrator =
    (granted: string[]) =>
    (contextKey: AppContextKey, permission: string): boolean =>
      permission === ORG_BILLING_ADMIN_PERMISSION || permissions(granted)(contextKey, permission);

  it('todoActionRoute_CompanyTenantDecision_OnlyTheAdministratorIsSentToThePageOfTheWithholding_AnyoneElseKeepsTheBooking', () => {
    expect(todoActionRoute(item, administrator([]))).toBe(`/app/account/withholding?decision=${BOOKING_ID}`);
    expect(todoActionRoute(item, administrator(['booking.read']))).toBe(`/app/account/withholding?decision=${BOOKING_ID}`);
    expect(todoActionRoute(item, permissions(['booking.read', 'property.read', 'property.write']))).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
    expect(todoActionRoute(item, permissions(['property.read']))).toBeNull();
  });
});

describe('ACTION_ROUTE_MAP: a scheduled message that needs a look', () => {
  const item = { action: 'FixScheduledMessage', entityType: 'Booking', entityId: BOOKING_ID, propertyId: PROPERTY_ID as string | null };

  it('todoActionRoute_FixScheduledMessage_OpensThePageOfTheBooking', () => {
    expect(todoActionRoute(item)).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
    expect(todoActionRoute(item, permissions(['booking.read']))).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
  });

  it('todoActionRoute_FixScheduledMessage_NeverOffersAPageThePersonCannotOpenOrTheIdOfSomethingThatIsNotABooking', () => {
    expect(todoActionRoute(item, permissions(['property.read']))).toBeNull();
    expect(todoActionRoute({ ...item, entityType: 'Property' })).toBeNull();
    expect(todoActionRoute({ ...item, entityId: NO_ID })).toBeNull();
  });
});

// FIX/FE-TD17-TODO (backend FIX/BE-TD17-ALERTS, `ActivityAction` 32): a self-billed invoice (TD17) the SDI rejected, or the drafts of a month to check and issue. Both items are about the organization (no property) and the server
// lists them only to who holds `agency.invoice.manage`. «Fallo ora» opens the page of the self-billed invoices, the page of the organization billing administrator, which has no read-only twin to fall back on.
describe('ACTION_ROUTE_MAP: the self-billed invoices (TD17)', () => {
  const ORGANIZATION_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const rejected = { action: 'ReviewSelfBilling', activityType: 'SelfBillingRejected', entityType: 'FiscalDocument', entityId: DOCUMENT_ID, propertyId: null as string | null };
  const drafts = { action: 'ReviewSelfBilling', activityType: 'SelfBillingDraftsToReview', entityType: 'SelfBillingPeriod:2026-10', entityId: ORGANIZATION_ID, propertyId: null as string | null };

  const workspaceOf =
    (contexts: ContextBootstrapDto[]): PermissionPredicate =>
    (contextKey, permission) => {
      const context = contexts.find((candidate) => candidate.contextKey === contextKey);
      if (!context) return false;
      if (permission === ORG_BILLING_ADMIN_PERMISSION) return isOrgBillingAdmin(contexts);
      return context.permissions.includes(permission);
    };
  const EVERYTHING_OF_THE_HOST_AREA = ['property.read', 'property.write', 'booking.read', 'booking.write', 'payment.read', 'payment.write'];

  it('todoActionRoute_ReviewSelfBilling_TheOwnerAndTheAdministratorsOfTheOrganizationAreSentToThePageOfTheSelfBilledInvoices', () => {
    expect(todoActionRoute(rejected)).toBe('/app/account/self-billing');
    expect(todoActionRoute(drafts)).toBe('/app/account/self-billing');
    for (const roleKey of ['org_owner', 'org_admin']) {
      const person = workspaceOf([contextOf('account', roleKey)]);

      expect(todoActionRoute(rejected, person), roleKey).toBe('/app/account/self-billing');
      expect(todoActionRoute(drafts, person), roleKey).toBe('/app/account/self-billing');
    }
  });

  it('todoActionRoute_ReviewSelfBilling_WhoCannotOpenThePageIsOfferedNoButtonAndNoOtherPage', () => {
    for (const roleKey of MEMBER_ROLE_KEYS) {
      const member = workspaceOf([contextOf('account', roleKey), contextOf('short-rent', roleKey, EVERYTHING_OF_THE_HOST_AREA)]);

      expect(todoActionRoute(rejected, member), roleKey).toBeNull();
      expect(todoActionRoute(drafts, member), roleKey).toBeNull();
    }
    const rentalOwnerOnly = workspaceOf([contextOf('short-rent', 'property_owner', EVERYTHING_OF_THE_HOST_AREA)]);

    expect(todoActionRoute(rejected, rentalOwnerOnly)).toBeNull();
    expect(todoActionRoute(drafts, rentalOwnerOnly)).toBeNull();
  });
});

// E13/F01/US02/T02: the owner could not be told by e-mail that a statement was published (`ActivityAction` 50, `ReviewOwnerStatement`, type `OwnerStatementNoticeFailed`). The item is about the version of the
// statement and «Fallo ora» opens that statement in the Amministrazione. The page is the one of the organization administrator (`orgBillingAdmin`): the test of a person is the one of the workspace, made from the
// memberships they hold, so a role that is not the administrator's is never sent to a page that would tell it to ask one.
describe('ACTION_ROUTE_MAP: the owner who could not be told that a statement was published', () => {
  const VERSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const item = { action: 'ReviewOwnerStatement', activityType: 'OwnerStatementNoticeFailed', entityType: 'OwnerStatementVersion', entityId: VERSION_ID, propertyId: null as string | null };
  const statement = `/app/account/owner-close/versions/${VERSION_ID}`;

  const workspaceOf =
    (contexts: ContextBootstrapDto[]) =>
    (contextKey: AppContextKey, permission: string): boolean => {
      const context = contexts.find((candidate) => candidate.contextKey === contextKey);
      if (!context) return false;
      if (!permission) return true;
      if (permission === ORG_BILLING_ADMIN_PERMISSION) return isOrgBillingAdmin(contexts);
      return context.permissions.includes(permission);
    };
  const HOST_PERMISSIONS = ['booking.read', 'property.read', 'property.write', 'payment.read'];

  it('todoActionRoute_ReviewOwnerStatement_OpensTheStatementOfTheVersionTheItemIsAbout', () => {
    expect(todoActionRoute(item)).toBe(statement);
  });

  it.each(['org_owner', 'org_admin'])('todoActionRoute_ReviewOwnerStatement_TheAdministrator_%s_IsSentToTheStatement', (roleKey) => {
    expect(todoActionRoute(item, workspaceOf([contextOf('account', roleKey), contextOf('short-rent', 'property_manager', HOST_PERMISSIONS)]))).toBe(statement);
  });

  it.each([
    ['a property manager with every permission of the host', [contextOf('short-rent', 'property_manager', HOST_PERMISSIONS)]],
    ['a member of the account that is not its administrator', [contextOf('account', 'org_member'), contextOf('short-rent', 'property_manager', HOST_PERMISSIONS)]],
    ['a person with no membership', []],
  ])('todoActionRoute_ReviewOwnerStatement_%s_IsOfferedNoButton', (_who, contexts) => {
    expect(todoActionRoute(item, workspaceOf(contexts))).toBeNull();
  });

  it('todoActionRoute_ReviewOwnerStatement_AnItemThatIsNotAboutAStatement_NeverNamesOne', () => {
    expect(todoActionRoute({ ...item, entityType: 'Booking' })).toBeNull();
    expect(todoActionRoute({ ...item, entityId: NO_ID })).toBeNull();
  });
});

// E14/F01/US02/T01 (NF-114, ⚖ I13): a cleaning recharged to an owner at its cost has no VAT stated. The item carries `ReviewBooking` and is about the stay of the cleaning (the page of the stay lists its cleaning request) or,
// for a cleaning with no stay, about the request itself. No page of the app states the VAT or the amount of a cleaning yet, so the type has no route of its own: it keeps what its action gives (the stay, for who may open it)
// and nothing is added or changed.
describe('ACTION_ROUTE_MAP: the cleaning recharge with no VAT stated', () => {
  const REQUEST_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const item = { action: 'ReviewBooking', activityType: 'CleaningVatToState', entityType: 'Booking', entityId: BOOKING_ID, propertyId: PROPERTY_ID as string | null };

  it('todoActionRoute_CleaningVatToState_OnlyWhoMayReadTheBookingsIsSentToTheStay', () => {
    expect(todoActionRoute(item)).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
    expect(todoActionRoute(item, permissions(['booking.read']))).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
    expect(todoActionRoute(item, permissions(['property.read', 'property.write', 'payment.read']))).toBeNull();
    expect(todoActionRoute(item, permissions([]))).toBeNull();
  });

  it('todoActionRoute_CleaningVatToState_AboutARequestWithNoStay_HasNoButtonAndNeverTakesItsIdForABooking', () => {
    const ofARequest = { ...item, entityType: 'ServiceRequest', entityId: REQUEST_ID };

    expect(todoActionRoute(ofARequest)).toBeNull();
    expect(todoActionRoute(ofARequest, permissions(['booking.read', 'property.read']))).toBeNull();
    expect(todoActionRoute({ ...item, entityId: NO_ID })).toBeNull();
  });
});

// FIX/FE-CLEANING-VAT-QUESTION (backend FIX/BE-CLEANING-VAT, `ActivityAction` 140, `StateCleaningVat`): a cleaning recharged to an owner at its cost whose VAT nobody stated. The item is about the cleaning request
// (`ServiceRequest`) and «Fallo ora» opens the page of that request in the interventions with the question «La ditta di pulizie ha applicato l'IVA su questa fattura?» over it (`?cleaningVat=<request>`). The page is read
// with `property.read` and the question is answered with `property.write` (what the endpoint asks): the button is for the roles that write the properties, and a role that only reads them is offered nothing.
describe('ACTION_ROUTE_MAP: the question of the VAT of a cleaning (StateCleaningVat)', () => {
  const REQUEST_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const item = { action: 'StateCleaningVat', activityType: 'CleaningVatToState', entityType: 'ServiceRequest', entityId: REQUEST_ID, propertyId: PROPERTY_ID as string | null };
  const question = `/app/short-rent/interventions/${REQUEST_ID}?cleaningVat=${REQUEST_ID}`;

  it('todoActionRoute_StateCleaningVat_OpensTheQuestionOnThePageOfTheRequest', () => {
    expect(todoActionRoute(item)).toBe(question);
    expect(todoActionRoute({ ...item, propertyId: null })).toBe(question);
    expect(manifestEntryOf(question).entry?.path).toBe('/app/short-rent/interventions/:id');
  });

  it.each(SHORT_RENT_ROLE_KEYS)('todoActionRoute_StateCleaningVat_TheButtonFollowsThePermissionToWriteThePropertiesOfTheRole_%s', (roleKey) => {
    const mayWrite = (SHORT_RENT_ROLE_PERMISSIONS[roleKey] as readonly string[]).includes('property.write');

    expect(todoActionRoute(item, workspacePredicateOf(hostContextsOf(roleKey)))).toBe(mayWrite ? question : null);
  });

  it.each(['staff', 'accountant'] as const)('todoActionRoute_StateCleaningVat_TheRole_%s_CanReadThePageOfTheRequestButIsOfferedNoButtonAndNoOtherPage', (roleKey) => {
    const person = workspacePredicateOf(hostContextsOf(roleKey));

    expect(person('short-rent', 'property.read')).toBe(true);
    expect(manifestEntryOf(question).entry?.requiredPermissions).toEqual(['property.read']);
    expect(person('short-rent', 'property.write')).toBe(false);
    expect(todoActionRoute(item, person)).toBeNull();
  });

  it('todoActionRoute_StateCleaningVat_APersonWhoHoldsNoMembershipOfTheAreaIsOfferedNoButton', () => {
    expect(todoActionRoute(item, workspacePredicateOf([]))).toBeNull();
    expect(todoActionRoute(item, workspacePredicateOf([contextOf('long-rent', 'property_manager', ['property.read', 'property.write'])]))).toBeNull();
  });

  it('todoActionRoute_StateCleaningVat_NeverTakesTheIdOfSomethingThatIsNotARequest', () => {
    expect(todoActionRoute({ ...item, entityType: 'Booking' })).toBeNull();
    expect(todoActionRoute({ ...item, entityType: 'Property', entityId: PROPERTY_ID })).toBeNull();
    expect(todoActionRoute({ ...item, entityId: NO_ID })).toBeNull();
  });

  it('todoActionRoute_TheItemsOfBefore_ReviewBookingOfTheSameType_KeepTheButtonOfTheirOwnAction', () => {
    const before = { ...item, action: 'ReviewBooking', entityType: 'Booking', entityId: BOOKING_ID };

    expect(todoActionRoute(before)).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
    expect(todoActionRoute(before, workspacePredicateOf(hostContextsOf('property_manager')))).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
  });
});

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
  'CorrectInvoice',
  'ReviewSelfBilling',
  'ReviewOwnerStay',
  'RenewOwnerDocument',
  'ReviewOwnerStatement',
  'CopyCheckInLink',
  'FixScheduledMessage',
  'StateCleaningVat',
  'ReviewImportedProperty',
] as const;

const ACTIONS_WITHOUT_A_PAGE_YET: readonly string[] = ['ConfirmChannelMapping', 'ReviewOwnerStay', 'RenewOwnerDocument', 'EnterMunicipalityTaxRate'];

describe('ACTION_ROUTE_MAP and the actions of the backend', () => {
  it.each(BACKEND_ACTIONS)('actionRouteMap_BackendAction_%s_HasAnEntryOrIsInTheListOfThoseWithoutAPageYet', (action) => {
    expect(Object.hasOwn(ACTION_ROUTE_MAP, action), action).toBe(!ACTIONS_WITHOUT_A_PAGE_YET.includes(action));
  });

  it('todoActionRoute_ImportedListing_OpensItsWizardOrReadOnlyProperty', () => {
    const item = itemFor('CheckImportedListing', { entityType: 'Property', entityId: PROPERTY_ID });
    expect(todoActionRoute(item, permissions(['property.write']))).toBe(`/app/short-rent/properties/create?propertyId=${PROPERTY_ID}`);
    expect(todoActionRoute(item, permissions(['property.read']))).toBe(`/app/short-rent/properties/${PROPERTY_ID}`);
    expect(todoActionRoute(item, permissions([]))).toBeNull();
  });

  it('actionRouteMap_EveryEntry_IsAnActionOfTheBackend', () => {
    expect(Object.keys(ACTION_ROUTE_MAP).filter((action) => !(BACKEND_ACTIONS as readonly string[]).includes(action))).toEqual([]);
  });

  it.each(ACTIONS_WITHOUT_A_PAGE_YET)('todoActionRoute_%s_WithoutAPageYet_OffersNoButtonAndNeverADeadOne', (action) => {
    expect(todoActionRoute(itemFor(action))).toBeNull();
  });
});
