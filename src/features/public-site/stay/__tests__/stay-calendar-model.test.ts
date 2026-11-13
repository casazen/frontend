import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/stay-dates';
import {
  addMonths,
  arrivalProblem,
  buildCalendarIndex,
  calendarMonths,
  dayState,
  defaultFocusDate,
  maxNightsAt,
  monthGrid,
  moveFocus,
  rangeProblem,
  selectDay,
  stayTotalCents,
  type CalendarDay,
} from '../stay-calendar-model';

/**
 * The rules that decide which dates a guest can book (DB-20): a wrong day here is a wrong booking everywhere the calendar is used.
 * Today is a value given, here the night summer time ends in Rome; the arithmetic is on calendar days, so that night is one like
 * any other.
 */
const TODAY = '2026-10-25';
const BUSY = ['2026-11-05', '2026-11-06', '2026-11-07'];

const days: CalendarDay[] = Array.from({ length: 400 }, (_, offset) => {
  const date = addDays(TODAY, offset);
  return {
    date,
    available: !BUSY.includes(date),
    priceCents: date.endsWith('-10') ? 20000 : 15000,
    minNights: date >= '2026-11-12' && date <= '2026-11-14' ? 3 : 1,
  };
});
const index = buildCalendarIndex(days, TODAY, addDays(TODAY, 400));
const none = { checkIn: '', checkOut: '' };

describe('dayState', () => {
  it.each([
    ['2026-10-24', 'past'],
    ['2026-11-06', 'busy'],
    ['2026-11-08', 'free'],
    [addDays(TODAY, 400), 'unknown'],
  ])('dayState_%s_Is%s', (date, expected) => {
    expect(dayState(index, date)).toBe(expected);
  });

  it('dayState_CalendarThatCouldNotBeRead_EveryDayUntilTheEndIsFreeAndNothingBeyond', () => {
    const unread = { ...index, unverified: true, days: new Map<string, CalendarDay>() };

    expect(dayState(unread, '2026-11-06')).toBe('free');
    expect(dayState(unread, addDays(TODAY, 401))).toBe('unknown');
  });
});

describe('rangeProblem', () => {
  it.each([
    ['2026-11-03', '2026-11-05', null],
    ['2026-11-04', '2026-11-06', { kind: 'busyBetween', date: '2026-11-05' }],
    ['2026-11-06', '2026-11-09', { kind: 'busyArrival', date: '2026-11-06' }],
    ['2026-11-12', '2026-11-14', { kind: 'minNights', minNights: 3, earliestCheckOut: '2026-11-15' }],
    ['2026-11-12', '2026-11-15', null],
    ['2026-10-20', '2026-10-27', { kind: 'past' }],
  ])('rangeProblem_%s_To_%s', (checkIn, checkOut, expected) => {
    expect(rangeProblem(index, checkIn, checkOut)).toEqual(expected);
  });

  it('rangeProblem_CheckOutDayThatIsTaken_IsFreeToLeaveOn', () => {
    // The 5th is taken as a night; leaving on the morning of the 5th is a stay of the nights of the 3rd and the 4th.
    expect(rangeProblem(index, '2026-11-03', '2026-11-05')).toBeNull();
  });

  it('rangeProblem_NightsBeyondTheLoadedRange_AreNeverFree', () => {
    expect(rangeProblem(index, addDays(TODAY, 398), addDays(TODAY, 402))).toEqual({ kind: 'unknown' });
  });

  it('rangeProblem_TakenNightAndTooFewNights_ReportsTheTakenNightFirst', () => {
    // From the 12th the minimum is 3 nights and the stay has 2: the sentence is about the minimum; with a taken night it is about that.
    const withBusy = buildCalendarIndex(
      days.map((day) => (day.date === '2026-11-13' ? { ...day, available: false } : day)),
      TODAY,
      addDays(TODAY, 400),
    );

    expect(rangeProblem(withBusy, '2026-11-12', '2026-11-14')).toEqual({ kind: 'busyBetween', date: '2026-11-13' });
  });
});

describe('selectDay', () => {
  it('selectDay_NothingChosen_StartsTheStayOnAFreeDay', () => {
    expect(selectDay(index, none, '2026-11-02')).toEqual({ value: { checkIn: '2026-11-02', checkOut: '' }, problem: null });
  });

  it('selectDay_ArrivalChosen_ADayAfterIsTheDeparture', () => {
    expect(selectDay(index, { checkIn: '2026-11-02', checkOut: '' }, '2026-11-04').value).toEqual({
      checkIn: '2026-11-02',
      checkOut: '2026-11-04',
    });
  });

  it('selectDay_ADayBeforeTheArrivalOrAWholeStay_StartsAgain', () => {
    expect(selectDay(index, { checkIn: '2026-11-10', checkOut: '' }, '2026-11-09').value).toEqual({ checkIn: '2026-11-09', checkOut: '' });
    expect(selectDay(index, { checkIn: '2026-11-02', checkOut: '2026-11-04' }, '2026-11-08').value).toEqual({
      checkIn: '2026-11-08',
      checkOut: '',
    });
  });

  it('selectDay_TakenNightAsArrival_LeavesTheStayAsItWasAndSaysWhy', () => {
    const stay = { checkIn: '2026-11-02', checkOut: '2026-11-04' };

    expect(selectDay(index, stay, '2026-11-06')).toEqual({ value: stay, problem: { kind: 'busyArrival', date: '2026-11-06' } });
  });
});

/**
 * The rules the host set on the days (E08/F05/US01, NF-36): what the picker refuses must be what the checkout refuses, or a guest
 * is offered a stay that the payment then turns down. Today is the 25th of October 2026, so «two days ahead» is the 27th.
 */
describe('the rules of the host on the days', () => {
  /** The same nights with rules on some of them. */
  const withRules = (rules: Record<string, Partial<CalendarDay>>) =>
    buildCalendarIndex(
      days.map((day) => ({ ...day, ...rules[day.date] })),
      TODAY,
      addDays(TODAY, 400),
    );

  describe('closed to arrival', () => {
    const closed = withRules({ '2026-11-10': { closedToArrival: true } });

    it('arrivalProblem_NightClosedToArrival_IsRefusedWithItsDate', () => {
      expect(arrivalProblem(closed, '2026-11-10')).toEqual({ kind: 'arrivalClosed', date: '2026-11-10' });
      expect(arrivalProblem(closed, '2026-11-11')).toBeNull();
    });

    it('rangeProblem_StayThatArrivesOnAClosedNight_IsRefusedWhateverItsLength', () => {
      expect(rangeProblem(closed, '2026-11-10', '2026-11-12')).toEqual({ kind: 'arrivalClosed', date: '2026-11-10' });
      expect(rangeProblem(closed, '2026-11-10', '2026-11-20')).toEqual({ kind: 'arrivalClosed', date: '2026-11-10' });
    });

    it('rangeProblem_ClosedNightInsideTheStayOrAsTheDayOfDeparture_IsFreeToSleepInAndToLeaveOn', () => {
      expect(rangeProblem(closed, '2026-11-09', '2026-11-11')).toBeNull();
      expect(rangeProblem(closed, '2026-11-08', '2026-11-10')).toBeNull();
    });

    it('selectDay_ClosedNightAsTheArrival_LeavesTheStayAsItWasAndSaysWhy', () => {
      expect(selectDay(closed, none, '2026-11-10')).toEqual({
        value: none,
        problem: { kind: 'arrivalClosed', date: '2026-11-10' },
      });
      const stay = { checkIn: '2026-11-02', checkOut: '2026-11-04' };
      expect(selectDay(closed, stay, '2026-11-10')).toEqual({ value: stay, problem: { kind: 'arrivalClosed', date: '2026-11-10' } });
    });

    it('selectDay_ClosedNightAfterTheArrival_IsTheDepartureAndIsTaken', () => {
      expect(selectDay(closed, { checkIn: '2026-11-08', checkOut: '' }, '2026-11-10')).toEqual({
        value: { checkIn: '2026-11-08', checkOut: '2026-11-10' },
        problem: null,
      });
    });

    it('rangeProblem_ClosedNightThatIsAlsoTaken_ReportsTheTakenNight', () => {
      const both = withRules({ '2026-11-06': { closedToArrival: true } });

      expect(arrivalProblem(both, '2026-11-06')).toEqual({ kind: 'busyArrival', date: '2026-11-06' });
    });
  });

  describe('closed to departure', () => {
    const closed = withRules({ '2026-11-18': { closedToDeparture: true } });

    it('rangeProblem_DepartureOnADayClosedToDeparture_IsRefusedWithItsDate', () => {
      expect(rangeProblem(closed, '2026-11-16', '2026-11-18')).toEqual({ kind: 'departureClosed', date: '2026-11-18' });
      expect(rangeProblem(closed, '2026-11-16', '2026-11-19')).toBeNull();
    });

    it('rangeProblem_DayClosedToDeparture_IsStillFreeToArriveOnAndToSleepIn', () => {
      expect(arrivalProblem(closed, '2026-11-18')).toBeNull();
      expect(rangeProblem(closed, '2026-11-18', '2026-11-20')).toBeNull();
      expect(rangeProblem(closed, '2026-11-16', '2026-11-19')).toBeNull();
    });

    it('selectDay_DepartureOnADayClosedToDeparture_KeepsTheArrivalAndSaysWhy', () => {
      const arrival = { checkIn: '2026-11-16', checkOut: '' };

      expect(selectDay(closed, arrival, '2026-11-18')).toEqual({
        value: arrival,
        problem: { kind: 'departureClosed', date: '2026-11-18' },
      });
    });

    it('rangeProblem_ClosedDepartureAndTooFewNights_ReportsTheDepartureFirstLikeTheCheckout', () => {
      // From the 13th the minimum is 3 nights; the 15th is closed to departure and the stay has 2 nights: the checkout says the closed day.
      const both = withRules({ '2026-11-15': { closedToDeparture: true } });

      expect(rangeProblem(both, '2026-11-13', '2026-11-15')).toEqual({ kind: 'departureClosed', date: '2026-11-15' });
    });

    it('rangeProblem_TakenNightInsideTheStay_IsReportedBeforeTheClosedDeparture', () => {
      const both = withRules({ '2026-11-08': { closedToDeparture: true } });

      expect(rangeProblem(both, '2026-11-04', '2026-11-08')).toEqual({ kind: 'busyBetween', date: '2026-11-05' });
    });
  });

  describe('the most nights', () => {
    const limited = withRules({ '2026-11-20': { maxNights: 4 }, '2026-11-21': { maxNights: 1 } });

    it('rangeProblem_StayLongerThanTheMaximumOfItsArrival_IsRefusedWithTheMaximumAndTheLastDayToLeave', () => {
      expect(rangeProblem(limited, '2026-11-20', '2026-11-25')).toEqual({
        kind: 'maxNights',
        maxNights: 4,
        latestCheckOut: '2026-11-24',
      });
    });

    it('rangeProblem_StayOfExactlyTheMaximum_IsAccepted', () => {
      expect(rangeProblem(limited, '2026-11-20', '2026-11-24')).toBeNull();
    });

    it('rangeProblem_MaximumOfANightInsideTheStay_IsNotTheOneOfTheStay', () => {
      // The 21st allows one night, but the stay arrives on the 20th: the rule is the one of the arrival.
      expect(rangeProblem(limited, '2026-11-20', '2026-11-23')).toBeNull();
    });

    it('maxNightsAt_NoMaximumOrNonsense_IsNoMaximum', () => {
      const odd = withRules({ '2026-11-22': { maxNights: null }, '2026-11-23': { maxNights: 0 } });

      expect(maxNightsAt(limited, '2026-11-20')).toBe(4);
      expect(maxNightsAt(odd, '2026-11-22')).toBeNull();
      expect(maxNightsAt(odd, '2026-11-23')).toBeNull();
      expect(maxNightsAt(odd, '2026-11-24')).toBeNull();
    });

    it('selectDay_DepartureBeyondTheMaximum_KeepsTheArrivalAndSaysTheMaximum', () => {
      const arrival = { checkIn: '2026-11-20', checkOut: '' };

      expect(selectDay(limited, arrival, '2026-11-26').problem).toEqual({
        kind: 'maxNights',
        maxNights: 4,
        latestCheckOut: '2026-11-24',
      });
    });
  });

  describe('the advance', () => {
    // Today is the 25th: the 27th is 2 days ahead, the 28th is 3, the 4th of November is 10, the 8th is 14.
    const windowed = withRules({
      '2026-10-27': { minAdvanceDays: 3 },
      '2026-10-28': { minAdvanceDays: 3 },
      '2026-11-04': { maxAdvanceDays: 10 },
      '2026-11-08': { maxAdvanceDays: 10 },
    });

    it('arrivalProblem_ArrivalCloserThanTheMinimumAdvance_IsRefusedWithTheLimit', () => {
      expect(arrivalProblem(windowed, '2026-10-27')).toEqual({ kind: 'advance', side: 'shorter', days: 3 });
    });

    it('arrivalProblem_ArrivalExactlyAtTheMinimumAdvance_IsAccepted', () => {
      expect(arrivalProblem(windowed, '2026-10-28')).toBeNull();
    });

    it('arrivalProblem_ArrivalFurtherAheadThanTheMaximumAdvance_IsRefusedWithTheLimit', () => {
      expect(arrivalProblem(windowed, '2026-11-08')).toEqual({ kind: 'advance', side: 'longer', days: 10 });
    });

    it('arrivalProblem_ArrivalExactlyAtTheMaximumAdvance_IsAccepted', () => {
      expect(arrivalProblem(windowed, '2026-11-04')).toBeNull();
    });

    it('rangeProblem_StayThatBreaksTheAdvanceOfItsArrival_IsRefusedWhateverItsLength', () => {
      expect(rangeProblem(windowed, '2026-10-27', '2026-10-31')).toEqual({ kind: 'advance', side: 'shorter', days: 3 });
      expect(rangeProblem(windowed, '2026-11-08', '2026-11-10')).toEqual({ kind: 'advance', side: 'longer', days: 10 });
    });

    it('selectDay_ArrivalOutsideTheAdvanceWindow_LeavesTheStayAsItWasAndSaysWhy', () => {
      expect(selectDay(windowed, none, '2026-10-27')).toEqual({
        value: none,
        problem: { kind: 'advance', side: 'shorter', days: 3 },
      });
    });

    it('rangeProblem_AdvanceOfTheNightsInsideTheStay_IsNotChecked', () => {
      // The 27th is too close, but the stay arrives on the 26th and the rule of the 27th is not the one of its arrival.
      expect(rangeProblem(windowed, '2026-10-26', '2026-10-30')).toBeNull();
    });
  });

  it('rangeProblem_DaysWithNoRuleAtAll_BehaveAsTheyAlwaysDid', () => {
    const plain = withRules({
      '2026-11-10': { maxNights: null, closedToArrival: false, closedToDeparture: false, minAdvanceDays: null, maxAdvanceDays: null },
    });

    expect(rangeProblem(plain, '2026-11-10', '2026-11-30')).toBeNull();
    expect(rangeProblem(plain, '2026-11-08', '2026-11-10')).toBeNull();
    expect(rangeProblem(index, '2026-11-10', '2026-11-30')).toBeNull();
  });

  it('rangeProblem_CalendarThatCouldNotBeRead_ChecksNoRule', () => {
    // Nothing is known of the days: the checkout checks the same rules again before the payment.
    const unread = { ...withRules({ '2026-11-10': { closedToArrival: true } }), unverified: true, days: new Map<string, CalendarDay>() };

    expect(rangeProblem(unread, '2026-11-10', '2026-11-12')).toBeNull();
  });
});

describe('stayTotalCents', () => {
  it('stayTotalCents_NightsWithTheirPrices_AreAddedUp', () => {
    expect(stayTotalCents(index, '2026-11-09', '2026-11-12')).toBe(15000 + 20000 + 15000);
  });

  it('stayTotalCents_ANightWithoutAPrice_IsNotAGuess', () => {
    const unpriced = buildCalendarIndex(
      [{ date: '2026-11-09', available: true, priceCents: null, minNights: 1 }],
      TODAY,
      addDays(TODAY, 400),
    );

    expect(stayTotalCents(unpriced, '2026-11-09', '2026-11-10')).toBeNull();
  });
});

describe('the months and the grid', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2026-03-31', -1, '2026-02-28'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-01-15', -1, '2025-12-15'],
  ])('addMonths_%s_By%s_Is%s', (date, delta, expected) => {
    expect(addMonths(date, delta)).toBe(expected);
  });

  it.each([
    ['2026-10-01', 3, 31],
    ['2026-11-01', 6, 30],
    ['2026-03-01', 6, 31], // summer time starts on the 29th
    ['2028-02-01', 1, 29],
  ])('monthGrid_%s_StartsAfter%sBlanksAndHas%sDays', (month, blanks, length) => {
    const grid = monthGrid(month);

    expect(grid.leadingBlanks).toBe(blanks);
    expect(grid.dates).toHaveLength(length);
  });

  it('calendarMonths_FromTodayToTheEndOfTheRange_AtMostThirteen', () => {
    expect(calendarMonths(index)).toHaveLength(13);
    expect(calendarMonths(index).slice(0, 3)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
  });
});

describe('focus', () => {
  it.each([
    ['2026-10-31', 'ArrowRight', '2026-11-01'],
    ['2026-10-31', 'ArrowDown', '2026-11-07'],
    ['2026-10-31', 'ArrowUp', '2026-10-24'],
    ['2026-11-04', 'Home', '2026-11-02'],
    ['2026-11-04', 'End', '2026-11-08'],
    ['2026-01-31', 'PageDown', '2026-02-28'],
    ['2026-03-31', 'PageUp', '2026-02-28'],
  ] as const)('moveFocus_%s_%s_Goes%s', (from, key, expected) => {
    expect(moveFocus(from, key)).toBe(expected);
  });

  it('defaultFocusDate_NothingChosen_IsTheFirstFreeDay', () => {
    expect(defaultFocusDate(index, none)).toBe('2026-10-25');
    expect(defaultFocusDate(index, { checkIn: '2026-11-09', checkOut: '' })).toBe('2026-11-09');
  });
});
