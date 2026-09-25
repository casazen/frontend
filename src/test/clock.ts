import { afterAll, beforeAll, vi } from 'vitest';

/**
 * Clock helpers of the tests (QA-CLOCK-FE): a test never depends on the real time of the day. Between 22:00 and
 * 24:00 UTC the UTC date is not the date in Rome, so a test that reads the real clock would pass or fail by the hour.
 */

/** 23:30 UTC of 24 September 2026: already 01:30 of 25 September in Rome (CEST, UTC+2). */
export const LATE_EVENING_UTC = '2026-09-24T23:30:00Z';

/** 12:00 UTC of 24 September 2026: 14:00 of the same day in Rome. */
export const NOON_UTC = '2026-09-24T12:00:00Z';

/**
 * Fixes the system clock at `now`. Only `Date` is faked: promises, timers and React Query keep working.
 * Undo it with `vi.useRealTimers()` in `afterEach`.
 */
export function freezeClock(now: string | Date): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(now));
}

/**
 * Runs the tests of the enclosing `describe` with `timeZone` as the time zone of the browser (the `TZ` of the test
 * process, read by `Date` for local times), then restores the previous one.
 */
export function withBrowserTimeZone(timeZone: string): void {
  let previous: string | undefined;
  beforeAll(() => {
    previous = process.env.TZ;
    process.env.TZ = timeZone;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  });
}
