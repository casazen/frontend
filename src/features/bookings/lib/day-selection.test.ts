import { describe, expect, it } from 'vitest';
import {
  MAX_SELECTION_DAYS,
  clearSelection,
  extendSelection,
  isDaySelected,
  pressDay,
  selectedDays,
  selectionDatesText,
  selectionOfDays,
  startSelection,
} from './day-selection';

describe('day selection (E08/F05/US03/T02)', () => {
  it('startSelection_ACalendarDay_IsOneDayOfOneProperty', () => {
    expect(startSelection('p1', '2026-09-12')).toEqual({ propertyId: 'p1', anchor: '2026-09-12', from: '2026-09-12', to: '2026-09-12' });
    expect(startSelection('p1', 'not a date')).toBeNull();
    expect(startSelection('', '2026-09-12')).toBeNull();
  });

  it('extendSelection_SecondClickAfterOrBeforeTheAnchor_KeepsTheAnchorAndOrdersTheRange', () => {
    const first = startSelection('p1', '2026-09-12');
    expect(extendSelection(first, 'p1', '2026-09-15')).toMatchObject({ anchor: '2026-09-12', from: '2026-09-12', to: '2026-09-15' });
    expect(extendSelection(first, 'p1', '2026-09-10')).toMatchObject({ anchor: '2026-09-12', from: '2026-09-10', to: '2026-09-12' });
    // Extending again moves the end that is not the anchor.
    const wide = extendSelection(first, 'p1', '2026-09-20');
    expect(extendSelection(wide, 'p1', '2026-09-14')).toMatchObject({ from: '2026-09-12', to: '2026-09-14' });
  });

  it('extendSelection_ADayOfAnotherProperty_NeverCrossesTheRow', () => {
    const first = startSelection('p1', '2026-09-12');
    expect(extendSelection(first, 'p2', '2026-09-15')).toEqual({ propertyId: 'p2', anchor: '2026-09-15', from: '2026-09-15', to: '2026-09-15' });
  });

  it('extendSelection_NoSelectionYet_StartsAtTheOriginAndExtends', () => {
    // Shift plus arrow on a day with nothing selected: the range runs from that day to the next.
    expect(extendSelection(null, 'p1', '2026-09-13', '2026-09-12')).toMatchObject({ anchor: '2026-09-12', from: '2026-09-12', to: '2026-09-13' });
  });

  it('extendSelection_MoreThan366Days_IsHeldAtTheLongestRange', () => {
    const first = startSelection('p1', '2026-01-01');
    const wide = extendSelection(first, 'p1', '2028-01-01');
    expect(wide).not.toBeNull();
    expect(selectedDays(wide)).toHaveLength(MAX_SELECTION_DAYS);
    expect(wide?.from).toBe('2026-01-01');
    // The same going back from the anchor.
    const back = extendSelection(startSelection('p1', '2026-12-31'), 'p1', '2024-01-01');
    expect(selectedDays(back)).toHaveLength(MAX_SELECTION_DAYS);
    expect(back?.to).toBe('2026-12-31');
  });

  it('pressDay_FirstPressStarts_SecondPressOnTheSameRowExtends_AThirdStartsAgain', () => {
    const first = pressDay(null, 'p1', '2026-09-12', false);
    expect(first).toMatchObject({ from: '2026-09-12', to: '2026-09-12' });
    const second = pressDay(first, 'p1', '2026-09-14', false);
    expect(second).toMatchObject({ from: '2026-09-12', to: '2026-09-14' });
    const third = pressDay(second, 'p1', '2026-09-20', false);
    expect(third).toMatchObject({ from: '2026-09-20', to: '2026-09-20' });
  });

  it('pressDay_WithShift_ExtendsARangeToo', () => {
    const range = pressDay(pressDay(null, 'p1', '2026-09-12', false), 'p1', '2026-09-14', false);
    expect(pressDay(range, 'p1', '2026-09-18', true)).toMatchObject({ anchor: '2026-09-12', from: '2026-09-12', to: '2026-09-18' });
  });

  it('pressDay_ShiftArrowWithNothingSelected_StartsOnTheDayItWasPressedOnAndExtends', () => {
    expect(pressDay(null, 'p1', '2026-09-13', true, '2026-09-12')).toMatchObject({ anchor: '2026-09-12', from: '2026-09-12', to: '2026-09-13' });
  });

  it('clearSelection_Escape_SelectsNothing', () => {
    expect(clearSelection()).toBeNull();
  });

  it('selectedDays_ARange_ListsEveryNightInOrder', () => {
    expect(selectedDays(extendSelection(startSelection('p1', '2026-09-29'), 'p1', '2026-10-02'))).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(selectedDays(null)).toEqual([]);
  });

  it('selectedDays_TheNightOfTheSummerTimeChange_IsNeverShifted', () => {
    // Dates are calendar dates read as written: 25 October 2026 is the night the clocks go back, and it is the 25th in any time zone.
    expect(selectedDays(extendSelection(startSelection('p1', '2026-10-24'), 'p1', '2026-10-26'))).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });

  it('isDaySelected_OnlyOnTheRowAndInTheRange', () => {
    const selection = extendSelection(startSelection('p1', '2026-09-12'), 'p1', '2026-09-14');
    expect(isDaySelected(selection, 'p1', '2026-09-13')).toBe(true);
    expect(isDaySelected(selection, 'p1', '2026-09-15')).toBe(false);
    expect(isDaySelected(selection, 'p2', '2026-09-13')).toBe(false);
    expect(isDaySelected(null, 'p1', '2026-09-13')).toBe(false);
  });

  it('selectionOfDays_ADragOfTheLibrary_IsTheFirstAndTheLastNight', () => {
    expect(selectionOfDays('p1', ['2026-09-14', '2026-09-12', '2026-09-13'])).toMatchObject({ from: '2026-09-12', to: '2026-09-14' });
    expect(selectionOfDays('p1', [])).toBeNull();
  });

  it('selectionDatesText_SaysTheRangeInWords', () => {
    expect(selectionDatesText({ from: '2026-09-12', to: '2026-09-12' }, 'it')).toBe('12 settembre');
    expect(selectionDatesText({ from: '2026-09-12', to: '2026-09-15' }, 'it')).toBe('12-15 settembre');
    expect(selectionDatesText({ from: '2026-09-28', to: '2026-10-02' }, 'it')).toBe('28 settembre - 2 ottobre');
    expect(selectionDatesText({ from: '2026-12-30', to: '2027-01-02' }, 'it')).toContain('2027');
  });
});
