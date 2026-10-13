import { describe, expect, it } from 'vitest';
import type { PendingFreeEvent } from '@/types/supplier';
import { describeFreeEventWhen, pendingFreeEventDates } from '../free-events';

const base: PendingFreeEvent = {
  id: 'e',
  summary: 'TEST',
  isAllDay: true,
  recurring: false,
  occurrences: 1,
  nextStartUtc: '2026-10-14T22:00:00Z',
  nextEndUtc: '2026-10-15T22:00:00Z',
  firstSeenAt: '2026-10-13T08:00:00Z',
};

describe('pendingFreeEventDates', () => {
  it('pendingFreeEventDates_AllDayEventWithExclusiveEnd_HoldsOnlyThatRomeDay', () => {
    expect([...pendingFreeEventDates([base])]).toEqual(['2026-10-15']);
  });

  it('pendingFreeEventDates_ThreeDayEvent_HoldsEachRomeDay', () => {
    const event = { ...base, nextEndUtc: '2026-10-17T22:00:00Z' };
    expect([...pendingFreeEventDates([event])]).toEqual(['2026-10-15', '2026-10-16', '2026-10-17']);
  });

  it('pendingFreeEventDates_TimedEventLateEvening_UsesTheRomeDateNotUtc', () => {
    const event = { ...base, isAllDay: false, nextStartUtc: '2026-10-15T21:30:00Z', nextEndUtc: '2026-10-15T22:30:00Z' };
    expect([...pendingFreeEventDates([event])]).toEqual(['2026-10-15', '2026-10-16']);
  });

  it('pendingFreeEventDates_InvalidInstant_HoldsNothing', () => {
    expect(pendingFreeEventDates([{ ...base, nextStartUtc: 'nope' }]).size).toBe(0);
  });
});

describe('describeFreeEventWhen', () => {
  it('describeFreeEventWhen_TimedEvent_ShowsRomeHours', () => {
    const event = { ...base, isAllDay: false, nextStartUtc: '2026-10-16T07:00:00Z', nextEndUtc: '2026-10-16T09:30:00Z' };
    expect(describeFreeEventWhen(event, 'it')).toContain('09:00–11:30');
  });
});
