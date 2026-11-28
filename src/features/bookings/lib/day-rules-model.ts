import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import type { CalendarChangeRequest, FieldPatch } from '@/types/calendar-changes.types';
import type { CalendarDayInfo, DayPriceSource } from '@/types/calendar-days.types';
import type { DaySelection } from './day-selection';

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

export type NumberRuleField = Exclude<DayRuleField, 'closedToArrival' | 'closedToDeparture'>;

export type FieldAction = 'Keep' | 'Set' | 'Clear';

export interface RuleEdit {
  action: FieldAction;
  text: string;
}

export type DayRulesValues = Record<DayRuleField, RuleEdit>;

export const KEEP: RuleEdit = { action: 'Keep', text: '' };

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

export function hasChange(values: DayRulesValues): boolean {
  return DAY_RULE_FIELDS.some((field) => values[field].action !== 'Keep');
}

export type PriceProblem = 'required' | 'invalid' | 'decimals' | 'range';

const PRICE_TEXT = /^(\d{1,7})(?:[.,](\d+))?$/;

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

export function numberOf(field: NumberRuleField, edit: RuleEdit): number | undefined {
  if (field === 'price') return parsePriceText(edit.text).value;
  const { min, max } = BOUNDS[field];
  return parseWholeNumber(edit.text, min, max).value;
}

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

function numberPatch(field: NumberRuleField, edit: RuleEdit): FieldPatch<number> {
  if (edit.action === 'Clear') return { action: 'Clear' };
  if (edit.action === 'Keep') return { action: 'Keep' };
  const value = numberOf(field, edit);
  if (value === undefined) throw new Error(`The value of ${field} is not valid: the form is checked before it is sent`);
  return { action: 'Set', value };
}

function flagPatch(edit: RuleEdit): FieldPatch<boolean> {
  return edit.action === 'Set' ? { action: 'Set', value: true } : { action: edit.action === 'Clear' ? 'Clear' : 'Keep' };
}

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

export function toChangeRequest(selection: DaySelection, values: DayRulesValues): CalendarChangeRequest {
  return { propertyIds: [selection.propertyId], from: selection.from, to: selection.to, ...toFieldPatches(values) };
}

export type CurrentValue<T> = { kind: 'value'; value: T } | { kind: 'mixed' } | { kind: 'none' };

function currentOf<T>(values: readonly (T | undefined)[]): CurrentValue<T> {
  if (values.length === 0) return { kind: 'none' };
  const first = values[0];
  if (!values.every((value) => value === first)) return { kind: 'mixed' };
  return first === undefined ? { kind: 'none' } : { kind: 'value', value: first };
}

export interface CurrentRules {
  priceCents: CurrentValue<number>;
  priceSource: CurrentValue<DayPriceSource>;
  hasPriceRule: boolean;
  minNights: CurrentValue<number>;
  maxNights: CurrentValue<number>;
  closedToArrival: CurrentValue<boolean>;
  closedToDeparture: CurrentValue<boolean>;
  minAdvanceDays: CurrentValue<number>;
  maxAdvanceDays: CurrentValue<number>;
}

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
