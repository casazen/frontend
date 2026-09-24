import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { Booking } from '@/types';
import { orderStaysForRequest, stayOptionLabel } from '../stays';

function stay(id: string, checkIn: string, checkOut: string, status: Booking['status'] = 'Confirmed'): Booking {
  return {
    id,
    checkInDate: `${checkIn}T00:00:00Z`,
    checkOutDate: `${checkOut}T00:00:00Z`,
    status,
    guest: { firstName: 'Anna', lastName: 'Verdi', email: '', phone: '', country: 'IT' },
  } as Booking;
}

describe('orderStaysForRequest', () => {
  it('orderStaysForRequest_MixedStays_CurrentAndUpcomingFirstThenPastWithoutCancelled', () => {
    const ordered = orderStaysForRequest(
      [
        stay('past-old', '2026-01-01', '2026-01-04'),
        stay('upcoming', '2026-10-01', '2026-10-03'),
        stay('cancelled', '2026-09-30', '2026-10-02', 'Cancelled'),
        stay('in-house', '2026-09-20', '2026-09-26'),
        stay('past-recent', '2026-09-01', '2026-09-10'),
      ],
      '2026-09-24',
    );

    expect(ordered.map((b) => b.id)).toEqual(['in-house', 'upcoming', 'past-recent', 'past-old']);
  });

  it('orderStaysForRequest_CheckOutToday_IsStillCurrent', () => {
    const ordered = orderStaysForRequest(
      [stay('leaving-today', '2026-09-20', '2026-09-24'), stay('yesterday', '2026-09-18', '2026-09-23')],
      '2026-09-24',
    );

    expect(ordered.map((b) => b.id)).toEqual(['leaving-today', 'yesterday']);
  });
});

describe('stayOptionLabel', () => {
  it('stayOptionLabel_Stay_ShowsGuestAndStayDatesWithoutTimeZoneShift', () => {
    const label = stayOptionLabel(stay('b', '2026-10-01', '2026-10-05'), i18n.getFixedT('it'), 'it');

    expect(label).toBe('Anna Verdi · 1 ottobre 2026 → 5 ottobre 2026');
  });
});
