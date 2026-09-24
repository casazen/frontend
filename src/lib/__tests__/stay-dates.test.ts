import { describe, expect, it } from 'vitest';
import { addDays, formatStayDate, isStayDate, nightsBetween, todayInRome } from '@/lib/stay-dates';

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
