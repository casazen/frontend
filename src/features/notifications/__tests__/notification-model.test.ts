import { describe, expect, it } from 'vitest';
import { ONBOARDING_ROUTES } from '@/config/onboarding-routes';
import en from '@/i18n/locales/en.json';
import it_ from '@/i18n/locales/it.json';
import { KNOWN_NOTIFICATION_TYPES, badgeText, notificationKind, notificationRoute } from '../notification-model';

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
      // E20/F03/US01/T02: the host reopened a request support closed («Non funziona»), and support closed one of the host's (verified, or declared).
      'assist-reopened', 'assist-verified', 'assist-declared',
    ];
    for (const type of backend) expect(notificationKind(type).textKey, type).not.toBe('notifications.types.generic');
  });

  it('notificationRoute_GuestMessage_OpensTheBookingOnItsMessages', () => {
    expect(notificationRoute({ type: 'guest-message', entityId: 'b-1' }, 'short-rent')).toBe('/app/short-rent/bookings/b-1?tab=messages');
  });

  it.each([
    ['new-booking', '/app/short-rent/bookings/b-1'],
    ['checkout-reminder', '/app/short-rent/bookings/b-1'],
    ['guest-data-missing', '/app/short-rent/bookings/b-1?tab=guest'],
    ['guest-checkin-completed', '/app/short-rent/bookings/b-1?tab=guest'],
    ['alloggiati-failed', '/app/short-rent/bookings/b-1?tab=alloggiati'],
  ])('notificationRoute_%s_OpensTheBooking', (type, expected) => {
    expect(notificationRoute({ type, entityId: 'b-1' }, 'short-rent')).toBe(expected);
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
