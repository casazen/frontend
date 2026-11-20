import { describe, expect, it } from 'vitest';
import { ONBOARDING_ROUTES } from '@/config/onboarding-routes';
import type { AppContextKey } from '@/config/route-manifest';
import en from '@/i18n/locales/en.json';
import it_ from '@/i18n/locales/it.json';
import { KNOWN_NOTIFICATION_TYPES, badgeText, notificationKind, notificationRoute } from '../notification-model';

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

function lookup(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree);
}

describe('notification model', () => {
  it('notificationKind_EveryKnownType_HasASentenceInBothLanguages', () => {
    for (const type of [...KNOWN_NOTIFICATION_TYPES, 'something-new']) {
      const { textKey } = notificationKind(type);
      expect(typeof lookup(it_, textKey), `it ${textKey}`).toBe('string');
      expect(typeof lookup(en, textKey), `en ${textKey}`).toBe('string');
    }
  });

  it('notificationKind_UnknownType_IsTheGenericSentence', () => {
    expect(notificationKind('from-the-future').textKey).toBe('notifications.types.generic');
  });

  it('notificationKind_BackendPushTypes_AreAllKnown', () => {
    const backend = [
      'new-booking', 'guest-message', 'guest-checkin-completed', 'guest-data-missing', 'alloggiati-deadline', 'alloggiati-overdue',
      'alloggiati-failed', 'checkout-reminder', 'ota-stay-review', 'service-request-created', 'service-request-auto-accepted', 'service-request-taken',
      'service-request-completed', 'service-request-rejected', 'service-request-paid', 'service-request-started',
      'service-request-cancelled', 'service-request-reminder', 'service-request-time-proposed',
      'service-request-proposal-accepted', 'service-request-proposal-rejected', 'service-request-rescheduled',
      'service-request-quote-sent', 'service-request-quote-accepted', 'service-request-quote-rejected', 'service-request-quote-expired',
      'service-request-day-before', 'service-payment-received',
      'service-request-backup-invited', 'service-request-backup-active', 'service-request-backup-won', 'service-request-backup-closed',
      // E03/F04/US02/T03: a guest handed the verification of the identity to a person.
      'verification-required',
      // E10/F03/US03/T03: a host asked CasaZen support to do a step («Fallo per me»).
      'assist-requested',
      // E23/F01/US01/T01: the check-in link of a stay from a portal did not reach the guest.
      'checkin-link-failed',
      // E20/F03/US01/T02: the host reopened a request support closed («Non funziona»), and support closed one of the host's (verified, or declared).
      'assist-reopened', 'assist-verified', 'assist-declared',
      // E05/F06/US02: a guest left a review on a channel, and a reply or the host's own review did not reach it.
      'ota-review-received', 'ota-review-action-failed',
      // E05/F07/US01: a scheduled message of a booking was held back, failed, skipped or sent outside the send window.
      'scheduled-message-issue',
      // E30/F02/US03/T01: the 24 hours of the notification of a Ticino arrival day to the cantonal police, and the declaration of a day (`PushTypes.IsTicinoNotification`).
      'ticino-notification-due', 'ticino-notification-overdue', 'ticino-notification-declared',
      // E40/F02/US02 (`be-auth0-host-sync`): the domain of the agency was verified, and the sign-in of the owners on it became active or failed.
      'domain-verified', 'owner-login-ready', 'owner-login-failed',
    ];
    for (const type of backend) expect(notificationKind(type).textKey, type).not.toBe('notifications.types.generic');
  });

  // E40/F02/US02: the entity of these pushes is the ORG and the click opens the domain settings of the booking site, which the route manifest registers; an entry without entity opens nothing.
  it.each([
    ['domain-verified', 'domainVerified', /verificato/i, /verified/i],
    ['owner-login-ready', 'ownerLoginReady', /proprietari/i, /owner/i],
    ['owner-login-failed', 'ownerLoginFailed', /proprietari/i, /owner/i],
  ] as const)('notificationRoute_%s_OpensTheDomainSettingsWithItsOwnSentenceAndNamesNoSystem', (type, key, italian, english) => {
    expect(KNOWN_NOTIFICATION_TYPES).toContain(type);
    expect(notificationRoute({ type, entityId: 'org-1' }, 'short-rent')).toBe('/app/short-rent/settings/domain');
    expect(notificationRoute({ type, entityId: 'org-1' }, null)).toBe('/app/short-rent/settings/domain');
    expect(notificationRoute({ type, entityId: null }, 'short-rent')).toBeNull();
    expect(notificationKind(type).textKey).toBe(`notifications.types.${key}`);
    for (const [locale, pattern] of [[it_, italian], [en, english]] as const) {
      const sentence = String(lookup(locale, `notifications.types.${key}`));
      expect(sentence).toMatch(pattern);
      expect(sentence).not.toBe(lookup(locale, 'notifications.types.generic'));
      expect(sentence).not.toMatch(/auth0|octorate|vercel|kross|concordato\s*facile/i);
    }
  });

  it('notificationRoute_GuestMessage_OpensTheBookingOnItsMessages', () => {
    expect(notificationRoute({ type: 'guest-message', entityId: 'b-1' }, 'short-rent')).toBe('/app/short-rent/bookings/b-1?tab=messages');
  });

  it.each([
    ['new-booking', '/app/short-rent/bookings/b-1'],
    ['checkout-reminder', '/app/short-rent/bookings/b-1'],
    ['guest-data-missing', '/app/short-rent/bookings/b-1?tab=guest'],
    ['guest-checkin-completed', '/app/short-rent/bookings/b-1?tab=guest'],
    // The guest tab is where the panel of the link says why it did not arrive and has «Copia link».
    ['checkin-link-failed', '/app/short-rent/bookings/b-1?tab=guest'],
    ['alloggiati-failed', '/app/short-rent/bookings/b-1?tab=alloggiati'],
  ])('notificationRoute_%s_OpensTheBooking', (type, expected) => {
    expect(notificationRoute({ type, entityId: 'b-1' }, 'short-rent')).toBe(expected);
  });

  it('notificationRoute_OtaReview_OpensTheBookingWhoseSectionRecensioniHoldsTheReviewsOfTheStay', () => {
    // The entity of both pushes is the booking; its page opens on the tab Soggiorno, where the section «Recensioni» is.
    for (const type of ['ota-review-received', 'ota-review-action-failed']) {
      expect(notificationRoute({ type, entityId: 'b-1' }, 'short-rent'), type).toBe('/app/short-rent/bookings/b-1');
      expect(notificationRoute({ type, entityId: null }, 'short-rent'), type).toBeNull();
    }
    expect(notificationKind('ota-review-received').textKey).toBe('notifications.types.otaReviewReceived');
    expect(notificationKind('ota-review-action-failed').textKey).toBe('notifications.types.otaReviewActionFailed');
    // Each says what happened in both languages, never the generic sentence, and never names the supplier of the channel manager.
    for (const key of ['otaReviewReceived', 'otaReviewActionFailed']) {
      for (const locale of [it_, en]) {
        const sentence = String(lookup(locale, `notifications.types.${key}`));
        expect(sentence).not.toBe(lookup(locale, 'notifications.types.generic'));
        expect(sentence).not.toMatch(/octorate/i);
      }
    }
  });

  it('notificationKind_CheckInLinkFailed_SaysItInBothLanguagesWithoutTheNameOfTheChannelManager', () => {
    expect(notificationKind('checkin-link-failed').textKey).toBe('notifications.types.checkinLinkFailed');
    for (const locale of [it_, en]) {
      const sentence = lookup(locale, 'notifications.types.checkinLinkFailed');
      expect(typeof sentence).toBe('string');
      expect(sentence as string).not.toMatch(/octorate/i);
    }
  });

  // E05/F07/US01 (NF-71): the push of a scheduled message that needs a look is for the people who reach the property; its entity is the booking, which opens on the tab Soggiorno with the timeline of its messages.
  it('notificationKind_ScheduledMessageIssue_SaysItInBothLanguagesWithoutTheNameOfAnySupplierAndOpensTheBooking', () => {
    expect(KNOWN_NOTIFICATION_TYPES).toContain('scheduled-message-issue');
    expect(notificationKind('scheduled-message-issue').textKey).toBe('notifications.types.scheduledMessageIssue');
    expect(notificationRoute({ type: 'scheduled-message-issue', entityId: 'b-1' }, 'short-rent')).toBe('/app/short-rent/bookings/b-1');
    expect(notificationRoute({ type: 'scheduled-message-issue', entityId: null }, 'short-rent')).toBeNull();
    for (const locale of [it_, en]) {
      const sentence = lookup(locale, 'notifications.types.scheduledMessageIssue');
      expect(typeof sentence).toBe('string');
      expect(sentence).not.toBe(lookup(locale, 'notifications.types.generic'));
      expect(sentence as string).not.toMatch(/octorate/i);
    }
  });

  // E30/F02/US03/T01 (NF-127): the push types of the backend are lower case with hyphens, and the entity of the bell entry is the PROPERTY (never the day): the click opens the layer of the Ticino notification of
  // that property over the cockpit, which opens on its first day still to notify.
  it.each([
    ['ticino-notification-due', 'ticinoNotificationDue'],
    ['ticino-notification-overdue', 'ticinoNotificationOverdue'],
    ['ticino-notification-declared', 'ticinoNotificationDeclared'],
  ])('notificationKind_%s_HasItsOwnSentenceInBothLanguagesAndNamesNoSupplier', (type, key) => {
    expect(KNOWN_NOTIFICATION_TYPES).toContain(type);
    expect(notificationKind(type).textKey).toBe(`notifications.types.${key}`);
    for (const locale of [it_, en]) {
      const sentence = lookup(locale, `notifications.types.${key}`);
      expect(typeof sentence).toBe('string');
      expect(sentence).not.toBe(lookup(locale, 'notifications.types.generic'));
      // The authority may be named; no supplier and no guest, no day, no value.
      expect(sentence as string).not.toMatch(/octorate|concordato\s*facile/i);
    }
    expect(lookup(it_, `notifications.types.${key}`)).toMatch(/polizia/i);
    expect(lookup(en, `notifications.types.${key}`)).toMatch(/police/i);
  });

  it.each(['ticino-notification-due', 'ticino-notification-overdue', 'ticino-notification-declared'])(
    'notificationRoute_%s_OpensTheLayerOfThePropertyOverTheCockpit',
    (type) => {
      expect(notificationRoute({ type, entityId: PROPERTY_ID }, 'short-rent')).toBe(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}`);
      // Whatever the area the person is in when it arrives.
      expect(notificationRoute({ type, entityId: PROPERTY_ID }, 'long-rent')).toBe(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}`);
      expect(notificationRoute({ type, entityId: null }, 'short-rent')).toBeNull();
    },
  );

  it('notificationRoute_TicinoNotification_WhoMayNotOpenTheCockpitGoesToThePageOfTheProperty', () => {
    const granted = (...keys: string[]) => (_context: AppContextKey, permission: string) => keys.includes(permission);

    const allowed = granted('property.read', 'booking.read');
    expect(notificationRoute({ type: 'ticino-notification-due', entityId: PROPERTY_ID }, 'short-rent', allowed)).toBe(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}`);
    // The cockpit asks both permissions (its route): a person who has one of them is led to the page of the property, as before the layer.
    for (const keys of [['property.read'], ['booking.read'], []]) {
      expect(notificationRoute({ type: 'ticino-notification-overdue', entityId: PROPERTY_ID }, 'short-rent', granted(...keys))).toBe(`/app/short-rent/properties/${PROPERTY_ID}`);
    }
  });

  it('notificationRoute_TicinoNotification_AnEntityThatIsNotAPropertyOfTheAddressOpensTheCockpitAlone', () => {
    // An id an address cannot hold (a path, a colon) never goes into `?detail=`: the cockpit opens and the bell keeps working.
    expect(notificationRoute({ type: 'ticino-notification-due', entityId: '../admin' }, 'short-rent')).toBe('/app/short-rent/compliance');
    expect(notificationRoute({ type: 'ticino-notification-due', entityId: 'a:b' }, 'short-rent')).toBe('/app/short-rent/compliance');
  });

  it('notificationRoute_VerificationRequired_OpensTheConsoleOfTheVerifications', () => {
    // The push is for the operators who decide the verifications: the bell leads them to the console, not to the booking.
    expect(notificationRoute({ type: 'verification-required', entityId: 'b-1' }, 'short-rent')).toBe('/app/short-rent/verifications');
    expect(notificationKind('verification-required').textKey).toBe('notifications.types.verificationRequired');
  });

  it('notificationRoute_AssistRequested_OpensTheStaffQueueOfTheRequestsWhateverTheContext', () => {
    // The push is for the platform administrators: the bell tells them that a host asked for help and leads them to the queue. Its entity is the request, never a booking.
    for (const context of ['admin', 'short-rent', null] as const) {
      expect(notificationRoute({ type: 'assist-requested', entityId: 'ar-1' }, context), String(context)).toBe('/app/admin/onboarding-assist');
    }
    // The address is the page of the staff queue that the routes of the onboarding register, so a click does not end on a page that does not exist.
    expect(ONBOARDING_ROUTES.find((route) => route.path === '/app/admin/onboarding-assist')?.context).toBe('admin');
    // The sentence is in both languages and names the action as the host's button does.
    expect(notificationKind('assist-requested').textKey).toBe('notifications.types.assistRequested');
    expect(lookup(it_, 'notifications.types.assistRequested')).toContain('«Fallo per me»');
    expect(lookup(en, 'notifications.types.assistRequested')).toContain('«Do it for me»');
  });

  it('notificationRoute_AssistOutcome_OpensThePlanOfTheActivationForTheHostAndTheQueueWhenTheHostReopens', () => {
    // The push of «Fatto» is for the administrators of the org: the entity is the request (no property, no person), so the click opens the plan, where the part shows where it stands.
    for (const type of ['assist-verified', 'assist-declared']) {
      expect(notificationRoute({ type, entityId: 'ar-1' }, 'short-rent'), type).toBe('/app/short-rent/onboarding');
    }
    expect(ONBOARDING_ROUTES.find((route) => route.path === '/app/short-rent/onboarding')?.context).toBe('short-rent');
    // «Non funziona» is for the platform staff: the queue, as for a new request.
    expect(notificationRoute({ type: 'assist-reopened', entityId: 'ar-1' }, 'admin')).toBe('/app/admin/onboarding-assist');
    // The sentences are in both languages, say what happened, and never name the supplier of the channel manager.
    for (const [type, key] of [['assist-verified', 'assistVerified'], ['assist-declared', 'assistDeclared'], ['assist-reopened', 'assistReopened']] as const) {
      expect(notificationKind(type).textKey).toBe(`notifications.types.${key}`);
      for (const locale of [it_, en]) expect(String(lookup(locale, `notifications.types.${key}`)), `${type}`).not.toMatch(/octorate/i);
    }
    expect(lookup(it_, 'notifications.types.assistDeclared')).toMatch(/dichiara/i);
    expect(lookup(it_, 'notifications.types.assistVerified')).toMatch(/verificato/i);
  });

  it('notificationKind_FiscalDocumentIssued_HasItsOwnSentenceInBothLanguagesAndOpensTheTabPagamentoOfTheBooking', () => {
    // The push of a document issued is for the hosts of the booking and its entity is the booking: the bell and the pop-up say what happened (not «Hai una nuova notifica») and a click opens the tab Pagamento,
    // where the card of the documents of the booking is, as for a document the SDI rejected.
    expect(KNOWN_NOTIFICATION_TYPES).toContain('fiscal-document-issued');
    expect(notificationKind('fiscal-document-issued').textKey).toBe('notifications.types.fiscalDocumentIssued');
    expect(notificationRoute({ type: 'fiscal-document-issued', entityId: 'b-1' }, 'short-rent')).toBe('/app/short-rent/bookings/b-1?tab=payment');
    expect(notificationRoute({ type: 'fiscal-document-issued', entityId: 'b-1' }, 'short-rent')).toBe(notificationRoute({ type: 'fiscal-document-sdi-rejected', entityId: 'b-1' }, 'short-rent'));
    expect(notificationRoute({ type: 'fiscal-document-issued', entityId: null }, 'short-rent')).toBeNull();
    // Each language has its own words, none is the generic sentence, and neither names the supplier of any channel.
    const [italian, english] = [it_, en].map((locale) => String(lookup(locale, 'notifications.types.fiscalDocumentIssued')));
    expect(italian).toMatch(/documento fiscale/i);
    expect(english).toMatch(/fiscal document/i);
    expect(italian).not.toBe(english);
    expect(italian).not.toBe(lookup(it_, 'notifications.types.generic'));
    expect(english).not.toBe(lookup(en, 'notifications.types.generic'));
    for (const text of [italian, english]) expect(text).not.toMatch(/octorate|concordato\s*facile/i);
  });

  it('notificationRoute_ServiceRequest_GoesToTheInboxForASupplierAndToMyAppsOfTheMarketplaceForAHost', () => {
    expect(notificationRoute({ type: 'service-request-created', entityId: 'sr-1' }, 'supplier')).toBe('/app/supplier/inbox/sr-1');
    expect(notificationRoute({ type: 'service-request-taken', entityId: 'sr-1' }, 'short-rent')).toBe('/app/short-rent/marketplace/mine');
    expect(notificationRoute({ type: 'service-request-taken', entityId: 'sr-1' }, 'long-rent')).toBe('/app/short-rent/marketplace/mine');
  });

  it('notificationRoute_UnknownTypeOrNoEntity_GoesNowhere', () => {
    expect(notificationRoute({ type: 'from-the-future', entityId: 'x' }, 'short-rent')).toBeNull();
    expect(notificationRoute({ type: 'guest-message', entityId: null }, 'short-rent')).toBeNull();
  });

  it('badgeText_Above99_Is99Plus', () => {
    expect([1, 99, 100, 250].map(badgeText)).toEqual(['1', '99', '99+', '99+']);
  });
});
