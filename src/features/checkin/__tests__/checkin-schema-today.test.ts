import { afterEach, describe, expect, it, vi } from 'vitest';
import { stayGuestDefaults, stayGuestFormSchema } from '../schemas/checkin.schema';
import { LATE_EVENING_UTC, NOON_UTC, freezeClock, withBrowserTimeZone } from '@/test/clock';

function dateOfBirthIssues(dateOfBirth: string): string[] {
  const result = stayGuestFormSchema.safeParse({
    ...stayGuestDefaults('SingleGuest'),
    firstName: 'Giulia',
    lastName: 'Bianchi',
    gender: 'Female',
    dateOfBirth,
    bornInItaly: 'no',
    birthCountryName: 'Francia',
    citizenshipName: 'Francia',
    documentType: 'IdentityCard',
    documentNumber: 'AB1234567',
    documentIssuePlaceName: 'Francia',
  });
  return result.success
    ? []
    : result.error.issues.filter((issue) => issue.path[0] === 'dateOfBirth').map((issue) => issue.message);
}

describe('stayGuestFormSchema date of birth in the future (QA-CLOCK-FE)', () => {
  // A guest in New York: at 19:30 of the 24th there it is already the 25th in Rome, as for the backend.
  withBrowserTimeZone('America/New_York');

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stayGuestFormSchema_BornTodayInRomeAt2330Utc_IsAccepted', () => {
    freezeClock(LATE_EVENING_UTC);

    expect(dateOfBirthIssues('2026-09-25')).toEqual([]);
  });

  it('stayGuestFormSchema_BornTomorrowInRomeAt2330Utc_IsInTheFuture', () => {
    freezeClock(LATE_EVENING_UTC);

    expect(dateOfBirthIssues('2026-09-26')).toEqual(['checkin.validation.dateOfBirth.future']);
  });

  it('stayGuestFormSchema_AtNoonUtc_TomorrowIsInTheFuture', () => {
    freezeClock(NOON_UTC);

    expect(dateOfBirthIssues('2026-09-24')).toEqual([]);
    expect(dateOfBirthIssues('2026-09-25')).toEqual(['checkin.validation.dateOfBirth.future']);
  });
});
