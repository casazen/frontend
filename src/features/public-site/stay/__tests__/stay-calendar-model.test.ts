import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/stay-dates';
import {
  addMonths,
  buildCalendarIndex,
  calendarMonths,
  dayState,
  defaultFocusDate,
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
