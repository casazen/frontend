import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import type {
  Booking,
  BookingChangeOptions,
  BookingEditLock,
  BookingEditSettlement,
  BookingStatus,
  OctorateVersion,
  UpdateBookingDto,
} from '@/types';
import { stayDateOf } from './booking-price';

const OTA_CHANGE_NOT_ALLOWED = 'ota_booking_change_not_allowed';
const OTA_CANCEL_NOT_ALLOWED = 'ota_booking_cancel_not_allowed';

export type ChannelAction = 'modify' | 'cancel';

const CANCELLABLE_STATUSES: readonly BookingStatus[] = ['Pending', 'Confirmed', 'CheckedIn'];

export function bookingCanEdit(booking: Pick<Booking, 'canEdit' | 'changeOptions'>): boolean {
  return (booking.changeOptions?.canEdit ?? booking.canEdit?.allowed) === true;
}

export function bookingCanCancel(booking: Pick<Booking, 'status' | 'changeOptions'>): boolean {
  return booking.changeOptions?.canCancel ?? CANCELLABLE_STATUSES.includes(booking.status);
}

export function stayLockOf(booking: Pick<Booking, 'canEdit' | 'changeOptions'>): BookingEditLock | null {
  return bookingCanEdit(booking) ? null : (booking.canEdit?.reason ?? 'SourceLocked');
}

/**
 * The channel a booking must be changed or cancelled on when CasaZen does not do it (E08/F03/US02): the booking came from a channel through the channel manager
 * and the API says that channel is closed for `action`. Then there is a sentence that says how to ask the guest or the channel, and no form and no cancel button.
 * `null` for every other booking, and for an action the host may do here: a booking that cannot be changed because it has started or is cancelled is not one of these.
 */
export function channelGuidanceOf(
  options: BookingChangeOptions | undefined,
  action: ChannelAction,
): { channel: string } | null {
  const channel = options?.channel;
  if (!options || !channel) return null;

  if (action === 'modify') {
    return !options.canEdit && options.reasonCode === OTA_CHANGE_NOT_ALLOWED && options.guidanceKey ? { channel } : null;
  }
  return !options.canCancel && options.cancelReasonCode === OTA_CANCEL_NOT_ALLOWED && options.cancelGuidanceKey ? { channel } : null;
}

export function stayChanged(booking: Pick<Booking, 'checkInDate' | 'checkOutDate' | 'numberOfGuests' | 'numberOfChildren'>, change: UpdateBookingDto): boolean {
  return (
    stayDateOf(booking.checkInDate) !== change.checkInDate ||
    stayDateOf(booking.checkOutDate) !== change.checkOutDate ||
    booking.numberOfGuests !== change.numberOfGuests ||
    (booking.numberOfChildren ?? 0) !== (change.numberOfChildren ?? 0)
  );
}

export function settlementHasMoney(settlement: BookingEditSettlement | undefined): boolean {
  return !!settlement && (settlement.action !== 'none' || settlement.offlineRefundDue > 0);
}

export type StayChange = Required<Pick<UpdateBookingDto, 'checkInDate' | 'checkOutDate' | 'numberOfGuests' | 'numberOfChildren' | 'specialRequests'>>;

/**
 * The stay of the channel manager as a form takes it, for the host who chooses its version after a conflict: its dates and its number of guests, the other fields of
 * the booking as they are. The minors stay as many as they were unless they would be all the guests. `null` when the channel manager did not keep its dates or its guests:
 * there is nothing to put in the form. The server takes a stay as the channel manager's own only when the version says the dates AND the guests (a stay with the guests of
 * the booking in their place would be a change like any other, and conflict again), so a version that does not is not offered.
 */
export function channelVersionChange(
  booking: Pick<Booking, 'numberOfGuests' | 'numberOfChildren' | 'specialRequests'>,
  version: OctorateVersion | null | undefined,
): StayChange | null {
  if (!version?.checkIn || !version.checkOut || version.guests == null || version.guests < 1) return null;

  const guests = version.guests;
  return {
    checkInDate: stayDateOf(version.checkIn),
    checkOutDate: stayDateOf(version.checkOut),
    numberOfGuests: guests,
    numberOfChildren: Math.min(booking.numberOfChildren ?? 0, Math.max(guests - 1, 0)),
    specialRequests: booking.specialRequests ?? '',
  };
}

export type ChannelRefusalCode = 'ota_booking_cancel_not_allowed' | 'octorate_cancel_failed' | 'octorate_unavailable';

export interface ChannelRefusal {
  code: ChannelRefusalCode;
  channel: string | null;
}

export function channelRefusalOf(error: unknown): ChannelRefusal | null {
  if (!isAxiosError(error) || !error.response) return null;

  const { status, data } = error.response;
  const code = getProblemCode(data);
  const refused =
    (status === 422 && (code === 'ota_booking_cancel_not_allowed' || code === 'octorate_cancel_failed')) ||
    (status === 503 && code === 'octorate_unavailable');
  if (!refused || !code) return null;

  const channel = typeof data === 'object' && data !== null && 'channel' in data && typeof data.channel === 'string' ? data.channel : null;
  return { code: code as ChannelRefusalCode, channel };
}
