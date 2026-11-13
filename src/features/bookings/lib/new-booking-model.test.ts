import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { StayAvailability } from '@/types';
import {
  NEW_BOOKING_DRAFT_EXCLUDE,
  NEW_BOOKING_DRAFT_VERSION,
  NEW_BOOKING_STEP,
  PAYMENT_LINK_BLOCK_KEYS,
  channelManagerBlockedMessage,
  channelManagerConflict,
  channelManagerOf,
  checkedStayOf,
  emptyNewBooking,
  paymentLinkBlockOf,
  paymentStepSchemaFor,
  priceStepSchema,
  toManualBookingDto,
  type NewBookingValues,
} from './new-booking-model';

function values(changes: Partial<NewBookingValues> = {}): NewBookingValues {
  return {
    ...emptyNewBooking('property-1'),
    checkInDate: '2027-10-01',
    checkOutDate: '2027-10-05',
    guest: { name: 'Mario Rossi', email: 'mario.rossi@example.com', phone: '' },
    ...changes,
  };
}

function availability(changes: Partial<StayAvailability> = {}): StayAvailability {
  return {
    propertyId: 'property-1',
    from: '2027-10-01',
    to: '2027-10-05',
    state: 'ok',
    invalidReason: null,
    nights: 4,
    minNights: null,
    conflicts: [],
    nearestFreeWindow: null,
    linkableBlockId: null,
    ...changes,
  };
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

describe('the steps of the wizard (NF-74)', () => {
  it('NewBookingStep_Order_IsStayGuestPricePaymentSummary', () => {
    expect(Object.values(NEW_BOOKING_STEP)).toEqual(['stay', 'guest', 'price', 'payment', 'summary']);
  });

  it('NewBookingDraft_VersionIsBumped_SoADraftOfTheThreeStepsIsNotReadBack', () => {
    expect(NEW_BOOKING_DRAFT_VERSION).toBeGreaterThanOrEqual(3);
  });

  it('NewBookingDraft_ContactOfAThirdParty_StaysOutOfIt', () => {
    expect(NEW_BOOKING_DRAFT_EXCLUDE).toEqual(expect.arrayContaining(['guest.email', 'guest.phone']));
  });
});

describe('how the guest pays decides money: no default, always an explicit choice', () => {
  it('emptyNewBooking_PaymentArrangement_IsEmptyAndNotADefault', () => {
    expect(emptyNewBooking().paymentArrangement).toBe('');
  });

  it('paymentStepSchema_NothingChosen_AsksForAChoice', () => {
    const result = paymentStepSchemaFor(null).safeParse({ paymentArrangement: '' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('booking.validation.paymentArrangement.required');
  });

  it.each(['paymentLink', 'onSite', 'bankTransfer'])('paymentStepSchema_%s_IsAccepted', (arrangement) => {
    expect(paymentStepSchemaFor(null).safeParse({ paymentArrangement: arrangement }).success).toBe(true);
  });

  it('paymentStepSchema_AWayThatIsNotOneOfTheThree_IsRefused', () => {
    // `none` is a value of the API the client never sends: leaving the question unanswered is not a way of paying.
    expect(paymentStepSchemaFor(null).safeParse({ paymentArrangement: 'none' }).success).toBe(false);
  });

  it.each(['permission', 'account', 'nothingToPay'] as const)('paymentStepSchema_LinkWhileItIsBlockedBy_%s_IsRefusedWithItsReason', (block) => {
    const result = paymentStepSchemaFor(block).safeParse({ paymentArrangement: 'paymentLink' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(PAYMENT_LINK_BLOCK_KEYS[block]);
    expect(result.error?.issues[0]?.path).toEqual(['paymentArrangement']);
    // The reason is a text of both languages, not a key shown as it is.
    expect(i18n.exists(PAYMENT_LINK_BLOCK_KEYS[block], { lng: 'it' })).toBe(true);
    expect(i18n.exists(PAYMENT_LINK_BLOCK_KEYS[block], { lng: 'en' })).toBe(true);
  });

  it.each(['onSite', 'bankTransfer'])('paymentStepSchema_LinkBlocked_StillAccepts_%s', (arrangement) => {
    expect(paymentStepSchemaFor('account').safeParse({ paymentArrangement: arrangement }).success).toBe(true);
  });

  it.each([
    [{ canWritePayments: false, accountReady: true, agreed: null }, 'permission'],
    [{ canWritePayments: true, accountReady: false, agreed: null }, 'account'],
    [{ canWritePayments: true, accountReady: true, agreed: 0 }, 'nothingToPay'],
    // Not known yet (loading, or unreadable): offered, and the API checks before it writes anything.
    [{ canWritePayments: true, accountReady: null, agreed: null }, null],
    [{ canWritePayments: true, accountReady: true, agreed: null }, null],
    [{ canWritePayments: true, accountReady: true, agreed: 450 }, null],
  ] as const)('paymentLinkBlockOf_%j_Is_%s', (input, expected) => {
    expect(paymentLinkBlockOf(input)).toBe(expected);
  });

  it('paymentLinkBlockOf_NoPermission_WinsOverTheOtherReasons', () => {
    expect(paymentLinkBlockOf({ canWritePayments: false, accountReady: false, agreed: 0 })).toBe('permission');
  });
});

describe('the booking as the API takes it', () => {
  it.each(['paymentLink', 'onSite', 'bankTransfer'] as const)('toManualBookingDto_PaymentArrangement_%s_IsSent', (arrangement) => {
    expect(toManualBookingDto(values({ paymentArrangement: arrangement }))).toMatchObject({ paymentArrangement: arrangement });
  });

  it('toManualBookingDto_NothingChosen_SendsNoArrangementAtAll', () => {
    expect(toManualBookingDto(values())).not.toHaveProperty('paymentArrangement');
  });

  it('toManualBookingDto_PortalReservationCompleted_SendsNoWayOfPaying', () => {
    // The portal collects: a payment link is refused for a block (422) and the other ways are not recorded.
    const dto = toManualBookingDto(
      values({
        paymentArrangement: 'paymentLink',
        linkedBlock: { blockId: 'block-1', channel: 'Airbnb', propertyId: 'property-1', checkInDate: '2027-10-01', checkOutDate: '2027-10-05' },
      }),
    );

    expect(dto.blockId).toBe('block-1');
    expect(dto).not.toHaveProperty('paymentArrangement');
  });

  it('toManualBookingDto_TotalTypedAsZero_IsSentAsZeroNotDropped', () => {
    expect(toManualBookingDto(values({ totalPrice: '0', paymentArrangement: 'onSite' })).totalPrice).toBe(0);
  });
});

describe('the price step', () => {
  it('priceStepSchema_AnAmountThatIsNotOne_IsRefused', () => {
    expect(priceStepSchema.safeParse({ totalPrice: '45 euro', priceNote: '' }).success).toBe(false);
  });

  it('priceStepSchema_NothingTyped_MeansThePriceOfTheQuote', () => {
    expect(priceStepSchema.safeParse({ totalPrice: '', priceNote: '' }).success).toBe(true);
  });
});

describe('the channel manager, as the availability says it', () => {
  it.each([
    [null, false],
    [true, true],
    [false, true],
    [undefined, false],
  ] as const)('checkedStayOf_ChannelManagerChecked_%s_PropertyMirrored_%s', (checked, mirrored) => {
    expect(checkedStayOf(values(), availability({ channelManagerChecked: checked })).mirrored).toBe(mirrored);
  });

  it('channelManagerOf_SameStay_TellsWhetherThePropertyIsMirrored', () => {
    const checked = checkedStayOf(values(), availability({ channelManagerChecked: true }));

    expect(channelManagerOf(checked, values())).toBe(true);
  });

  it('channelManagerOf_AnotherPropertyOrOtherDates_IsNotKnown', () => {
    const checked = checkedStayOf(values(), availability({ channelManagerChecked: true }));

    expect(channelManagerOf(checked, values({ propertyId: 'property-2' }))).toBeNull();
    expect(channelManagerOf(checked, values({ checkOutDate: '2027-10-06' }))).toBeNull();
    expect(channelManagerOf(null, values())).toBeNull();
  });

  it('channelManagerOf_PortalReservation_IsNotMirrored', () => {
    // A reservation of a portal completed by the host is a booking of that portal: it is not pushed to the channel manager.
    const checked = checkedStayOf(values(), availability({ channelManagerChecked: true }));
    const linked = values({
      linkedBlock: { blockId: 'block-1', channel: 'Airbnb', propertyId: 'property-1', checkInDate: '2027-10-01', checkOutDate: '2027-10-05' },
    });

    expect(channelManagerOf(checked, linked)).toBe(false);
  });

  it('channelManagerConflict_FindsOnlyTheOneOfTheChannelManager', () => {
    const own = { id: 'b-1', type: 'booking' as const, title: 'Anna', channel: null, from: '2027-10-01', to: '2027-10-03' };
    const remote = { id: '00000000-0000-0000-0000-000000000000', type: 'channelManager' as const, title: null, channel: null, from: '2027-10-01', to: '2027-10-05' };

    expect(channelManagerConflict({ conflicts: [own] })).toBeUndefined();
    expect(channelManagerConflict({ conflicts: [own, remote] })).toBe(remote);
  });

  it('channelManagerBlockedMessage_NamesTheChannelOnlyWhenTheApiDoes', () => {
    expect(channelManagerBlockedMessage({ title: 'Booking.com' }, i18n.t)).toContain('Booking.com');
    expect(channelManagerBlockedMessage({ title: null }, i18n.t)).toBe(i18n.t('booking.create.availability.channelManagerBlocked'));
    expect(channelManagerBlockedMessage({ title: '  ' }, i18n.t)).toBe(i18n.t('booking.create.availability.channelManagerBlocked'));
  });
});
