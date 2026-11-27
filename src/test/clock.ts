import { afterAll, beforeAll, vi } from 'vitest';

export const LATE_EVENING_UTC = '2026-09-24T23:30:00Z';

export const NOON_UTC = '2026-09-24T12:00:00Z';

export function freezeClock(now: string | Date): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(now));
}

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
