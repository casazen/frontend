import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  endOfMonth,
  formatStayDate,
  isStayDate,
  nightsBetween,
  startOfMonth,
  toStayDate,
  todayInRome,
  utcStayDate,
} from '@/lib/stay-dates';
import { LATE_EVENING_UTC, NOON_UTC, freezeClock, withBrowserTimeZone } from '@/test/clock';

describe('todayInRome', () => {
  it('todayInRome_LateEveningUtcInSummer_ReturnsNextCalendarDay', () => {
    // 22:30 UTC is 00:30 of the next day in Rome (CEST, UTC+2).
    expect(todayInRome(new Date('2026-09-23T22:30:00Z'))).toBe('2026-09-24');
  });

  it('todayInRome_LateEveningUtcInWinter_ReturnsNextCalendarDay', () => {
    // 23:30 UTC is 00:30 of the next day in Rome (CET, UTC+1).
    expect(todayInRome(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16');
  });

  it('todayInRome_EarlyEveningUtc_ReturnsSameCalendarDay', () => {
    expect(todayInRome(new Date('2026-09-23T21:30:00Z'))).toBe('2026-09-23');
  });
});

describe('stay date helpers', () => {
  it('isStayDate_NonExistingOrMalformedDate_ReturnsFalse', () => {
    expect(isStayDate('2026-02-28')).toBe(true);
    expect(isStayDate('2026-02-30')).toBe(false);
    expect(isStayDate('2026-2-3')).toBe(false);
    expect(isStayDate('')).toBe(false);
  });

  it('addDays_AcrossMonthAndYear_ReturnsCalendarDate', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('invalid', 1)).toBe('');
  });

  it('nightsBetween_AcrossDaylightSavingChange_CountsCalendarNights', () => {
    expect(nightsBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(nightsBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('nightsBetween_MissingOrReversedDates_ReturnsZero', () => {
    expect(nightsBetween('', '2026-10-04')).toBe(0);
    expect(nightsBetween('2026-10-04', '2026-10-01')).toBe(0);
    expect(nightsBetween('2026-10-04', '2026-10-04')).toBe(0);
  });

  it('formatStayDate_InvalidDate_ReturnsEmptyInsteadOfInvalidDate', () => {
    expect(formatStayDate('', 'it')).toBe('');
    expect(formatStayDate('2026-10-01', 'it')).toBe('1 ottobre 2026');
  });
});

describe('todayInRome with the system clock (QA-CLOCK-FE)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('todayInRome_At2330UtcOf24September_ReturnsRomeDate25September', () => {
    freezeClock(LATE_EVENING_UTC);

    expect(todayInRome()).toBe('2026-09-25');
  });

  it('todayInRome_AtNoonUtc_ReturnsSameCalendarDate', () => {
    freezeClock(NOON_UTC);

    expect(todayInRome()).toBe('2026-09-24');
  });

  describe('in a browser far from Rome', () => {
    withBrowserTimeZone('America/New_York');

    it('todayInRome_BrowserStillOnThe24th_ReturnsRomeDate', () => {
      // 19:30 of the 24th in New York, 01:30 of the 25th in Rome.
      freezeClock(LATE_EVENING_UTC);

      expect(new Date().getDate()).toBe(24);
      expect(todayInRome()).toBe('2026-09-25');
    });
  });
});

describe('toStayDate (QA-CLOCK-FE)', () => {
  describe('in Europe/Rome', () => {
    withBrowserTimeZone('Europe/Rome');

    it('toStayDate_LocalMidnight_KeepsTheCalendarDate', () => {
      const localMidnight = new Date(2026, 8, 25);
      // The bug being fixed: the UTC date of a local midnight in Rome is the day before.
      expect(localMidnight.toISOString()).toBe('2026-09-24T22:00:00.000Z');

      expect(toStayDate(localMidnight)).toBe('2026-09-25');
    });

    it('toStayDate_LocalMidnightOnDaylightSavingChange_KeepsTheCalendarDate', () => {
      expect(toStayDate(new Date(2026, 2, 29))).toBe('2026-03-29');
      expect(toStayDate(new Date(2026, 9, 25))).toBe('2026-10-25');
    });
  });

  describe('west of UTC', () => {
    withBrowserTimeZone('America/Los_Angeles');

    it('toStayDate_LocalLateEvening_KeepsTheCalendarDate', () => {
      // 23:30 of the 25th in Los Angeles is already the 26th in UTC.
      expect(toStayDate(new Date(2026, 8, 25, 23, 30))).toBe('2026-09-25');
    });
  });

  it('toStayDate_InvalidDate_ReturnsEmpty', () => {
    expect(toStayDate(new Date('invalid'))).toBe('');
  });
});

describe('UTC calendar helpers (QA-CLOCK-FE)', () => {
  withBrowserTimeZone('Europe/Rome');

  it('utcStayDate_UtcMidnightOfAnApiDate_ReturnsThatDate', () => {
    expect(utcStayDate(new Date('2026-09-25'))).toBe('2026-09-25');
    expect(utcStayDate(new Date('invalid'))).toBe('');
  });

  it('startOfMonth_AnyDayOfTheMonth_ReturnsTheFirstDay', () => {
    expect(startOfMonth('2026-09-25')).toBe('2026-09-01');
    expect(startOfMonth('invalid')).toBe('');
  });

  it('endOfMonth_AnyDayOfTheMonth_ReturnsTheLastDay', () => {
    expect(endOfMonth('2026-09-01')).toBe('2026-09-30');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonth('2026-12-31')).toBe('2026-12-31');
    expect(endOfMonth('invalid')).toBe('');
  });

  it('addDays_InBrowserTimeZoneWithDaylightSavingChange_ReturnsCalendarDate', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });
});
