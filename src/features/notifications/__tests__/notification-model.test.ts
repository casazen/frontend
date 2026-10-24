import { describe, expect, it } from 'vitest';
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
      'new-booking', 'guest-message', 'guest-data-missing', 'alloggiati-deadline', 'alloggiati-overdue', 'alloggiati-failed',
      'checkout-reminder', 'ota-stay-review', 'service-request-created', 'service-request-auto-accepted', 'service-request-taken',
      'service-request-completed', 'service-request-rejected', 'service-request-paid', 'service-request-started',
      'service-request-cancelled', 'service-request-reminder', 'service-request-time-proposed',
      'service-request-proposal-accepted', 'service-request-proposal-rejected', 'service-request-rescheduled',
      'booking-request', 'booking-cancelled-by-guest', 'deferred-charge-failed', 'deferred-charge-cancelled',
      'property-mode-change-scheduled', 'property-mode-change-applied', 'property-mode-change-failed',
      'property-compliance-suspended', 'cin-deadline', 'rent-payment-received',
      'service-payment-requested', 'service-payment-failed', 'service-payment-received', 'service-payment-refunded',
      'service-payment-offline-recorded',
    ];
    expect([...KNOWN_NOTIFICATION_TYPES].sort()).toEqual([...backend].sort());
    for (const type of backend) expect(notificationKind(type).textKey, type).not.toBe('notifications.types.generic');
  });

  it('notificationRoute_GuestMessage_OpensTheBookingOnItsMessages', () => {
    expect(notificationRoute({ type: 'guest-message', entityId: 'b-1' }, 'short-rent')).toBe('/app/short-rent/bookings/b-1?tab=messages');
  });

  it.each([
    ['new-booking', '/app/short-rent/bookings/b-1'],
    ['checkout-reminder', '/app/short-rent/bookings/b-1'],
    ['guest-data-missing', '/app/short-rent/bookings/b-1?tab=guest'],
    ['alloggiati-failed', '/app/short-rent/bookings/b-1?tab=alloggiati'],
  ])('notificationRoute_%s_OpensTheBooking', (type, expected) => {
    expect(notificationRoute({ type, entityId: 'b-1' }, 'short-rent')).toBe(expected);
  });

  it('notificationRoute_ServiceRequest_GoesToTheInboxForASupplierAndToTheMarketplaceForAHost', () => {
    expect(notificationRoute({ type: 'service-request-created', entityId: 'sr-1' }, 'supplier')).toBe('/app/supplier/inbox/sr-1');
    expect(notificationRoute({ type: 'service-request-taken', entityId: 'sr-1' }, 'short-rent')).toBe('/app/short-rent/marketplace');
    expect(notificationRoute({ type: 'service-request-taken', entityId: 'sr-1' }, 'long-rent')).toBe('/app/short-rent/marketplace');
  });

  it.each([
    ['booking-request', '/app/short-rent/bookings/e-1'],
    ['booking-cancelled-by-guest', '/app/short-rent/bookings/e-1'],
    ['deferred-charge-failed', '/app/short-rent/bookings/e-1?tab=payment'],
    ['deferred-charge-cancelled', '/app/short-rent/bookings/e-1?tab=payment'],
    ['property-compliance-suspended', '/app/short-rent/properties/e-1/activation'],
    ['cin-deadline', '/app/short-rent/properties/e-1/activation'],
    ['rent-payment-received', '/app/long-rent/properties/e-1'],
    ['property-mode-change-scheduled', '/app/short-rent/properties/e-1'],
    ['property-mode-change-failed', '/app/short-rent/properties/e-1'],
  ])('notificationRoute_%s_ResolvesToAnExistingScreen', (type, expected) => {
    expect(notificationRoute({ type, entityId: 'e-1' }, 'short-rent')).toBe(expected);
  });

  it('notificationRoute_PropertyModeChangeFromLongRent_StaysInLongRent', () => {
    expect(notificationRoute({ type: 'property-mode-change-applied', entityId: 'e-1' }, 'long-rent')).toBe('/app/long-rent/properties/e-1');
  });

  it.each([
    'service-payment-requested', 'service-payment-failed', 'service-payment-refunded', 'service-payment-offline-recorded',
  ])('notificationRoute_%s_GoesToTheMarketplaceForAHost', (type) => {
    expect(notificationRoute({ type, entityId: 'sr-1' }, 'short-rent')).toBe('/app/short-rent/marketplace');
  });

  it.each(['service-payment-received', 'service-payment-refunded'])('notificationRoute_%s_OpensTheRequestInTheSupplierInbox', (type) => {
    expect(notificationRoute({ type, entityId: 'sr-1' }, 'supplier')).toBe('/app/supplier/inbox/sr-1');
  });

  it('notificationRoute_UnknownTypeOrNoEntity_GoesNowhere', () => {
    expect(notificationRoute({ type: 'from-the-future', entityId: 'x' }, 'short-rent')).toBeNull();
    expect(notificationRoute({ type: 'guest-message', entityId: null }, 'short-rent')).toBeNull();
  });

  it('badgeText_Above99_Is99Plus', () => {
    expect([1, 99, 100, 250].map(badgeText)).toEqual(['1', '99', '99+', '99+']);
  });
});
