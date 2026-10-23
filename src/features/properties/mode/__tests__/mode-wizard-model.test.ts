import { describe, expect, it } from 'vitest';
import type { PropertyModeBlocker } from '@/types/property-mode.types';
import {
  MODE_WIZARD_DRAFT_EXCLUDE,
  blockerPath,
  draftLeases,
  isBookingBlocker,
  lastPossibleDate,
  lastToFree,
  modeStepSchemas,
} from '../mode-wizard-model';
import {
  ACCOUNT_PROPERTIES_PATH,
  areaOfMode,
  entryFromSearch,
  exitPathFor,
  listPathFor,
  oppositeMode,
  propertyDetailPath,
  propertyModeBasePath,
  propertyModePath,
} from '../paths';

function blocker(overrides: Partial<PropertyModeBlocker> = {}): PropertyModeBlocker {
  return {
    id: 'b1',
    kind: 'Stay',
    start: '2026-11-01',
    end: '2026-11-08',
    freeFrom: '2026-11-09',
    status: 'Confirmed',
    source: 'Direct',
    ...overrides,
  };
}

describe('lastPossibleDate', () => {
  it('lastPossibleDate_AnyDay_IsTenYearsLater', () => {
    expect(lastPossibleDate('2026-10-16')).toBe('2036-10-16');
    expect(lastPossibleDate('2026-12-31')).toBe('2036-12-31');
  });

  it('lastPossibleDate_TwentyNinthOfFebruary_GoesToTheTwentyEighthLikeTheBackend', () => {
    // 2028 is a leap year, 2038 is not: DateTime.AddYears(10) of 29 February lands on 28 February.
    expect(lastPossibleDate('2028-02-29')).toBe('2038-02-28');
    // 2020 -> 2030: neither is a problem for a normal day.
    expect(lastPossibleDate('2020-02-28')).toBe('2030-02-28');
  });

  it('lastPossibleDate_NotADate_IsEmpty', () => {
    expect(lastPossibleDate('')).toBe('');
    expect(lastPossibleDate('2026-02-30')).toBe('');
  });
});

describe('modeStepSchemas', () => {
  const bounds = { earliest: '2026-11-15', latest: '2036-10-16' };
  const { date, checks } = modeStepSchemas(bounds);

  const issueOf = (result: ReturnType<typeof date.safeParse>) => (result.success ? null : result.error.issues[0]?.message);

  it('date_AValidDayInsideTheBounds_Passes', () => {
    expect(date.safeParse({ date: '2026-11-15' }).success).toBe(true);
    expect(date.safeParse({ date: '2030-01-01' }).success).toBe(true);
    expect(date.safeParse({ date: '2036-10-16' }).success).toBe(true);
  });

  it('date_EmptyOrNotARealDay_AsksForTheDay', () => {
    expect(issueOf(date.safeParse({ date: '' }))).toBe('propertyMode.errors.dateInvalid');
    expect(issueOf(date.safeParse({ date: '2026-02-30' }))).toBe('propertyMode.errors.dateInvalid');
    expect(issueOf(date.safeParse({ date: 'domani' }))).toBe('propertyMode.errors.dateInvalid');
  });

  it('date_BeforeTheFirstPossibleDay_IsTooEarly', () => {
    expect(issueOf(date.safeParse({ date: '2026-11-14' }))).toBe('propertyMode.errors.dateTooEarly');
  });

  it('date_AfterTenYears_IsTooFar', () => {
    expect(issueOf(date.safeParse({ date: '2036-10-17' }))).toBe('propertyMode.errors.dateTooFar');
  });

  it('checks_OnlyOpensTheWayWhenTheServerSaidYes', () => {
    expect(checks.safeParse({ checksOk: true }).success).toBe(true);
    expect(issueOf(checks.safeParse({ checksOk: false }))).toBe('propertyMode.errors.checksFailed');
  });

  it('modeStepSchemas_OnlyTheDateAndTheChecksHaveRules_TheChoiceAndTheConfirmationHaveNone', () => {
    // The only choice is already made, and the confirmation has nothing to check: the wizard gives them no schema.
    expect(Object.keys(modeStepSchemas(bounds))).toEqual(['date', 'checks']);
  });

  it('theDraft_NeverKeepsTheResultOfTheChecks', () => {
    expect(MODE_WIZARD_DRAFT_EXCLUDE).toContain('checksOk');
  });
});

describe('blockers', () => {
  it('lastToFree_SeveralBlockers_IsTheOneThatFreesThePropertyLast', () => {
    const early = blocker({ id: 'a', freeFrom: '2026-11-09' });
    const late = blocker({ id: 'b', kind: 'ImportedBlock', freeFrom: '2026-12-02' });
    const middle = blocker({ id: 'c', freeFrom: '2026-11-20' });
    expect(lastToFree([early, late, middle])?.id).toBe('b');
  });

  it('lastToFree_OnlyDraftsOrNothing_IsNull', () => {
    expect(lastToFree([])).toBeNull();
    expect(lastToFree([blocker({ kind: 'DraftLease', freeFrom: null })])).toBeNull();
  });

  it('draftLeases_KeepsOnlyTheDrafts', () => {
    const draft = blocker({ id: 'd', kind: 'DraftLease', freeFrom: null });
    expect(draftLeases([blocker(), draft])).toEqual([draft]);
  });

  it('isBookingBlocker_StaysAndPortalBlocksAreBookings_LeasesAreNot', () => {
    expect(isBookingBlocker(blocker({ kind: 'Stay' }))).toBe(true);
    expect(isBookingBlocker(blocker({ kind: 'ImportedBlock' }))).toBe(true);
    expect(isBookingBlocker(blocker({ kind: 'Lease' }))).toBe(false);
    expect(isBookingBlocker(blocker({ kind: 'DraftLease' }))).toBe(false);
  });

  it('blockerPath_LeadsToWhereEachThingIsDealtWith', () => {
    expect(blockerPath(blocker({ id: 's1', kind: 'Stay' }), 'p1')).toBe('/app/short-rent/bookings/s1');
    expect(blockerPath(blocker({ id: 'i1', kind: 'ImportedBlock' }), 'p1')).toBe('/app/short-rent/properties/p1?tab=ical');
    expect(blockerPath(blocker({ id: 'l1', kind: 'Lease' }), 'p1')).toBe('/app/long-rent/leases/l1');
    expect(blockerPath(blocker({ id: 'd1', kind: 'DraftLease' }), 'p1')).toBe('/app/long-rent/leases/d1');
  });
});

describe('paths', () => {
  it('areaOfMode_AndOppositeMode_MapTheTwoSections', () => {
    expect(areaOfMode('Short')).toBe('short-rent');
    expect(areaOfMode('Long')).toBe('long-rent');
    expect(oppositeMode('Short')).toBe('Long');
    expect(oppositeMode('Long')).toBe('Short');
  });

  it('propertyModePath_KeepsWhereThePersonCameFrom', () => {
    expect(propertyModeBasePath('short-rent', 'p1')).toBe('/app/short-rent/properties/p1/mode');
    expect(propertyModePath('long-rent', 'p1')).toBe('/app/long-rent/properties/p1/mode');
    expect(propertyModePath('short-rent', 'p1', 'account')).toBe('/app/short-rent/properties/p1/mode?from=account');
  });

  it('entryFromSearch_OnlyTheAccountMeansSomething', () => {
    expect(entryFromSearch(new URLSearchParams('from=account'))).toBe('account');
    expect(entryFromSearch(new URLSearchParams('from=other'))).toBe('property');
    expect(entryFromSearch(new URLSearchParams(''))).toBe('property');
  });

  it('theWayOutAndTheWayBack_FollowTheEntry', () => {
    expect(listPathFor('short-rent', 'property')).toBe('/app/short-rent/properties');
    expect(listPathFor('long-rent', 'property')).toBe('/app/long-rent/properties');
    expect(listPathFor('short-rent', 'account')).toBe(ACCOUNT_PROPERTIES_PATH);
    expect(exitPathFor('short-rent', 'p1', 'property')).toBe(propertyDetailPath('short-rent', 'p1'));
    expect(exitPathFor('short-rent', 'p1', 'account')).toBe(ACCOUNT_PROPERTIES_PATH);
    expect(ACCOUNT_PROPERTIES_PATH).toBe('/app/account/properties');
  });
});
