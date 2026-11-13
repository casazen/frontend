import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { Booking, BookingChangeOptions } from '@/types';
import {
  bookingCanCancel,
  bookingCanEdit,
  channelGuidanceOf,
  channelRefusalOf,
  channelVersionChange,
  settlementHasMoney,
  stayChanged,
  stayLockOf,
} from './booking-change';

/** What the API answers for a booking of a channel whose channel is closed for the change and for the cancellation. */
const closedChannel: BookingChangeOptions = {
  canEdit: false,
  canCancel: false,
  reasonCode: 'ota_booking_change_not_allowed',
  guidanceKey: 'OtaChannelModifyGuidanceBookingCom',
  channel: 'BookingCom',
  cancelReasonCode: 'ota_booking_cancel_not_allowed',
  cancelGuidanceKey: 'OtaChannelCancelGuidanceBookingCom',
};

describe('bookingCanEdit', () => {
  it('bookingCanEdit_ChangeOptionsSayNo_WinsOverTheOlderCanEdit', () => {
    expect(bookingCanEdit({ canEdit: { allowed: true, reason: null }, changeOptions: closedChannel })).toBe(false);
  });

  it('bookingCanEdit_OnlyTheOlderCanEdit_IsRead', () => {
    expect(bookingCanEdit({ canEdit: { allowed: true, reason: null } })).toBe(true);
    expect(bookingCanEdit({ canEdit: { allowed: false, reason: 'Started' } })).toBe(false);
  });

  it('bookingCanEdit_TheApiSaysNothing_IsNotOfferedForChange', () => {
    expect(bookingCanEdit({})).toBe(false);
  });
});

describe('bookingCanCancel', () => {
  it('bookingCanCancel_ChannelClosed_IsFalseWhateverTheStatus', () => {
    expect(bookingCanCancel({ status: 'Confirmed', changeOptions: closedChannel })).toBe(false);
  });

  it('bookingCanCancel_ChannelOpen_IsTrue', () => {
    expect(bookingCanCancel({ status: 'Confirmed', changeOptions: { ...closedChannel, canCancel: true, cancelReasonCode: null } })).toBe(true);
  });

  it.each([
    ['Pending', true],
    ['Confirmed', true],
    ['CheckedIn', true],
    ['CheckedOut', false],
    ['Cancelled', false],
  ] as const)('bookingCanCancel_NoChangeOptions_ReadsTheStatus_%s', (status, expected) => {
    expect(bookingCanCancel({ status })).toBe(expected);
  });
});

describe('stayLockOf', () => {
  it('stayLockOf_Editable_IsNull', () => {
    expect(stayLockOf({ changeOptions: { canEdit: true, canCancel: true } })).toBeNull();
  });

  it.each(['Cancelled', 'Started', 'SourceLocked'] as const)('stayLockOf_NotEditable_GivesTheReasonOfTheApi_%s', (reason) => {
    expect(stayLockOf({ canEdit: { allowed: false, reason } })).toBe(reason);
  });

  it('stayLockOf_NotEditableWithNoReason_IsTheSourceLock', () => {
    expect(stayLockOf({ changeOptions: { canEdit: false, canCancel: true } })).toBe('SourceLocked');
  });
});

describe('channelGuidanceOf', () => {
  it('channelGuidanceOf_ChannelClosedForTheChange_NamesTheChannel', () => {
    expect(channelGuidanceOf(closedChannel, 'modify')).toEqual({ channel: 'BookingCom' });
  });

  it('channelGuidanceOf_ChannelClosedForTheCancellation_NamesTheChannel', () => {
    expect(channelGuidanceOf(closedChannel, 'cancel')).toEqual({ channel: 'BookingCom' });
  });

  it('channelGuidanceOf_ChannelOpenForTheCancellation_HasNoSentenceForIt', () => {
    expect(channelGuidanceOf({ ...closedChannel, canCancel: true, cancelReasonCode: null, cancelGuidanceKey: null }, 'cancel')).toBeNull();
  });

  it('channelGuidanceOf_OpenChannelThatLocksTheStay_HasNoSentenceAndShowsTheForm', () => {
    // An open channel keeps `canEdit` false (price and payment are settled there) but the API accepts the notes: the form, not a sentence.
    const open: BookingChangeOptions = { ...closedChannel, reasonCode: 'booking_update_source_locked', guidanceKey: 'OtaChannelModifyGuidanceBookingCom' };
    expect(channelGuidanceOf(open, 'modify')).toBeNull();
  });

  it('channelGuidanceOf_CancelledBookingOfAChannel_HasNoSentence', () => {
    const cancelled: BookingChangeOptions = {
      canEdit: false,
      canCancel: false,
      reasonCode: 'booking_not_editable',
      guidanceKey: null,
      channel: 'Airbnb',
      cancelReasonCode: 'booking_already_cancelled',
      cancelGuidanceKey: null,
    };
    expect(channelGuidanceOf(cancelled, 'modify')).toBeNull();
    expect(channelGuidanceOf(cancelled, 'cancel')).toBeNull();
  });

  it('channelGuidanceOf_BookingOfTheHost_HasNoChannel', () => {
    expect(channelGuidanceOf({ canEdit: true, canCancel: true, channel: null }, 'modify')).toBeNull();
    expect(channelGuidanceOf(undefined, 'cancel')).toBeNull();
  });
});

describe('stayChanged', () => {
  const booking: Pick<Booking, 'checkInDate' | 'checkOutDate' | 'numberOfGuests' | 'numberOfChildren'> = {
    checkInDate: '2027-10-01T00:00:00Z',
    checkOutDate: '2027-10-05T00:00:00Z',
    numberOfGuests: 3,
    numberOfChildren: 1,
  };
  const same = { checkInDate: '2027-10-01', checkOutDate: '2027-10-05', numberOfGuests: 3, numberOfChildren: 1, specialRequests: 'Culla' };

  it('stayChanged_OnlyTheNotes_IsFalse', () => {
    expect(stayChanged(booking, same)).toBe(false);
  });

  it('stayChanged_AgesOfTheMinorsOnly_IsFalseAsForTheServer', () => {
    expect(stayChanged(booking, { ...same, childrenAges: [4] })).toBe(false);
  });

  it.each([
    ['check-in', { checkInDate: '2027-10-02' }],
    ['check-out', { checkOutDate: '2027-10-06' }],
    ['guests', { numberOfGuests: 4 }],
    ['minors', { numberOfChildren: 0 }],
  ])('stayChanged_%s_IsTrue', (_name, change) => {
    expect(stayChanged(booking, { ...same, ...change })).toBe(true);
  });
});

describe('settlementHasMoney', () => {
  it('settlementHasMoney_NoMoneyAndNothingOwed_IsFalse', () => {
    expect(settlementHasMoney(undefined)).toBe(false);
    expect(settlementHasMoney({ action: 'none', state: 'none', amount: 0, offlineRefundDue: 0, currency: 'EUR' })).toBe(false);
  });

  it('settlementHasMoney_AnAction_IsTrue', () => {
    expect(settlementHasMoney({ action: 'refund', state: 'pending', amount: 70, offlineRefundDue: 0, currency: 'EUR' })).toBe(true);
  });

  it('settlementHasMoney_OnlyWhatTheHostGivesBack_IsTrue', () => {
    expect(settlementHasMoney({ action: 'none', state: 'none', amount: 0, offlineRefundDue: 30, currency: 'EUR' })).toBe(true);
  });
});

describe('channelVersionChange', () => {
  const booking = { numberOfGuests: 4, numberOfChildren: 2, specialRequests: 'Culla' };

  it('channelVersionChange_DatesAndGuestsKept_GivesThemAsTheFormTakesThem', () => {
    const version = { checkIn: '2027-10-03T00:00:00Z', checkOut: '2027-10-08T00:00:00Z', guests: 3 };
    expect(channelVersionChange(booking, version)).toEqual({
      checkInDate: '2027-10-03',
      checkOutDate: '2027-10-08',
      numberOfGuests: 3,
      numberOfChildren: 2,
      specialRequests: 'Culla',
    });
  });

  it('channelVersionChange_MinorsWouldBeAllTheGuests_LeavesOneAdult', () => {
    const version = { checkIn: '2027-10-03T00:00:00Z', checkOut: '2027-10-08T00:00:00Z', guests: 2 };
    expect(channelVersionChange({ ...booking, numberOfChildren: 3 }, version)?.numberOfChildren).toBe(1);
  });

  it('channelVersionChange_GuestsNotKept_KeepsTheGuestsOfTheBooking', () => {
    const version = { checkIn: '2027-10-03T00:00:00Z', checkOut: '2027-10-08T00:00:00Z', guests: null };
    expect(channelVersionChange(booking, version)?.numberOfGuests).toBe(4);
  });

  it('channelVersionChange_DatesNotKept_IsNullBecauseThereIsNothingToPutInTheForm', () => {
    expect(channelVersionChange(booking, { checkIn: null, checkOut: '2027-10-08T00:00:00Z', guests: 3 })).toBeNull();
    expect(channelVersionChange(booking, undefined)).toBeNull();
  });
});

function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

describe('channelRefusalOf', () => {
  it.each([
    [422, 'ota_booking_cancel_not_allowed'],
    [422, 'octorate_cancel_failed'],
    [503, 'octorate_unavailable'],
  ])('channelRefusalOf_%i_%s_IsARefusalThatLeavesTheBookingAsItWas', (status, code) => {
    expect(channelRefusalOf(problem(status, { status, code, channel: 'BookingCom' }))).toEqual({ code, channel: 'BookingCom' });
  });

  it('channelRefusalOf_ProblemWithNoChannel_HasNoChannel', () => {
    expect(channelRefusalOf(problem(422, { status: 422, code: 'octorate_cancel_failed' }))?.channel).toBeNull();
  });

  it('channelRefusalOf_TheRequestIsKeptOutOfTheFailure_StillReadsTheAnswer', () => {
    // The mutation keeps the failure without the request that was sent (`withoutRequest`): the status and the body of the answer stay.
    const kept = withoutRequest(problem(503, { status: 503, code: 'octorate_unavailable', channel: 'Airbnb' }));
    expect(channelRefusalOf(kept)).toEqual({ code: 'octorate_unavailable', channel: 'Airbnb' });
  });

  it.each([
    [409, 'booking_already_cancelled'],
    [422, 'booking_not_cancellable'],
    [503, 'payment_provider_error'],
    [500, 'octorate_unavailable'],
    [422, 'octorate_unavailable'],
  ])('channelRefusalOf_%i_%s_IsNotOne', (status, code) => {
    expect(channelRefusalOf(problem(status, { status, code }))).toBeNull();
  });

  it('channelRefusalOf_NotAnAnswerOfTheApi_IsNotOne', () => {
    expect(channelRefusalOf(new Error('boom'))).toBeNull();
    expect(channelRefusalOf(undefined)).toBeNull();
    expect(channelRefusalOf(new AxiosError('Network Error', AxiosError.ERR_NETWORK))).toBeNull();
  });
});
