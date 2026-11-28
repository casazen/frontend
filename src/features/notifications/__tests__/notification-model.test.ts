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
      'verification-required',
      'assist-requested',
      'checkin-link-failed',
      'assist-reopened', 'assist-verified', 'assist-declared',
      'ota-review-received', 'ota-review-action-failed',
      'scheduled-message-issue',
      'ticino-notification-due', 'ticino-notification-overdue', 'ticino-notification-declared',
      'swiss-notification-due', 'swiss-notification-overdue', 'swiss-notification-declared',
      'domain-verified', 'owner-login-ready', 'owner-login-failed',
    ];
    for (const type of backend) expect(notificationKind(type).textKey, type).not.toBe('notifications.types.generic');
  });

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
    ['checkin-link-failed', '/app/short-rent/bookings/b-1?tab=guest'],
    ['alloggiati-failed', '/app/short-rent/bookings/b-1?tab=alloggiati'],
  ])('notificationRoute_%s_OpensTheBooking', (type, expected) => {
    expect(notificationRoute({ type, entityId: 'b-1' }, 'short-rent')).toBe(expected);
  });

  it('notificationRoute_OtaReview_OpensTheBookingWhoseSectionRecensioniHoldsTheReviewsOfTheStay', () => {
    for (const type of ['ota-review-received', 'ota-review-action-failed']) {
      expect(notificationRoute({ type, entityId: 'b-1' }, 'short-rent'), type).toBe('/app/short-rent/bookings/b-1');
      expect(notificationRoute({ type, entityId: null }, 'short-rent'), type).toBeNull();
    }
    expect(notificationKind('ota-review-received').textKey).toBe('notifications.types.otaReviewReceived');
    expect(notificationKind('ota-review-action-failed').textKey).toBe('notifications.types.otaReviewActionFailed');
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
      expect(sentence as string).not.toMatch(/octorate|concordato\s*facile/i);
    }
    expect(lookup(it_, `notifications.types.${key}`)).toMatch(/polizia/i);
    expect(lookup(en, `notifications.types.${key}`)).toMatch(/police/i);
  });

  it.each(['ticino-notification-due', 'ticino-notification-overdue', 'ticino-notification-declared'])(
    'notificationRoute_%s_OpensTheLayerOfThePropertyOverTheCockpit',
    (type) => {
      expect(notificationRoute({ type, entityId: PROPERTY_ID }, 'short-rent')).toBe(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}`);
      expect(notificationRoute({ type, entityId: PROPERTY_ID }, 'long-rent')).toBe(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}`);
      expect(notificationRoute({ type, entityId: null }, 'short-rent')).toBeNull();
    },
  );

  it('notificationRoute_TicinoNotification_WhoMayNotOpenTheCockpitGoesToThePageOfTheProperty', () => {
    const granted = (...keys: string[]) => (_context: AppContextKey, permission: string) => keys.includes(permission);

    const allowed = granted('property.read', 'booking.read');
    expect(notificationRoute({ type: 'ticino-notification-due', entityId: PROPERTY_ID }, 'short-rent', allowed)).toBe(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}`);
    for (const keys of [['property.read'], ['booking.read'], []]) {
      expect(notificationRoute({ type: 'ticino-notification-overdue', entityId: PROPERTY_ID }, 'short-rent', granted(...keys))).toBe(`/app/short-rent/properties/${PROPERTY_ID}`);
    }
  });

  it('notificationRoute_TicinoNotification_AnEntityThatIsNotAPropertyOfTheAddressOpensTheCockpitAlone', () => {
    expect(notificationRoute({ type: 'ticino-notification-due', entityId: '../admin' }, 'short-rent')).toBe('/app/short-rent/compliance');
    expect(notificationRoute({ type: 'ticino-notification-due', entityId: 'a:b' }, 'short-rent')).toBe('/app/short-rent/compliance');
  });

  it.each([
    ['swiss-notification-due', 'swissNotificationDue'],
    ['swiss-notification-overdue', 'swissNotificationOverdue'],
    ['swiss-notification-declared', 'swissNotificationDeclared'],
  ])('notificationKind_%s_HasItsOwnSentenceInBothLanguagesAndNamesNoSupplierNorGuest', (type, key) => {
    expect(KNOWN_NOTIFICATION_TYPES).toContain(type);
    expect(notificationKind(type).textKey).toBe(`notifications.types.${key}`);
    for (const locale of [it_, en]) {
      const sentence = lookup(locale, `notifications.types.${key}`);
      expect(typeof sentence).toBe('string');
      expect(sentence).not.toBe(lookup(locale, 'notifications.types.generic'));
      expect(sentence as string).not.toMatch(/hoko|unisys|u-stay|feratel|chekin|octorate|concordato\s*facile|\bavs\b/i);
    }
    expect(lookup(it_, `notifications.types.${key}`)).toMatch(/autorità/i);
    expect(lookup(en, `notifications.types.${key}`)).toMatch(/authority/i);
  });

  it.each(['swiss-notification-due', 'swiss-notification-overdue', 'swiss-notification-declared'])('notificationRoute_%s_OpensTheLayerOfTheAssistedNotificationOverTheCockpit', (type) => {
    expect(notificationRoute({ type, entityId: PROPERTY_ID }, 'short-rent')).toBe(`/app/short-rent/compliance?detail=swiss-notification:${PROPERTY_ID}`);
    expect(notificationRoute({ type, entityId: PROPERTY_ID }, 'long-rent')).toBe(`/app/short-rent/compliance?detail=swiss-notification:${PROPERTY_ID}`);
    expect(notificationRoute({ type, entityId: null }, 'short-rent')).toBeNull();
  });

  it('notificationRoute_SwissNotification_WhoMayNotOpenTheCockpitGoesToThePageOfThePropertyAndAnEntityThatIsNotAPropertyOpensTheCockpitAlone', () => {
    const granted = (...keys: string[]) => (_context: AppContextKey, permission: string) => keys.includes(permission);

    expect(notificationRoute({ type: 'swiss-notification-due', entityId: PROPERTY_ID }, 'short-rent', granted('property.read', 'booking.read'))).toBe(
      `/app/short-rent/compliance?detail=swiss-notification:${PROPERTY_ID}`,
    );
    for (const keys of [['property.read'], ['booking.read'], []]) {
      expect(notificationRoute({ type: 'swiss-notification-overdue', entityId: PROPERTY_ID }, 'short-rent', granted(...keys))).toBe(`/app/short-rent/properties/${PROPERTY_ID}`);
    }
    expect(notificationRoute({ type: 'swiss-notification-due', entityId: '../admin' }, 'short-rent')).toBe('/app/short-rent/compliance');
    expect(notificationRoute({ type: 'swiss-notification-due', entityId: 'a:b' }, 'short-rent')).toBe('/app/short-rent/compliance');
  });

  it('notificationRoute_VerificationRequired_OpensTheConsoleOfTheVerifications', () => {
    expect(notificationRoute({ type: 'verification-required', entityId: 'b-1' }, 'short-rent')).toBe('/app/short-rent/verifications');
    expect(notificationKind('verification-required').textKey).toBe('notifications.types.verificationRequired');
  });

  it('notificationRoute_AssistRequested_OpensTheStaffQueueOfTheRequestsWhateverTheContext', () => {
    for (const context of ['admin', 'short-rent', null] as const) {
      expect(notificationRoute({ type: 'assist-requested', entityId: 'ar-1' }, context), String(context)).toBe('/app/admin/onboarding-assist');
    }
    expect(ONBOARDING_ROUTES.find((route) => route.path === '/app/admin/onboarding-assist')?.context).toBe('admin');
    expect(notificationKind('assist-requested').textKey).toBe('notifications.types.assistRequested');
    expect(lookup(it_, 'notifications.types.assistRequested')).toContain('«Fallo per me»');
    expect(lookup(en, 'notifications.types.assistRequested')).toContain('«Do it for me»');
  });

  it('notificationRoute_AssistOutcome_OpensThePlanOfTheActivationForTheHostAndTheQueueWhenTheHostReopens', () => {
    for (const type of ['assist-verified', 'assist-declared']) {
      expect(notificationRoute({ type, entityId: 'ar-1' }, 'short-rent'), type).toBe('/app/short-rent/onboarding');
    }
    expect(ONBOARDING_ROUTES.find((route) => route.path === '/app/short-rent/onboarding')?.context).toBe('short-rent');
    expect(notificationRoute({ type: 'assist-reopened', entityId: 'ar-1' }, 'admin')).toBe('/app/admin/onboarding-assist');
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
