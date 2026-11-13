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

/**
 * Code of the API for a booking of a channel that is changed on its channel and not from CasaZen (`changeOptions.reasonCode`, and the 422 of `PUT /bookings/:id`):
 * the channel is closed for the change. The cancellation has its own (`ota_booking_cancel_not_allowed`).
 */
const OTA_CHANGE_NOT_ALLOWED = 'ota_booking_change_not_allowed';
const OTA_CANCEL_NOT_ALLOWED = 'ota_booking_cancel_not_allowed';

/** What the host asks of the guest or of the channel: to change the stay, or to cancel it. */
export type ChannelAction = 'modify' | 'cancel';

const CANCELLABLE_STATUSES: readonly BookingStatus[] = ['Pending', 'Confirmed', 'CheckedIn'];

/**
 * Whether the host may change the dates and the guests of the booking. The API says it (`changeOptions`, and `canEdit` before it): the page keeps no rule of its
 * own, and an answer that says nothing is a booking that is not offered for change.
 */
export function bookingCanEdit(booking: Pick<Booking, 'canEdit' | 'changeOptions'>): boolean {
  return (booking.changeOptions?.canEdit ?? booking.canEdit?.allowed) === true;
}

/**
 * Whether the host may cancel the booking. The API says it (`changeOptions`), and it knows what the status does not: a booking of a channel is cancelled only where
 * the channel lets the host do it. An answer that carries no `changeOptions` (a booking an older action answers with) is read by its status, as it always was.
 */
export function bookingCanCancel(booking: Pick<Booking, 'status' | 'changeOptions'>): boolean {
  return booking.changeOptions?.canCancel ?? CANCELLABLE_STATUSES.includes(booking.status);
}

/**
 * Why the dates and the guests of the booking cannot be changed, for the form that still offers the notes (`Started`, `SourceLocked`) or the page that says there
 * is nothing to change (`Cancelled`); `null` when they can be changed.
 */
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

/**
 * Whether the change moves the stay: other dates or other guests. The server prices again (and moves money) only then, as it counts the adults and the minors and not
 * their ages; a change of the notes alone has no money to read before it.
 */
export function stayChanged(booking: Pick<Booking, 'checkInDate' | 'checkOutDate' | 'numberOfGuests' | 'numberOfChildren'>, change: UpdateBookingDto): boolean {
  return (
    stayDateOf(booking.checkInDate) !== change.checkInDate ||
    stayDateOf(booking.checkOutDate) !== change.checkOutDate ||
    booking.numberOfGuests !== change.numberOfGuests ||
    (booking.numberOfChildren ?? 0) !== (change.numberOfChildren ?? 0)
  );
}

/** Whether a saved edit has something to say about the money: a payment that moved, or an overpayment the host gives back. */
export function settlementHasMoney(settlement: BookingEditSettlement | undefined): boolean {
  return !!settlement && (settlement.action !== 'none' || settlement.offlineRefundDue > 0);
}

/** Dates, guests and notes, every one given: what a form opens with. */
export type StayChange = Required<Pick<UpdateBookingDto, 'checkInDate' | 'checkOutDate' | 'numberOfGuests' | 'numberOfChildren' | 'specialRequests'>>;

/**
 * The stay of the channel manager as a form takes it, for the host who chooses its version after a conflict: its dates and its number of guests, the other fields of
 * the booking as they are. The minors stay as many as they were unless they would be all the guests. `null` when the channel manager did not keep its dates: there is
 * nothing to put in the form.
 */
export function channelVersionChange(
  booking: Pick<Booking, 'numberOfGuests' | 'numberOfChildren' | 'specialRequests'>,
  version: OctorateVersion | null | undefined,
): StayChange | null {
  if (!version?.checkIn || !version.checkOut) return null;

  const guests = version.guests ?? booking.numberOfGuests;
  return {
    checkInDate: stayDateOf(version.checkIn),
    checkOutDate: stayDateOf(version.checkOut),
    numberOfGuests: guests,
    numberOfChildren: Math.min(booking.numberOfChildren ?? 0, Math.max(guests - 1, 0)),
    specialRequests: booking.specialRequests ?? '',
  };
}

/** The answers of the API that leave a booking of a channel as it was when the host asks to cancel it (NF-76). */
export type ChannelRefusalCode = 'ota_booking_cancel_not_allowed' | 'octorate_cancel_failed' | 'octorate_unavailable';

/** Why the channel did not cancel the booking: the code of the API, and the channel it names. */
export interface ChannelRefusal {
  code: ChannelRefusalCode;
  channel: string | null;
}

/**
 * Whether a failed cancellation is one of the three that leave a booking of a channel unchanged (E08/F02/US02, NF-76): 422 `ota_booking_cancel_not_allowed` (the channel is
 * closed), 422 `octorate_cancel_failed` (the channel manager refused) and 503 `octorate_unavailable` (it did not answer). The problem carries the `channel`; the dialog says
 * the booking is unchanged and gives the one sentence that says how to ask the guest or the channel. `null` for any other failure: those say what they say.
 */
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
