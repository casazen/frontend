import { describe, expect, it } from 'vitest';
import { formatRelativeDay } from '../crm-format';

const NOW = new Date('2026-11-27T10:00:00Z');

describe('formatRelativeDay: how long ago a stay day was, in the words of the language', () => {
  it.each([
    ['2026-11-27', 'oggi'],
    ['2026-11-26', 'ieri'],
    ['2026-11-24', '3 giorni fa'],
    ['2026-11-13', '2 settimane fa'],
    ['2026-09-14', '2 mesi fa'],
    ['2024-11-20', '2 anni fa'],
  ])('%s is "%s" in Italian', (day, words) => {
    expect(formatRelativeDay(`${day}T00:00:00Z`, 'it', NOW)).toBe(words);
  });

  it.each([
    ['2026-11-26', 'yesterday'],
    ['2026-11-24', '3 days ago'],
    ['2026-09-14', '2 months ago'],
  ])('%s is "%s" in English', (day, words) => {
    expect(formatRelativeDay(day, 'en', NOW)).toBe(words);
  });

  it('counts the calendar days of Rome: a day that began a minute ago is today, not yesterday', () => {
    expect(formatRelativeDay('2026-11-27', 'it', new Date('2026-11-26T23:01:00Z'))).toBe('oggi');
    expect(formatRelativeDay('2026-11-26', 'it', new Date('2026-11-26T23:01:00Z'))).toBe('ieri');
  });

  it.each([null, undefined, '', 'not a date'])('says nothing for %s: a profile without a stay', (value) => {
    expect(formatRelativeDay(value, 'it', NOW)).toBeNull();
  });
});
