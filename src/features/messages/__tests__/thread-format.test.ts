import { describe, expect, it } from 'vitest';
import { formatListTime, formatMessageTime, formatStayRange } from '../lib/thread-format';

// The times of the conversations are Europe/Rome times, whatever the time zone of the computer that shows them: the API sends UTC instants
// and a property carries no time zone of its own. These are real values, not a mock of the formatter.
describe('the time of a message, in Rome time (NF-61)', () => {
  it('formatMessageTime_WinterInstant_IsOneHourAfterUtc', () => {
    expect(formatMessageTime('2026-11-10T08:00:00Z', 'it')).toMatch(/^10 nov.*09:00$/);
  });

  it('formatMessageTime_SummerInstant_IsTwoHoursAfterUtc', () => {
    expect(formatMessageTime('2026-07-10T08:00:00Z', 'it')).toMatch(/^10 lug.*10:00$/);
  });

  it('formatMessageTime_LateEveningInUtc_IsTheNextDayInRome', () => {
    expect(formatMessageTime('2026-11-10T23:30:00Z', 'it')).toMatch(/^11 nov.*00:30$/);
  });

  it('formatMessageTime_NotAnInstant_IsEmptyNeverAnInvalidDate', () => {
    expect(formatMessageTime('', 'it')).toBe('');
    expect(formatMessageTime('yesterday', 'it')).toBe('');
  });
});

describe('the time of the last message in the list (NF-61)', () => {
  it('formatListTime_MessageOfTodayInRome_IsTheHour', () => {
    expect(formatListTime('2026-11-10T08:00:00Z', 'it', new Date('2026-11-10T15:00:00Z'))).toBe('09:00');
  });

  it('formatListTime_MessageOfAnotherDay_IsTheDay', () => {
    expect(formatListTime('2026-11-09T08:00:00Z', 'it', new Date('2026-11-10T15:00:00Z'))).toMatch(/^9 nov/);
  });

  it('formatListTime_TodayIsTheDayOfRomeNotTheDayOfUtc', () => {
    // 23:30 UTC of the 10th is 00:30 of the 11th in Rome: at 09:00 of the 11th it is today, although the days of UTC differ.
    expect(formatListTime('2026-11-10T23:30:00Z', 'it', new Date('2026-11-11T08:00:00Z'))).toBe('00:30');
    // 22:30 UTC of the 10th is 23:30 in Rome; an hour later it is 00:30 of the 11th: it is yesterday, although the days of UTC are the same.
    expect(formatListTime('2026-11-10T22:30:00Z', 'it', new Date('2026-11-10T23:30:00Z'))).toMatch(/^10 nov/);
  });

  it('formatListTime_SummerTimeOfToday_IsTheHourOfRome', () => {
    expect(formatListTime('2026-07-10T08:00:00Z', 'it', new Date('2026-07-10T12:00:00Z'))).toBe('10:00');
  });
});

describe('the days of a stay in the list (NF-61)', () => {
  it('formatStayRange_TwoDays_ShowsBothAsTheyAreInTheCalendar', () => {
    expect(formatStayRange('2026-11-20', '2026-11-23', 'it')).toBe('20 nov–23 nov');
  });

  it('formatStayRange_AMissingDay_IsEmpty', () => {
    expect(formatStayRange(null, '2026-11-23', 'it')).toBe('');
    expect(formatStayRange('2026-11-20', undefined, 'it')).toBe('');
  });
});
