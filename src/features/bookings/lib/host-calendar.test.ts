import { describe, expect, it } from 'vitest';
import { toStayDate } from '@/lib/stay-dates';
import { withBrowserTimeZone } from '@/test/clock';
import type { CalendarItemDto } from '@/types/calendar.types';
import { hostCalendarRange, toHostCalendarEvents } from './host-calendar';

function item(overrides: Partial<CalendarItemDto>): CalendarItemDto {
  return {
    type: 'booking',
    id: 'b1',
    propertyId: 'p1',
    startDate: '2026-09-30T00:00:00',
    endDate: '2026-10-02T00:00:00',
    startDateUtc: '2026-09-30T00:00:00Z',
    endDateUtc: '2026-10-02T00:00:00Z',
    status: 'Confirmed',
    guestName: 'Mario Rossi',
    ...overrides,
  };
}

describe('hostCalendarRange', () => {
  it('hostCalendarRange_MonthView_ReturnsFirstAndLastDayOfTheMonth', () => {
    expect(hostCalendarRange('month', '2026-10-17')).toEqual({ startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(hostCalendarRange('month', '2028-02-10')).toEqual({ startDate: '2028-02-01', endDate: '2028-02-29' });
  });

  it('hostCalendarRange_WeekViewAcrossMonths_ReturnsMondayToSunday', () => {
    // Wednesday 30 September 2026: its week goes from Monday 28 September to Sunday 4 October.
    expect(hostCalendarRange('week', '2026-09-30')).toEqual({ startDate: '2026-09-28', endDate: '2026-10-04' });
    // A Sunday belongs to the week that started the Monday before.
    expect(hostCalendarRange('week', '2026-10-04')).toEqual({ startDate: '2026-09-28', endDate: '2026-10-04' });
  });

  it('hostCalendarRange_DayView_ReturnsTheDayItself', () => {
    expect(hostCalendarRange('day', '2026-09-30')).toEqual({ startDate: '2026-09-30', endDate: '2026-09-30' });
  });
});

describe('toHostCalendarEvents', () => {
  describe.each(['Europe/Rome', 'America/Los_Angeles', 'Pacific/Kiritimati'])('in %s', (timeZone) => {
    withBrowserTimeZone(timeZone);

    it('toHostCalendarEvents_ArrivalOn30SeptemberWithoutTimeZone_StartsOnThe30thAndCoversTheNights', () => {
      const [event] = toHostCalendarEvents([item({})]);

      expect(toStayDate(event.start)).toBe('2026-09-30');
      expect(event.start.getHours()).toBe(0);
      // The bar ends at the local midnight of the departure day (exclusive): nights of the 30th and of the 1st.
      expect(toStayDate(event.end)).toBe('2026-10-02');
      expect(event).toMatchObject({ arrival: '2026-09-30', departure: '2026-10-02', nights: 2, allDay: true });
    });
  });

  it('toHostCalendarEvents_Booking_KeepsStatusAndGuest', () => {
    const [event] = toHostCalendarEvents([item({ status: 'Pending', guestName: '  Anna Bianchi ' })]);

    expect(event).toMatchObject({ kind: 'booking', id: 'b1', status: 'Pending', guestName: 'Anna Bianchi' });
  });

  it('toHostCalendarEvents_IcalBlock_IsABlockWithChannelAndFeedLabel', () => {
    const [event] = toHostCalendarEvents([
      item({ type: 'ical-block', id: 'blk', channel: 'BookingCom', feedLabel: 'Booking - camera 2', summary: 'CLOSED', guestName: null, status: null }),
    ]);

    expect(event).toMatchObject({
      kind: 'block',
      id: 'blk',
      channel: 'BookingCom',
      feedLabel: 'Booking - camera 2',
      summary: 'CLOSED',
    });
  });

  it('toHostCalendarEvents_UnknownTypeOrChannel_IsABlockWithoutChannel', () => {
    const [event] = toHostCalendarEvents([item({ type: 'manual-block', channel: 'Vrbo' })]);

    expect(event).toMatchObject({ kind: 'block', channel: null, feedLabel: null });
  });

  it('toHostCalendarEvents_DepartureNotAfterArrival_IsShownOnTheArrivalDay', () => {
    const [event] = toHostCalendarEvents([item({ endDate: '2026-09-30T00:00:00' })]);

    expect(toStayDate(event.start)).toBe('2026-09-30');
    expect(toStayDate(event.end)).toBe('2026-10-01');
    expect(event.nights).toBe(0);
  });

  it('toHostCalendarEvents_InvalidDates_LeavesTheEntryOut', () => {
    expect(toHostCalendarEvents([item({ startDate: 'not a date' }), item({ endDate: '2026-02-30T00:00:00' })])).toEqual([]);
  });
});
