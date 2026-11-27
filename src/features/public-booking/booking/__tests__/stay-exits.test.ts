import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/stay-dates';
import { buildCalendarIndex, type CalendarDay, type RangeProblem } from '@/features/public-site/stay/stay-calendar-model';
import { extendToMinimum, firstFreeStay, limitOfProblem, problemOfCode, problemOfRange } from '../stay-exits';

/**
 * What a guest is told when a stay cannot be had, and where they are sent: the rules the host set on the nights (E08/F05/US01, NF-36)
 * must be said in their own sentence, never as the generic failure, and a way out must never land on a night a rule refuses.
 */
const TODAY = '2026-10-25';

/** 90 free nights from today with the rules of the test on some of them. */
function indexWith(rules: Record<string, Partial<CalendarDay>>) {
  const days: CalendarDay[] = Array.from({ length: 90 }, (_, offset) => {
    const date = addDays(TODAY, offset);
    return { date, available: true, priceCents: 15000, minNights: 1, ...rules[date] };
  });
  return buildCalendarIndex(days, TODAY, addDays(TODAY, 90));
}

describe('problemOfRange', () => {
  it.each<[RangeProblem, string | null]>([
    [{ kind: 'past' }, 'past'],
    [{ kind: 'busyArrival', date: '2026-11-05' }, 'datesUnavailable'],
    [{ kind: 'busyBetween', date: '2026-11-05' }, 'datesUnavailable'],
    [{ kind: 'arrivalClosed', date: '2026-11-10' }, 'arrivalClosed'],
    [{ kind: 'departureClosed', date: '2026-11-12' }, 'departureClosed'],
    [{ kind: 'minNights', minNights: 3, earliestCheckOut: '2026-11-13' }, 'minNights'],
    [{ kind: 'maxNights', maxNights: 4, latestCheckOut: '2026-11-14' }, 'maxNights'],
    [{ kind: 'advance', side: 'shorter', days: 3 }, 'advance'],
    [{ kind: 'advance', side: 'longer', days: 90 }, 'advance'],
    // A night the calendar does not know is not a reason to refuse: the server answers for it.
    [{ kind: 'unknown' }, null],
  ])('problemOfRange_%j_Is%s', (problem, expected) => {
    expect(problemOfRange(problem)).toBe(expected);
  });

  it('problemOfRange_NoProblem_IsNoProblem', () => {
    expect(problemOfRange(null)).toBeNull();
  });
});

describe('problemOfCode', () => {
  it.each([
    ['booking_dates_unavailable', 'datesUnavailable'],
    ['direct_booking_min_nights_not_met', 'minNights'],
    ['direct_booking_arrival_closed', 'arrivalClosed'],
    ['direct_booking_departure_closed', 'departureClosed'],
    ['direct_booking_max_nights_exceeded', 'maxNights'],
    ['direct_booking_advance_too_short', 'advance'],
    ['direct_booking_advance_too_long', 'advance'],
    ['booking_too_many_guests', 'tooManyGuests'],
    ['direct_booking_invalid_stay', 'invalidStay'],
    ['direct_booking_payments_not_ready', 'notBookable'],
  ])('problemOfCode_%s_Is%s', (code, expected) => {
    expect(problemOfCode(code)).toBe(expected);
  });

  it('problemOfCode_ACodeOfNoRuleOfTheStay_IsTheGenericFailure', () => {
    expect(problemOfCode('something_else')).toBe('failed');
    expect(problemOfCode(undefined)).toBe('failed');
  });
});

describe('limitOfProblem', () => {
  it('limitOfProblem_WholeNumberAboveZero_IsTheLimit', () => {
    expect(limitOfProblem({ code: 'direct_booking_max_nights_exceeded', date: '2026-11-10', limit: 4 })).toBe(4);
  });

  it.each([[{ limit: 0 }], [{ limit: -2 }], [{ limit: 2.5 }], [{ limit: '4' }], [{ limit: null }], [{}], [null], ['limit'], [undefined]])(
    'limitOfProblem_%j_IsNoLimit',
    (body) => {
      expect(limitOfProblem(body)).toBeUndefined();
    },
  );
});

describe('firstFreeStay', () => {
  it('firstFreeStay_NoRules_IsTheFirstFreeNightsFromTheArrivalAsked', () => {
    expect(firstFreeStay(indexWith({}), 3, '2026-11-10')).toEqual({ checkIn: '2026-11-10', checkOut: '2026-11-13' });
  });

  it('firstFreeStay_ArrivalClosed_SkipsTheClosedNight', () => {
    const index = indexWith({ '2026-11-10': { closedToArrival: true } });

    expect(firstFreeStay(index, 2, '2026-11-10')).toEqual({ checkIn: '2026-11-11', checkOut: '2026-11-13' });
  });

  it('firstFreeStay_DepartureClosed_SkipsTheArrivalThatLeavesOnTheClosedDay', () => {
    // 3 nights from the 10th would leave on the 13th, which is closed to departure: the first stay that leaves on an open day is the 11th.
    const index = indexWith({ '2026-11-13': { closedToDeparture: true } });

    expect(firstFreeStay(index, 3, '2026-11-10')).toEqual({ checkIn: '2026-11-11', checkOut: '2026-11-14' });
  });

  it('firstFreeStay_StayLongerThanTheMaximumOfAnArrival_SkipsThatArrival', () => {
    const index = indexWith({ '2026-11-10': { maxNights: 2 }, '2026-11-11': { maxNights: 2 } });

    expect(firstFreeStay(index, 4, '2026-11-10')).toEqual({ checkIn: '2026-11-12', checkOut: '2026-11-16' });
  });

  it('firstFreeStay_ArrivalCloserThanTheMinimumAdvance_StartsWhereTheAdvanceHolds', () => {
    // Every night asks for 3 days ahead: today and the two days after cannot start a stay, the 28th can.
    const rules = Object.fromEntries(Array.from({ length: 90 }, (_, offset) => [addDays(TODAY, offset), { minAdvanceDays: 3 }]));

    expect(firstFreeStay(indexWith(rules), 2, '')).toEqual({ checkIn: '2026-10-28', checkOut: '2026-10-30' });
  });

  it('firstFreeStay_ArrivalFurtherAheadThanTheMaximumAdvance_IsFoundFromToday', () => {
    // Every night can be booked 20 days ahead at most: from the 10th of December on (46 days ahead) there is nothing, from today there is.
    const rules = Object.fromEntries(Array.from({ length: 90 }, (_, offset) => [addDays(TODAY, offset), { maxAdvanceDays: 20 }]));
    const index = indexWith(rules);

    expect(firstFreeStay(index, 2, '2026-12-10')).toBeNull();
    expect(firstFreeStay(index, 2, '')).toEqual({ checkIn: '2026-10-25', checkOut: '2026-10-27' });
  });

  it('firstFreeStay_EveryNightClosedToArrival_IsNoStayAtAll', () => {
    const rules = Object.fromEntries(Array.from({ length: 90 }, (_, offset) => [addDays(TODAY, offset), { closedToArrival: true }]));

    expect(firstFreeStay(indexWith(rules), 2, '')).toBeNull();
  });
});

describe('extendToMinimum', () => {
  it('extendToMinimum_MinimumThatLeavesOnADayClosedToDeparture_IsNoWayOut', () => {
    const index = indexWith({ '2026-11-10': { minNights: 3 }, '2026-11-13': { closedToDeparture: true } });

    expect(extendToMinimum(index, '2026-11-10')).toBeNull();
  });

  it('extendToMinimum_MinimumOfTheArrival_IsThatManyNights', () => {
    const index = indexWith({ '2026-11-10': { minNights: 3 } });

    expect(extendToMinimum(index, '2026-11-10')).toEqual({ checkIn: '2026-11-10', checkOut: '2026-11-13' });
  });

  it('extendToMinimum_MinimumOfTheServerAboveTheOneOfTheCalendar_IsThatManyNights', () => {
    // The calendar (older than the rule) asks for no minimum, the refusal of the server said five: the stay has five nights, not one.
    expect(extendToMinimum(indexWith({}), '2026-11-10', 5)).toEqual({ checkIn: '2026-11-10', checkOut: '2026-11-15' });
  });

  it('extendToMinimum_MinimumOfTheServerBelowTheOneOfTheCalendar_IsTheOneOfTheCalendar', () => {
    const index = indexWith({ '2026-11-10': { minNights: 4 } });

    expect(extendToMinimum(index, '2026-11-10', 2)).toEqual({ checkIn: '2026-11-10', checkOut: '2026-11-14' });
  });

  it('extendToMinimum_NightsOfTheServerMinimumThatAreNotFree_IsNoWayOut', () => {
    const index = indexWith({ '2026-11-13': { available: false } });

    expect(extendToMinimum(index, '2026-11-10', 5)).toBeNull();
  });
});
