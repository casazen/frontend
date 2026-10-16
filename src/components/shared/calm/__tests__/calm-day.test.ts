import { describe, expect, it } from 'vitest';
import { calendarDayOf } from '../calm-day';

describe('calendarDayOf (UI-16)', () => {
  it.each([
    ['2026-10-16', '2026-10-16'],
    // A date field of the API, with a time and no zone: the day it says.
    ['2026-10-16T09:30:00', '2026-10-16'],
    ['2026-10-16T23:59', '2026-10-16'],
    // The stored midnight of a day (UTC): the same day in Rome.
    ['2026-10-17T00:00:00Z', '2026-10-17'],
    ['2026-01-17T00:00:00Z', '2026-01-17'],
  ])('CalendarDayOf_%s_Is%s', (value, expected) => {
    expect(calendarDayOf(value)).toBe(expected);
  });

  it.each([
    // An instant: the day it falls on in Rome (summer time is UTC+2, winter time UTC+1), not the day of its UTC date.
    ['2026-10-16T22:30:00Z', '2026-10-17'],
    ['2026-10-16T21:59:59.999Z', '2026-10-16'],
    ['2026-12-16T23:30:00Z', '2026-12-17'],
    ['2026-12-16T22:59:00Z', '2026-12-16'],
    // With an offset: 23:30 in Rome is 21:30 UTC and still the 16th, 00:30 is the 17th.
    ['2026-10-16T23:30:00+02:00', '2026-10-16'],
    ['2026-10-17T00:30:00+02:00', '2026-10-17'],
    ['2026-10-16T20:00:00-05:00', '2026-10-17'],
    ['2026-10-16T23:30:00+0200', '2026-10-16'],
  ])('CalendarDayOf_Instant_%s_IsTheDayInRome_%s', (value, expected) => {
    expect(calendarDayOf(value)).toBe(expected);
  });

  it.each([[''], [undefined], [null], ['oggi'], ['16/10/2026'], ['2026-13-45'], ['2026-10-16Z']])('CalendarDayOf_%s_IsEmpty', (value) => {
    expect(calendarDayOf(value)).toBe('');
  });
});
