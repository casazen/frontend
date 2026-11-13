import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freezeClock } from '@/test/clock';
import { WEEKDAYS } from '@/types/calendar-changes.types';
import {
  BULK_CHANGE_STEP,
  BULK_ERROR_KEYS,
  changedFields,
  changesStepSchema,
  emptyBulkChange,
  firstInvalidStep,
  periodDays,
  periodStepSchema,
  propertiesStepSchema,
  toChangeRequest,
  type BulkChangeValues,
} from './bulk-change-model';
import { emptyDayRules } from './day-rules-model';

const TODAY = '2026-09-12';

function values(changes: Partial<BulkChangeValues> = {}): BulkChangeValues {
  return {
    ...emptyBulkChange(TODAY),
    propertyIds: ['p1', 'p2'],
    from: '2026-09-12',
    to: '2026-10-12',
    rules: { ...emptyDayRules(), price: { action: 'Set', text: '120,5' } },
    ...changes,
  };
}

const messageOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) => result.error?.issues[0]?.message;

describe('the bulk change model (E08/F05/US03/T03)', () => {
  beforeEach(() => freezeClock('2026-09-12T10:00:00Z'));
  afterEach(() => vi.useRealTimers());

  it('emptyBulkChange_StartsOnTodayWithEveryWeekdayAndNothingChanged', () => {
    const empty = emptyBulkChange(TODAY);
    expect(empty).toMatchObject({ propertyIds: [], from: '2026-09-12', to: '2026-10-11', weekdays: [...WEEKDAYS] });
    expect(changedFields(empty.rules)).toEqual([]);
  });

  it('propertiesStepSchema_AtLeastOneAndAtMostFifty', () => {
    expect(messageOf(propertiesStepSchema.safeParse({ propertyIds: [] }))).toBe(BULK_ERROR_KEYS.propertiesRequired);
    expect(propertiesStepSchema.safeParse({ propertyIds: ['p1'] }).success).toBe(true);
    expect(messageOf(propertiesStepSchema.safeParse({ propertyIds: Array.from({ length: 51 }, (_, index) => `p${index}`) }))).toBe(BULK_ERROR_KEYS.propertiesTooMany);
  });

  it('periodStepSchema_FromAndToInOrder_AtMost366Days_NotEntirelyPast', () => {
    const period = (from: string, to: string, weekdays: string[] = [...WEEKDAYS]) => periodStepSchema.safeParse({ from, to, weekdays });

    expect(period('2026-09-12', '2026-10-12').success).toBe(true);
    // Partly past is fine (the days before today are left alone): a range that ends today or later.
    expect(period('2026-09-01', '2026-09-12').success).toBe(true);
    expect(messageOf(period('2026-10-12', '2026-09-12'))).toBe(BULK_ERROR_KEYS.toBeforeFrom);
    expect(messageOf(period('2026-09-01', '2026-09-11'))).toBe(BULK_ERROR_KEYS.allPast);
    // 366 days, both ends included, is the longest; one more is refused.
    expect(period('2026-09-12', '2027-09-12').success).toBe(true);
    expect(messageOf(period('2026-09-12', '2027-09-13'))).toBe(BULK_ERROR_KEYS.tooLong);
    expect(messageOf(period('', '2026-10-12'))).toBe(BULK_ERROR_KEYS.fromInvalid);
    expect(messageOf(period('2026-09-12', 'x'))).toBe(BULK_ERROR_KEYS.toInvalid);
    expect(messageOf(period('2026-09-12', '2026-10-12', []))).toBe(BULK_ERROR_KEYS.weekdaysRequired);
  });

  it('changesStepSchema_AtLeastOneValueChanges_AndWhatIsSetIsValid', () => {
    expect(changesStepSchema.safeParse({ rules: emptyDayRules() }).success).toBe(false);
    expect(changesStepSchema.safeParse({ rules: { ...emptyDayRules(), price: { action: 'Set', text: '120,5' } } }).success).toBe(true);
    expect(changesStepSchema.safeParse({ rules: { ...emptyDayRules(), price: { action: 'Set', text: '120.505' } } }).success).toBe(false);
    expect(changesStepSchema.safeParse({ rules: { ...emptyDayRules(), closedToArrival: { action: 'Clear', text: '' } } }).success).toBe(true);
  });

  it('firstInvalidStep_NamesTheStepThatIsWrong_OrNone', () => {
    expect(firstInvalidStep(values())).toBeNull();
    expect(firstInvalidStep(values({ propertyIds: [] }))).toBe(BULK_CHANGE_STEP.properties);
    expect(firstInvalidStep(values({ to: '2026-09-01' }))).toBe(BULK_CHANGE_STEP.period);
    expect(firstInvalidStep(values({ rules: emptyDayRules() }))).toBe(BULK_CHANGE_STEP.changes);
  });

  it('toChangeRequest_PriceTypedWithAComma_IsSentAsTheNumberTyped', () => {
    const request = toChangeRequest(values());

    expect(request.price).toEqual({ action: 'Set', value: 120.5 });
    expect(request).toMatchObject({ propertyIds: ['p1', 'p2'], from: '2026-09-12', to: '2026-10-12' });
    expect(request.minNights).toEqual({ action: 'Keep' });
    expect(JSON.parse(JSON.stringify(request)).price.value).toBe(120.5);
  });

  it('toChangeRequest_EveryWeekday_LeavesTheListOut_ASubsetIsSentInOrder_NeverAnEmptyList', () => {
    expect(toChangeRequest(values()).daysOfWeek).toBeUndefined();
    expect(toChangeRequest(values({ weekdays: ['Saturday', 'Friday'] })).daysOfWeek).toEqual(['Friday', 'Saturday']);
  });

  it('periodDays_BothEndsIncluded', () => {
    expect(periodDays('2026-09-12', '2026-09-12')).toBe(1);
    expect(periodDays('2026-09-12', '2026-10-12')).toBe(31);
    expect(periodDays('2026-10-12', '2026-09-12')).toBe(0);
    expect(periodDays('', '2026-09-12')).toBe(0);
  });
});
