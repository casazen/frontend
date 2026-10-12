import { describe, expect, it } from 'vitest';
import {
  buildWorkingDays,
  hmToMinutes,
  minutesToHm,
  weekdayOf,
} from '../supplier-agenda';

describe('supplier-agenda helpers', () => {
  it('minutesToHm_AndBack_RoundTrip', () => {
    expect(minutesToHm(540)).toBe('09:00');
    expect(minutesToHm(1080)).toBe('18:00');
    expect(hmToMinutes('09:00')).toBe(540);
    expect(hmToMinutes('18:00')).toBe(1080);
    expect(hmToMinutes('25:00')).toBeNull();
  });

  it('weekdayOf_StayDate_IsRomeWeekday', () => {
    expect(weekdayOf('2026-10-13')).toBe('Tuesday');
    expect(weekdayOf('2026-10-12')).toBe('Monday');
  });

  it('buildWorkingDays_AllDayCalendarEvent_MarksTheDayClosedWithTitle', () => {
    const days = buildWorkingDays({
      dates: ['2026-10-13'],
      workingHours: [{ weekday: 'Tuesday', bands: [{ startMinute: 540, endMinute: 1080 }] }],
      closedDays: [{ date: '2026-10-13', source: 'ICalFeed' }],
      timeOff: [],
      blocks: [
        {
          id: '1',
          kind: 'External',
          source: 'ICalFeed',
          startUtc: '2026-10-12T22:00:00.000Z',
          endUtc: '2026-10-13T22:00:00.000Z',
          label: 'busy - TEST',
          createdAt: '2026-10-12T10:00:00Z',
        },
      ],
      requests: [],
    });

    expect(days).toHaveLength(1);
    expect(days[0].available).toBe(false);
    expect(days[0].bands).toEqual([{ startMinute: 540, endMinute: 1080 }]);
    expect(days[0].events).toEqual([
      expect.objectContaining({ kind: 'calendar', label: 'busy - TEST', timeRange: null }),
    ]);
  });

  it('buildWorkingDays_TimedEvent_ShowsRomeHours', () => {
    const days = buildWorkingDays({
      dates: ['2026-10-13'],
      workingHours: [{ weekday: 'Tuesday', bands: [{ startMinute: 540, endMinute: 1080 }] }],
      closedDays: [],
      timeOff: [],
      blocks: [
        {
          id: '1',
          kind: 'External',
          source: 'ICalFeed',
          startUtc: '2026-10-13T08:00:00.000Z',
          endUtc: '2026-10-13T09:00:00.000Z',
          label: 'Dentista',
          createdAt: '2026-10-12T10:00:00Z',
        },
      ],
      requests: [],
    });

    expect(days[0].available).toBe(true);
    expect(days[0].events[0]).toMatchObject({ label: 'Dentista', timeRange: '10:00–11:00', kind: 'calendar' });
  });
});
