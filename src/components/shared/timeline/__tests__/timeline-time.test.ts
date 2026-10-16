import { describe, expect, it } from 'vitest';
import { formatAbsolute, formatRelative } from '../timeline-time';

// 12:00 UTC of Friday 16 October 2026: 14:00 in Rome (CEST, UTC+2).
const NOW = new Date('2026-10-16T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('times of the timeline (UI-15)', () => {
  describe('formatAbsolute', () => {
    it('formatAbsolute_ThisYear_IsTheDayAndTheHourInRome', () => {
      // 09:30 UTC is 11:30 in Rome.
      expect(formatAbsolute(new Date('2026-10-16T09:30:00Z'), NOW, 'it')).toBe('16 ott, 11:30');
    });

    it('formatAbsolute_AnotherYear_SaysTheYear', () => {
      expect(formatAbsolute(new Date('2025-03-02T09:30:00Z'), NOW, 'it')).toContain('2025');
    });

    it('formatAbsolute_LateEveningUtc_IsAlreadyTomorrowInRome', () => {
      // 22:30 UTC on 16 October is 00:30 on the 17th in Rome.
      expect(formatAbsolute(new Date('2026-10-16T22:30:00Z'), NOW, 'it')).toBe('17 ott, 00:30');
    });

    it('formatAbsolute_English_UsesTheTwentyFourHourClockToo', () => {
      const text = formatAbsolute(new Date('2026-10-16T13:05:00Z'), NOW, 'en');

      expect(text).toContain('15:05');
      expect(text).not.toMatch(/AM|PM/);
    });
  });

  describe('formatRelative', () => {
    it('formatRelative_LessThanAMinute_IsNow', () => {
      expect(formatRelative(ago(20_000), NOW, 'it')).toBe('ora');
      expect(formatRelative(ago(20_000), NOW, 'en')).toBe('now');
    });

    it('formatRelative_Minutes_AreWholeAndTowardZero', () => {
      expect(formatRelative(ago(3 * MINUTE), NOW, 'it')).toBe('3 minuti fa');
      expect(formatRelative(ago(59.6 * MINUTE), NOW, 'it')).toBe('59 minuti fa');
      expect(formatRelative(ago(5 * MINUTE), NOW, 'en')).toBe('5 minutes ago');
    });

    it('formatRelative_HoursWithinTheDay_AreCountedByTheTimeThatPassed', () => {
      expect(formatRelative(ago(2 * HOUR), NOW, 'it')).toBe('2 ore fa');
      expect(formatRelative(ago(23.9 * HOUR), NOW, 'it')).toBe('23 ore fa');
    });

    it('formatRelative_TheFuture_IsToldAsWell', () => {
      expect(formatRelative(new Date(NOW.getTime() + 2 * HOUR), NOW, 'it')).toBe('tra 2 ore');
      expect(formatRelative(new Date(NOW.getTime() + 3 * DAY), NOW, 'en')).toBe('in 3 days');
    });

    it('formatRelative_JustAfterMidnightInRome_StillCountsTheTimeThatPassedWithinTheDay', () => {
      // 23:30 in Rome on the 15th (21:30 UTC) seen at 00:10 in Rome on the 16th (22:10 UTC on the 15th): 40 minutes, not "yesterday".
      const lateNow = new Date('2026-10-15T22:10:00Z');

      expect(formatRelative(new Date('2026-10-15T21:30:00Z'), lateNow, 'it')).toBe('40 minuti fa');
    });

    it('formatRelative_BeyondADay_CountsTheCalendarDaysOfRomeNotTheHours', () => {
      // Now is 00:30 in Rome on the 17th (22:30 UTC on the 16th); the event is at 23:00 in Rome on the 15th: 25 and a half
      // hours earlier, which is two calendar days (not "yesterday").
      const lateNow = new Date('2026-10-16T22:30:00Z');

      expect(formatRelative(new Date('2026-10-15T21:00:00Z'), lateNow, 'en')).toBe('2 days ago');
    });

    it('formatRelative_DaysAreRomeCalendarDays', () => {
      expect(formatRelative(ago(DAY + HOUR), NOW, 'it')).toBe('ieri');
      expect(formatRelative(ago(3 * DAY), NOW, 'it')).toBe('3 giorni fa');
      expect(formatRelative(ago(6 * DAY), NOW, 'en')).toBe('6 days ago');
    });

    it('formatRelative_MoreThanAWeek_HasNoRelativeForm_TheDateSaysIt', () => {
      expect(formatRelative(ago(7 * DAY + HOUR), NOW, 'it')).toBeNull();
      expect(formatRelative(ago(90 * DAY), NOW, 'en')).toBeNull();
      expect(formatRelative(new Date(NOW.getTime() + 30 * DAY), NOW, 'it')).toBeNull();
    });
  });
});
