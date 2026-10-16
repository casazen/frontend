import { parseDateRange, type ListState } from '@/components/shared/list-view/list-state';
import type { ListSort } from '@/components/shared/list-view/list-types';
import type { BookingFilterParams, BookingListParams, BookingListView } from '@/types';

/** The page of the list of bookings. */
export const BOOKINGS_PATH = '/app/short-rent/bookings';

/** Bookings in a page of the list. */
export const BOOKINGS_PAGE_SIZE = 20;

/** The chip the list starts from: what is coming. The ids of the chips are the names of the views of the API. */
export const DEFAULT_BOOKING_CHIP: BookingListView = 'upcoming';

/** The choices of the "Check-in online" filter, and the states of the link (`checkInStatus` of the API) each one stands for. */
export const CHECK_IN_CHOICES = ['done', 'waiting', 'toSend'] as const;
const CHECK_IN_STATES: Record<string, string> = { done: 'Completed', waiting: 'Sent,InProgress', toSend: 'NotSent,Expired' };

/** The columns the API orders by (`sort` of `GET /api/bookings/search`), by the id of the column. */
const SORT_KEYS: Record<string, string> = { guest: 'guest', dates: 'checkIn', status: 'status', total: 'total' };

/** The filters of the state of the list as the API takes them: for the rows and for the counters of the chips. */
export function bookingFilterParams(state: Pick<ListState, 'q' | 'filters'>): BookingFilterParams {
  const { from, to } = parseDateRange(state.filters.arrival ?? '');
  return {
    q: state.q.trim() || undefined,
    propertyId: state.filters.property || undefined,
    channel: state.filters.channel || undefined,
    checkInStatus: CHECK_IN_STATES[state.filters.checkin ?? ''],
    arrivalFrom: from,
    arrivalTo: to,
  };
}

/**
 * The order of the rows. What the person chose; without a choice, what is still to come is shown the nearest first and what is
 * over the latest first (a list that opens on "Tutte" must not start from the oldest stay).
 */
function bookingSort(sort: ListSort | null, view: BookingListView): string {
  const key = sort ? SORT_KEYS[sort.id] : undefined;
  if (sort && key) return `${key}:${sort.direction}`;
  return view === 'upcoming' || view === 'inProgress' || view === 'toConfirm' ? 'checkIn:asc' : 'checkIn:desc';
}

/** What the state of the list asks of `GET /api/bookings/search`. */
export function bookingListParams(state: ListState): BookingListParams {
  const view = state.chip as BookingListView;
  return { ...bookingFilterParams(state), view, sort: bookingSort(state.sort, view), page: state.page, pageSize: BOOKINGS_PAGE_SIZE };
}

/** The chip an old address (`?status=Confirmed`, the tabs of the list before the redesign) stands for. */
const LEGACY_STATUS_CHIPS: Record<string, BookingListView> = {
  all: 'all',
  Pending: 'toConfirm',
  Confirmed: 'upcoming',
  CheckedIn: 'inProgress',
  CheckedOut: 'completed',
  Cancelled: 'cancelled',
};

/**
 * An address of the old list (`?status=` and `?propertyId=`, which the pages of a property and the way back from a booking may
 * still carry) as the address of this one (`?chip=` and `?f_property=`), or null when it has neither. What the address already
 * says of the new list is kept.
 */
export function currentBookingsSearch(address: URLSearchParams): URLSearchParams | null {
  const status = address.get('status');
  const propertyId = address.get('propertyId');
  if (status === null && propertyId === null) return null;

  const next = new URLSearchParams(address);
  next.delete('status');
  next.delete('propertyId');
  // The old list opened on every status: with a property and no status, "Tutte" is the chip that says the same.
  const chip = status ? LEGACY_STATUS_CHIPS[status] : propertyId ? 'all' : undefined;
  if (chip && !next.has('chip')) next.set('chip', chip);
  if (propertyId && !next.has('f_property')) next.set('f_property', propertyId);
  return next;
}
