import { parseDateRange, type ListState } from '@/components/shared/list-view/list-state';
import type { ListSort } from '@/components/shared/list-view/list-types';
import type { BookingFilterParams, BookingListParams, BookingListView } from '@/types';

export const BOOKINGS_PATH = '/app/short-rent/bookings';

export const BOOKINGS_PAGE_SIZE = 20;

export const DEFAULT_BOOKING_CHIP: BookingListView = 'upcoming';

export const CHECK_IN_CHOICES = ['done', 'waiting', 'toSend'] as const;
const CHECK_IN_STATES: Record<string, string> = { done: 'Completed', waiting: 'Sent,InProgress', toSend: 'NotSent,Expired' };

const SORT_KEYS: Record<string, string> = { guest: 'guest', dates: 'checkIn', status: 'status', total: 'total' };

export function bookingFilterParams(state: Pick<ListState, 'q' | 'filters'>): BookingFilterParams {
  const { from, to } = parseDateRange(state.filters.arrival ?? '');
  return {
    q: state.q.trim() || undefined,
    propertyId: state.filters.property || undefined,
    channel: state.filters.channel || undefined,
    origin: state.filters.origin || undefined,
    checkInStatus: CHECK_IN_STATES[state.filters.checkin ?? ''],
    arrivalFrom: from,
    arrivalTo: to,
  };
}

function bookingSort(sort: ListSort | null, view: BookingListView): string {
  const key = sort ? SORT_KEYS[sort.id] : undefined;
  if (sort && key) return `${key}:${sort.direction}`;
  return view === 'upcoming' || view === 'inProgress' || view === 'toConfirm' ? 'checkIn:asc' : 'checkIn:desc';
}

export function bookingListParams(state: ListState): BookingListParams {
  const view = state.chip as BookingListView;
  return { ...bookingFilterParams(state), view, sort: bookingSort(state.sort, view), page: state.page, pageSize: BOOKINGS_PAGE_SIZE };
}

const LEGACY_STATUS_CHIPS: Record<string, BookingListView> = {
  all: 'all',
  Pending: 'toConfirm',
  Confirmed: 'upcoming',
  CheckedIn: 'inProgress',
  CheckedOut: 'completed',
  Cancelled: 'cancelled',
};

export function currentBookingsSearch(address: URLSearchParams): URLSearchParams | null {
  const status = address.get('status');
  const propertyId = address.get('propertyId');
  if (status === null && propertyId === null) return null;

  const next = new URLSearchParams(address);
  next.delete('status');
  next.delete('propertyId');
  const chip = status ? LEGACY_STATUS_CHIPS[status] : propertyId ? 'all' : undefined;
  if (chip && !next.has('chip')) next.set('chip', chip);
  if (propertyId && !next.has('f_property')) next.set('f_property', propertyId);
  return next;
}
