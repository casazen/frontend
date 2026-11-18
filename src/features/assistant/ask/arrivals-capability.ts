import { normalizeText } from '@/components/shared/command-palette/search';
import { isStayDate } from '@/lib/stay-dates';
import type { DashboardToday, DashboardTodayStay } from '@/types/dashboard.types';

/** This read reuses the server's BookingRead policy and HostScope. The client can only narrow the returned rows. */
export const arrivalsCapability = {
  id: 'arrivals.incompleteToday',
  interaction: 'read',
  area: 'short-rent',
  permission: 'booking.read',
  source: '/dashboard/today',
  timeZone: 'Europe/Rome',
} as const;

export type ArrivalCheckInState = NonNullable<DashboardTodayStay['checkIn']>['state'] | 'unknown';

interface ArrivalReference {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  state: ArrivalCheckInState;
}

export interface ArrivalsAnswer {
  day: string;
  propertyName?: string;
  scopedCount: number;
  rows: ArrivalReference[];
  partial: boolean;
}

export function manualArrivalsPath(propertyId: string | null) {
  const query = new URLSearchParams({ today: 'arrivals' });
  if (propertyId) query.set('propertyId', propertyId);
  return `/app/short-rent?${query}`;
}

// Admit only a supported read with a known scope. A different date, a named property or an
// instruction to send something must never be silently interpreted as the suggested question.
const supportedQuestions = new Set([
  'quali arrivi di oggi hanno il check in incompleto',
  'quali arrivi di oggi hanno il check in da completare',
  'arrivi da gestire',
  'arrivi di oggi da gestire',
  'check in incompleti di oggi',
  'which arrivals today have incomplete check in',
  'which of today s arrivals have incomplete check in',
  'which arrivals today have incomplete check ins',
  'today s incomplete check ins',
  'arrivals to manage',
]);

export function asksForIncompleteArrivals(question: string): boolean {
  return supportedQuestions.has(normalizeText(question).replace(/\bcheckin\b/g, 'check in'));
}

const knownStates: readonly ArrivalCheckInState[] = ['NotSent', 'Sent', 'Expired', 'InProgress', 'Completed'];

export function summarizeArrivals(data: DashboardToday, propertyId: string | null): ArrivalsAnswer {
  const list = data.arrivals;
  if (
    !isStayDate(data.today) ||
    !Array.isArray(list?.items) ||
    !Number.isInteger(list.count) ||
    list.count < list.items.length
  ) {
    throw new Error('Invalid arrivals response');
  }
  const rows: ArrivalReference[] = [];
  let partial = list.count > list.items.length;
  let propertyName: string | undefined;
  let scopedCount = 0;

  for (const stay of list.items) {
    if (!stay?.propertyId) {
      partial = true;
      continue;
    }
    if (propertyId && stay.propertyId !== propertyId) continue;
    scopedCount++;
    if (propertyId && stay.propertyName) propertyName = stay.propertyName;
    if (stay.status === 'CheckedIn' || stay.status === 'CheckedOut') continue;
    if (
      stay.status !== 'Confirmed' ||
      !stay.bookingId ||
      !stay.propertyName ||
      stay.checkInDate !== data.today ||
      !isStayDate(stay.checkOutDate)
    ) {
      partial = true;
      continue;
    }
    if (stay.checkIn?.dataComplete === true) continue;
    const state =
      stay.checkIn?.dataComplete === false && knownStates.includes(stay.checkIn.state) ? stay.checkIn.state : 'unknown';
    // No names, messages, financial data or guest records in the assistant result.
    rows.push({
      bookingId: stay.bookingId,
      propertyId: stay.propertyId,
      propertyName: stay.propertyName,
      checkInDate: stay.checkInDate,
      checkOutDate: stay.checkOutDate,
      state,
    });
  }
  return { day: data.today, rows, partial, scopedCount, propertyName };
}
