import { describe, expect, it } from 'vitest';
import type { PropertyIcalFeed, PropertyIcalImportStatus } from '@/types/property-ical';
import { syncingRefetchInterval } from '../use-property-ical';

function feed(id: string, lastImportStatus: PropertyIcalImportStatus | null): PropertyIcalFeed {
  return { id, channel: 'Airbnb', createdAt: '2026-09-01T10:00:00Z', lastImportStatus, blockCount: 0 };
}

function query(data?: PropertyIcalFeed[]) {
  return { state: { data } };
}

describe('syncingRefetchInterval (PC-13)', () => {
  it('syncingRefetchInterval_NoFeedSyncing_DoesNotPoll', () => {
    expect(syncingRefetchInterval(query([feed('a', 'Success'), feed('b', 'Failure'), feed('c', null)]))).toBe(false);
    expect(syncingRefetchInterval(query(undefined))).toBe(false);
  });

  it('syncingRefetchInterval_FeedSyncing_PollsFastThenSlower', () => {
    const q = query([feed('a', 'Success'), feed('b', 'Syncing')]);
    const start = 1_000_000;

    expect(syncingRefetchInterval(q, start)).toBe(3_000);
    expect(syncingRefetchInterval(q, start + 59_000)).toBe(3_000);
    expect(syncingRefetchInterval(q, start + 61_000)).toBe(15_000);
  });

  it('syncingRefetchInterval_NewSyncAfterTheLastEnded_StartsFastAgain', () => {
    const q = query([feed('a', 'Syncing')]);
    const start = 2_000_000;
    syncingRefetchInterval(q, start);
    expect(syncingRefetchInterval(q, start + 120_000)).toBe(15_000);

    q.state.data = [feed('a', 'Success')];
    expect(syncingRefetchInterval(q, start + 125_000)).toBe(false);

    q.state.data = [feed('a', 'Syncing')];
    expect(syncingRefetchInterval(q, start + 600_000)).toBe(3_000);
  });
});
