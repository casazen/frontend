import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import type { CalendarChangeRequest, FieldPatch } from '@/types/calendar-changes.types';
import type { CalendarDayInfo, DayPriceSource } from '@/types/calendar-days.types';
import type { DaySelection } from './day-selection';

/**
 * The form model of a change of price and rules (E08/F05/US03/T02, NF-36, NF-78): the seven values of a night, each left as it is (`Keep`), set (`Set`, with what was typed) or
 * cleared (`Clear`), the Zod schema that checks them (messages are i18n keys) and the request it becomes. The price is typed as text (`120`, `120,5`, `120.50`), has at most two
 * decimals and sits between 0,01 and 100.000, and is sent as the number typed: the browser rounds nothing, the amount in the request is the amount the host wrote.
 */

/** The bounds of the values of a night, the ones of the API (`DayRuleLimits`). */
export const DAY_RULE_LIMITS = {
  minPrice: 0.01,
  maxPrice: 100_000,
  minStay: 1,
  maxStay: 365,
  minAdvance: 0,
  maxAdvance: 730,
} as const;

export const DAY_RULE_FIELDS = ['price', 'minNights', 'maxNights', 'closedToArrival', 'closedToDeparture', 'minAdvanceDays', 'maxAdvanceDays'] as const;
export type DayRuleField = (typeof DAY_RULE_FIELDS)[number];

/** The fields that hold a number the host types (the others are flags). */
export type NumberRuleField = Exclude<DayRuleField, 'closedToArrival' | 'closedToDeparture'>;

export type FieldAction = 'Keep' | 'Set' | 'Clear';

/** What the form holds for one value: what to do to it and, to set it, what was typed (a flag has no text: `Set` is "on", `Clear` is "off"). */
export interface RuleEdit {
  action: FieldAction;
  text: string;
}

export type DayRulesValues = Record<DayRuleField, RuleEdit>;

export const KEEP: RuleEdit = { action: 'Keep', text: '' };

/** The form of a change that touches nothing yet. */
export function emptyDayRules(): DayRulesValues {
  return {
    price: KEEP,
    minNights: KEEP,
    maxNights: KEEP,
    closedToArrival: KEEP,
    closedToDeparture: KEEP,
    minAdvanceDays: KEEP,
    maxAdvanceDays: KEEP,
  };
}

/** At least one value is set or cleared: a change that keeps all seven changes nothing and is not sent. */
export function hasChange(values: DayRulesValues): boolean {
  return DAY_RULE_FIELDS.some((field) => values[field].action !== 'Keep');
}

/* ----------------------------------------------------------------------------------------------------------------------- Price */

export type PriceProblem = 'required' | 'invalid' | 'decimals' | 'range';

const PRICE_TEXT = /^(\d{1,7})(?:[.,](\d+))?$/;

/**
 * The price a host typed, as the number it stands for, or what is wrong with it: `120`, `120,5` and `120.50` are fine; `120.505` has too many decimals, `0` and `100000.01` are out
 * of bounds, anything else (thousands separators, signs, letters) is not a price. Nothing is rounded: the value is exactly the digits written.
 */
export function parsePriceText(text: string): { value: number; problem?: undefined } | { value?: undefined; problem: PriceProblem } {
  const typed = text.trim();
  if (typed === '') return { problem: 'required' };
  const match = PRICE_TEXT.exec(typed);
  if (!match) return { problem: 'invalid' };
  const [, whole, decimals = ''] = match;
  if (decimals.length > 2) return { problem: 'decimals' };
  const value = Number(decimals ? `${whole}.${decimals}` : whole);
  if (value < DAY_RULE_LIMITS.minPrice || value > DAY_RULE_LIMITS.maxPrice) return { problem: 'range' };
  return { value };
}

/** The number of nights or of days a host typed, a whole number within the bounds of the field, or what is wrong with it. */
function parseWholeNumber(text: string, min: number, max: number): { value: number; problem?: undefined } | { value?: undefined; problem: 'required' | 'invalid' | 'range' } {
  const typed = text.trim();
  if (typed === '') return { problem: 'required' };
  if (!/^\d{1,6}$/.test(typed)) return { problem: 'invalid' };
  const value = Number(typed);
  return value < min || value > max ? { problem: 'range' } : { value };
}

const BOUNDS: Record<Exclude<NumberRuleField, 'price'>, { min: number; max: number }> = {
  minNights: { min: DAY_RULE_LIMITS.minStay, max: DAY_RULE_LIMITS.maxStay },
  maxNights: { min: DAY_RULE_LIMITS.minStay, max: DAY_RULE_LIMITS.maxStay },
  minAdvanceDays: { min: DAY_RULE_LIMITS.minAdvance, max: DAY_RULE_LIMITS.maxAdvance },
  maxAdvanceDays: { min: DAY_RULE_LIMITS.minAdvance, max: DAY_RULE_LIMITS.maxAdvance },
};

/** The number a host typed in a field to set it, or `undefined` while it is empty or not valid. */
export function numberOf(field: NumberRuleField, edit: RuleEdit): number | undefined {
  if (field === 'price') return parsePriceText(edit.text).value;
  const { min, max } = BOUNDS[field];
  return parseWholeNumber(edit.text, min, max).value;
}

/* ----------------------------------------------------------------------------------------------------------------------- Schema */

/** The words of each problem, by key (`booking.calendar.dayRules.errors.*`), written out so that the i18n test finds a missing translation. */
export const DAY_RULE_ERROR_KEYS = {
  priceRequired: 'booking.calendar.dayRules.errors.priceRequired',
  priceInvalid: 'booking.calendar.dayRules.errors.priceInvalid',
  priceDecimals: 'booking.calendar.dayRules.errors.priceDecimals',
  priceRange: 'booking.calendar.dayRules.errors.priceRange',
  stayRequired: 'booking.calendar.dayRules.errors.stayRequired',
  stayInvalid: 'booking.calendar.dayRules.errors.stayInvalid',
  stayRange: 'booking.calendar.dayRules.errors.stayRange',
  advanceRequired: 'booking.calendar.dayRules.errors.advanceRequired',
  advanceInvalid: 'booking.calendar.dayRules.errors.advanceInvalid',
  advanceRange: 'booking.calendar.dayRules.errors.advanceRange',
  maxStayBelowMin: 'booking.calendar.dayRules.errors.maxStayBelowMin',
  maxAdvanceBelowMin: 'booking.calendar.dayRules.errors.maxAdvanceBelowMin',
  nothingToChange: 'booking.calendar.dayRules.errors.nothingToChange',
} as const;

function problemKey(field: NumberRuleField, edit: RuleEdit): string | null {
  if (edit.action !== 'Set') return null;
  if (field === 'price') {
    switch (parsePriceText(edit.text).problem) {
      case 'required':
        return DAY_RULE_ERROR_KEYS.priceRequired;
      case 'invalid':
        return DAY_RULE_ERROR_KEYS.priceInvalid;
      case 'decimals':
        return DAY_RULE_ERROR_KEYS.priceDecimals;
      case 'range':
        return DAY_RULE_ERROR_KEYS.priceRange;
      default:
        return null;
    }
  }
  const { min, max } = BOUNDS[field];
  const stay = field === 'minNights' || field === 'maxNights';
  switch (parseWholeNumber(edit.text, min, max).problem) {
    case 'required':
      return stay ? DAY_RULE_ERROR_KEYS.stayRequired : DAY_RULE_ERROR_KEYS.advanceRequired;
    case 'invalid':
      return stay ? DAY_RULE_ERROR_KEYS.stayInvalid : DAY_RULE_ERROR_KEYS.advanceInvalid;
    case 'range':
      return stay ? DAY_RULE_ERROR_KEYS.stayRange : DAY_RULE_ERROR_KEYS.advanceRange;
    default:
      return null;
  }
}

const ruleEditSchema = z.object({ action: z.enum(['Keep', 'Set', 'Clear']), text: z.string() });

/**
 * The rules of the form (messages are i18n keys, as in every form): a value that is set has to be valid (the price as `parsePriceText` says, the nights and the days whole and
 * within their bounds), a maximum stay is not below the minimum and a maximum advance is not below the minimum, when both are set. At least one value has to change.
 */
export const dayRulesSchema: ZodType<unknown, FieldValues> = z
  .object({
    price: ruleEditSchema,
    minNights: ruleEditSchema,
    maxNights: ruleEditSchema,
    closedToArrival: ruleEditSchema,
    closedToDeparture: ruleEditSchema,
    minAdvanceDays: ruleEditSchema,
    maxAdvanceDays: ruleEditSchema,
  })
  .superRefine((values, context) => {
    const rules = values as DayRulesValues;
    for (const field of ['price', 'minNights', 'maxNights', 'minAdvanceDays', 'maxAdvanceDays'] as const) {
      const key = problemKey(field, rules[field]);
      if (key) context.addIssue({ code: 'custom', message: key, path: [field, 'text'] });
    }
    const minNights = rules.minNights.action === 'Set' ? numberOf('minNights', rules.minNights) : undefined;
    const maxNights = rules.maxNights.action === 'Set' ? numberOf('maxNights', rules.maxNights) : undefined;
    if (minNights !== undefined && maxNights !== undefined && maxNights < minNights) {
      context.addIssue({ code: 'custom', message: DAY_RULE_ERROR_KEYS.maxStayBelowMin, path: ['maxNights', 'text'] });
    }
    const minAdvance = rules.minAdvanceDays.action === 'Set' ? numberOf('minAdvanceDays', rules.minAdvanceDays) : undefined;
    const maxAdvance = rules.maxAdvanceDays.action === 'Set' ? numberOf('maxAdvanceDays', rules.maxAdvanceDays) : undefined;
    if (minAdvance !== undefined && maxAdvance !== undefined && maxAdvance < minAdvance) {
      context.addIssue({ code: 'custom', message: DAY_RULE_ERROR_KEYS.maxAdvanceBelowMin, path: ['maxAdvanceDays', 'text'] });
    }
    if (!hasChange(rules)) context.addIssue({ code: 'custom', message: DAY_RULE_ERROR_KEYS.nothingToChange, path: [] });
  });

/** The problems of the form, by field (the key of the sentence of each); empty when the form can be sent. A problem of no field in particular is under `form`. */
export function dayRulesProblems(values: DayRulesValues): Partial<Record<DayRuleField | 'form', string>> {
  const result = dayRulesSchema.safeParse(values);
  if (result.success) return {};
  const problems: Partial<Record<DayRuleField | 'form', string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    const key = typeof field === 'string' && (DAY_RULE_FIELDS as readonly string[]).includes(field) ? (field as DayRuleField) : 'form';
    problems[key] ??= issue.message;
  }
  return problems;
}

/* ---------------------------------------------------------------------------------------------------------------------- Request */

function numberPatch(field: NumberRuleField, edit: RuleEdit): FieldPatch<number> {
  if (edit.action === 'Clear') return { action: 'Clear' };
  if (edit.action === 'Keep') return { action: 'Keep' };
  // The number typed, not rounded: a form that passed the schema has a value (a Set without one is refused before it gets here).
  const value = numberOf(field, edit);
  if (value === undefined) throw new Error(`The value of ${field} is not valid: the form is checked before it is sent`);
  return { action: 'Set', value };
}

function flagPatch(edit: RuleEdit): FieldPatch<boolean> {
  return edit.action === 'Set' ? { action: 'Set', value: true } : { action: edit.action === 'Clear' ? 'Clear' : 'Keep' };
}

/** What to do to each of the seven values, as the API reads it: an untouched field is `Keep`, a typed one `Set` (the number as typed), a cleared one `Clear`. */
export function toFieldPatches(values: DayRulesValues): Pick<CalendarChangeRequest, DayRuleField> {
  return {
    price: numberPatch('price', values.price),
    minNights: numberPatch('minNights', values.minNights),
    maxNights: numberPatch('maxNights', values.maxNights),
    closedToArrival: flagPatch(values.closedToArrival),
    closedToDeparture: flagPatch(values.closedToDeparture),
    minAdvanceDays: numberPatch('minAdvanceDays', values.minAdvanceDays),
    maxAdvanceDays: numberPatch('maxAdvanceDays', values.maxAdvanceDays),
  };
}

/** The request for the days of a selection (one property, from the first day to the last, both included). */
export function toChangeRequest(selection: DaySelection, values: DayRulesValues): CalendarChangeRequest {
  return { propertyIds: [selection.propertyId], from: selection.from, to: selection.to, ...toFieldPatches(values) };
}

/* --------------------------------------------------------------------------------------------------------------------- Current */

/** What the days of a selection hold for one value: the same value on every day, different values, or no value of its own. */
export type CurrentValue<T> = { kind: 'value'; value: T } | { kind: 'mixed' } | { kind: 'none' };

function currentOf<T>(values: readonly (T | undefined)[]): CurrentValue<T> {
  if (values.length === 0) return { kind: 'none' };
  const first = values[0];
  if (!values.every((value) => value === first)) return { kind: 'mixed' };
  return first === undefined ? { kind: 'none' } : { kind: 'value', value: first };
}

export interface CurrentRules {
  /** The price of the night in cents. */
  priceCents: CurrentValue<number>;
  /** Where the price comes from, when it is the same on every day. */
  priceSource: CurrentValue<DayPriceSource>;
  /** At least one night of the selection has a price of its own: "Back to the usual price" has something to clear. */
  hasPriceRule: boolean;
  minNights: CurrentValue<number>;
  maxNights: CurrentValue<number>;
  closedToArrival: CurrentValue<boolean>;
  closedToDeparture: CurrentValue<boolean>;
  minAdvanceDays: CurrentValue<number>;
  maxAdvanceDays: CurrentValue<number>;
}

/** What the nights of a selection hold now, from the day layer: the value the panel shows beside each field. The caller leaves out the nights that are over: the API does not change them. */
export function currentRules(days: readonly CalendarDayInfo[]): CurrentRules {
  return {
    priceCents: currentOf(days.map((day) => day.priceCents)),
    priceSource: currentOf(days.map((day) => day.priceSource)),
    hasPriceRule: days.some((day) => day.priceSource === 'DayRule'),
    minNights: currentOf(days.map((day) => day.minNights)),
    maxNights: currentOf(days.map((day) => day.maxNights)),
    closedToArrival: currentOf(days.map((day) => day.closedToArrival)),
    closedToDeparture: currentOf(days.map((day) => day.closedToDeparture)),
    minAdvanceDays: currentOf(days.map((day) => day.minAdvanceDays)),
    maxAdvanceDays: currentOf(days.map((day) => day.maxAdvanceDays)),
  };
}
