import { addDays, formatStayDate, isStayDate, nightsBetween } from '@/lib/stay-dates';

/**
 * The days the host selects on the calendar to block them, change their price or change their rules (E08/F05/US03/T02, NF-78). Pure, with no DOM and no clock: a
 * selection is one property and a range of calendar dates (`yyyy-MM-dd`, both ends included, each date is the night that starts on it), it never crosses a property row and
 * covers at most 366 days (the most a change of the calendar covers).
 */

export const MAX_SELECTION_DAYS = 366;

export interface DaySelection {
  propertyId: string;
  anchor: string;
  from: string;
  to: string;
}

export function startSelection(propertyId: string, day: string): DaySelection | null {
  return propertyId && isStayDate(day) ? { propertyId, anchor: day, from: day, to: day } : null;
}

/**
 * The selection extended to `day` from its anchor (the second click, Shift plus click, Shift plus arrow). It never crosses a property row: a day of another row starts a new
 * selection there. With no selection yet it starts one at `origin` (the day Shift plus arrow was pressed on) and extends it. It stops at `MAX_SELECTION_DAYS`: the end that
 * moves is held at the longest range, never beyond.
 */
export function extendSelection(selection: DaySelection | null, propertyId: string, day: string, origin: string = day): DaySelection | null {
  if (!isStayDate(day)) return selection;
  const base = selection && selection.propertyId === propertyId ? selection : startSelection(propertyId, origin);
  if (!base) return selection;
  const [from, to] = day < base.anchor ? [day, base.anchor] : [base.anchor, day];
  const longest = day < base.anchor ? { from: addDays(base.anchor, -(MAX_SELECTION_DAYS - 1)), to } : { from, to: addDays(base.anchor, MAX_SELECTION_DAYS - 1) };
  return {
    propertyId,
    anchor: base.anchor,
    from: from < longest.from ? longest.from : from,
    to: to > longest.to ? longest.to : to,
  };
}

export function pressDay(selection: DaySelection | null, propertyId: string, day: string, shift: boolean, origin: string = day): DaySelection | null {
  if (shift) return extendSelection(selection, propertyId, day, origin);
  if (selection && selection.propertyId === propertyId && selection.from === selection.to) return extendSelection(selection, propertyId, day);
  return startSelection(propertyId, day);
}

export function clearSelection(): null {
  return null;
}

export function selectedDays(selection: DaySelection | null): string[] {
  if (!selection) return [];
  const count = nightsBetween(selection.from, addDays(selection.to, 1));
  return Array.from({ length: count }, (_, index) => addDays(selection.from, index));
}

export function isDaySelected(selection: DaySelection | null, propertyId: string, day: string): boolean {
  return selection !== null && selection.propertyId === propertyId && day >= selection.from && day <= selection.to;
}

export function selectionOfDays(propertyId: string, days: readonly string[]): DaySelection | null {
  const valid = days.filter(isStayDate).sort();
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (!first || !last) return null;
  return extendSelection(startSelection(propertyId, first), propertyId, last);
}

export function selectionDatesText(selection: Pick<DaySelection, 'from' | 'to'>, language: string): string {
  const { from, to } = selection;
  if (from === to) return formatStayDate(from, language, { day: 'numeric', month: 'long' });
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${formatStayDate(from, language, { day: 'numeric' })}-${formatStayDate(to, language, { day: 'numeric', month: 'long' })}`;
  }
  const withYear: Intl.DateTimeFormatOptions = from.slice(0, 4) === to.slice(0, 4) ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' };
  return `${formatStayDate(from, language, withYear)} - ${formatStayDate(to, language, withYear)}`;
}
