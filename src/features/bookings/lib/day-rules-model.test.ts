import { describe, expect, it } from 'vitest';
import type { CalendarDayInfo } from '@/types/calendar-days.types';
import {
  DAY_RULE_ERROR_KEYS,
  KEEP,
  currentRules,
  dayRulesProblems,
  emptyDayRules,
  hasChange,
  parsePriceText,
  toChangeRequest,
  type DayRulesValues,
} from './day-rules-model';
import { startSelection } from './day-selection';

const SELECTION = { propertyId: 'p1', anchor: '2026-09-12', from: '2026-09-12', to: '2026-09-14' };

function rules(changes: Partial<DayRulesValues>): DayRulesValues {
  return { ...emptyDayRules(), ...changes };
}

describe('price typed as text (E08/F05/US03/T02, money rule)', () => {
  it.each([
    ['120', 120],
    ['120,5', 120.5],
    ['120.50', 120.5],
    ['0,01', 0.01],
    ['100000', 100000],
    ['  95,99  ', 95.99],
    [',5', undefined],
  ])('parsePriceText_%s_IsTheNumberTyped', (text, expected) => {
    expect(parsePriceText(text).value).toBe(expected);
  });

  it.each([
    ['', 'required'],
    ['abc', 'invalid'],
    ['1.200,50', 'invalid'],
    ['-5', 'invalid'],
    ['120.505', 'decimals'],
    ['120,999', 'decimals'],
    ['0', 'range'],
    ['0,00', 'range'],
    ['100000,01', 'range'],
    ['100001', 'range'],
  ])('parsePriceText_%s_IsRefusedAs_%s', (text, problem) => {
    expect(parsePriceText(text).problem).toBe(problem);
  });

  it('toChangeRequest_PriceTypedWithAComma_IsSentAsTheNumberTypedAndNotRounded', () => {
    const request = toChangeRequest(SELECTION, rules({ price: { action: 'Set', text: '120,5' } }));
    expect(request.price).toEqual({ action: 'Set', value: 120.5 });
    // What goes on the wire is the same figure the host wrote.
    expect(JSON.parse(JSON.stringify(request)).price.value).toBe(120.5);
    expect(toChangeRequest(SELECTION, rules({ price: { action: 'Set', text: '99.99' } })).price.value).toBe(99.99);
  });
});

describe('the form model (E08/F05/US03/T02)', () => {
  it('toChangeRequest_UntouchedFieldsAreKeep_TypedAreSet_ClearedAreClear', () => {
    const request = toChangeRequest(
      SELECTION,
      rules({
        minNights: { action: 'Set', text: '2' },
        maxNights: { action: 'Clear', text: '' },
        closedToArrival: { action: 'Set', text: '' },
        closedToDeparture: { action: 'Clear', text: '' },
      }),
    );
    expect(request).toEqual({
      propertyIds: ['p1'],
      from: '2026-09-12',
      to: '2026-09-14',
      price: { action: 'Keep' },
      minNights: { action: 'Set', value: 2 },
      maxNights: { action: 'Clear' },
      closedToArrival: { action: 'Set', value: true },
      closedToDeparture: { action: 'Clear' },
      minAdvanceDays: { action: 'Keep' },
      maxAdvanceDays: { action: 'Keep' },
    });
  });

  it('hasChange_AFormThatKeepsEverything_ChangesNothing', () => {
    expect(hasChange(emptyDayRules())).toBe(false);
    expect(hasChange(rules({ price: { action: 'Clear', text: '' } }))).toBe(true);
  });

  it('dayRulesProblems_NothingChanged_SaysSo', () => {
    expect(dayRulesProblems(emptyDayRules())).toEqual({ form: DAY_RULE_ERROR_KEYS.nothingToChange });
  });

  it('dayRulesProblems_ASetValueThatIsNotValid_IsRefusedBeforeSending', () => {
    expect(dayRulesProblems(rules({ price: { action: 'Set', text: '120.505' } })).price).toBe(DAY_RULE_ERROR_KEYS.priceDecimals);
    expect(dayRulesProblems(rules({ price: { action: 'Set', text: '0' } })).price).toBe(DAY_RULE_ERROR_KEYS.priceRange);
    expect(dayRulesProblems(rules({ minNights: { action: 'Set', text: '0' } })).minNights).toBe(DAY_RULE_ERROR_KEYS.stayRange);
    expect(dayRulesProblems(rules({ maxNights: { action: 'Set', text: '366' } })).maxNights).toBe(DAY_RULE_ERROR_KEYS.stayRange);
    expect(dayRulesProblems(rules({ minAdvanceDays: { action: 'Set', text: '731' } })).minAdvanceDays).toBe(DAY_RULE_ERROR_KEYS.advanceRange);
    expect(dayRulesProblems(rules({ minAdvanceDays: { action: 'Set', text: '2,5' } })).minAdvanceDays).toBe(DAY_RULE_ERROR_KEYS.advanceInvalid);
    expect(dayRulesProblems(rules({ minNights: { action: 'Set', text: '' } })).minNights).toBe(DAY_RULE_ERROR_KEYS.stayRequired);
  });

  it('dayRulesProblems_ValidValues_HaveNoProblem', () => {
    expect(
      dayRulesProblems(
        rules({
          price: { action: 'Set', text: '120,5' },
          minNights: { action: 'Set', text: '2' },
          maxNights: { action: 'Set', text: '14' },
          minAdvanceDays: { action: 'Set', text: '0' },
          maxAdvanceDays: { action: 'Set', text: '730' },
        }),
      ),
    ).toEqual({});
  });

  it('dayRulesProblems_MaximumBelowMinimum_IsRefused', () => {
    expect(dayRulesProblems(rules({ minNights: { action: 'Set', text: '5' }, maxNights: { action: 'Set', text: '3' } })).maxNights).toBe(DAY_RULE_ERROR_KEYS.maxStayBelowMin);
    expect(dayRulesProblems(rules({ minAdvanceDays: { action: 'Set', text: '10' }, maxAdvanceDays: { action: 'Set', text: '2' } })).maxAdvanceDays).toBe(
      DAY_RULE_ERROR_KEYS.maxAdvanceBelowMin,
    );
  });

  it('toChangeRequest_AValueTheFormRefuses_IsNeverBuilt', () => {
    expect(() => toChangeRequest(SELECTION, rules({ price: { action: 'Set', text: '0' } }))).toThrow();
  });

  it('startSelection_ThenRequest_CoversTheDaysOfTheSelection', () => {
    const selection = startSelection('p9', '2026-10-25');
    expect(selection).not.toBeNull();
    const request = toChangeRequest(selection!, rules({ price: KEEP, minNights: { action: 'Set', text: '3' } }));
    expect(request).toMatchObject({ propertyIds: ['p9'], from: '2026-10-25', to: '2026-10-25' });
  });
});

describe('current values of a selection (E08/F05/US03/T02)', () => {
  const day = (changes: Partial<CalendarDayInfo>): CalendarDayInfo => ({
    date: '2026-09-12',
    priceCents: 12000,
    priceSource: 'Base',
    minNights: 1,
    closedToArrival: false,
    closedToDeparture: false,
    hasRule: false,
    taken: false,
    ...changes,
  });

  it('currentRules_TheSameOnEveryDay_IsThatValue_DifferentIsMixed_NoneIsNone', () => {
    const current = currentRules([day({ minNights: 2, maxNights: 7 }), day({ minNights: 2 })]);
    expect(current.priceCents).toEqual({ kind: 'value', value: 12000 });
    expect(current.priceSource).toEqual({ kind: 'value', value: 'Base' });
    expect(current.minNights).toEqual({ kind: 'value', value: 2 });
    expect(current.maxNights).toEqual({ kind: 'mixed' });
    expect(current.minAdvanceDays).toEqual({ kind: 'none' });
    expect(current.hasPriceRule).toBe(false);
  });

  it('currentRules_ANightWithAPriceOfItsOwn_HasSomethingToGoBackFrom', () => {
    expect(currentRules([day({}), day({ priceSource: 'DayRule', priceCents: 15000, hasRule: true })]).hasPriceRule).toBe(true);
    expect(currentRules([]).priceCents).toEqual({ kind: 'none' });
  });
});
