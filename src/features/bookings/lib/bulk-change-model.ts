import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { addDays, isStayDate, nightsBetween, todayInRome } from '@/lib/stay-dates';
import { WEEKDAYS, type CalendarChangeRequest, type Weekday } from '@/types/calendar-changes.types';
import { DAY_RULE_FIELDS, dayRulesSchema, emptyDayRules, toFieldPatches, type DayRuleField, type DayRulesValues } from './day-rules-model';

/**
 * The model of the bulk change wizard (E08/F05/US03/T03, NF-78, NF-05): the steps, the rules of each step (Zod schemas whose messages are i18n keys), the values and the request they
 * become. The seven values of a night and the way a price is typed are the model of the day panel (`day-rules-model`): the price is text, sent as the number typed.
 */

/** The steps of the wizard, in order: which properties, which days, what changes and the summary that says it all before anything is sent. */
export const BULK_CHANGE_STEP = { properties: 'properties', period: 'period', changes: 'changes', summary: 'summary' } as const;
export type BulkChangeStep = (typeof BULK_CHANGE_STEP)[keyof typeof BULK_CHANGE_STEP];

/** The most properties one change covers, and the most days (both ends included): the limits of the API. */
export const BULK_MAX_PROPERTIES = 50;
export const BULK_MAX_DAYS = 366;

export interface BulkChangeValues {
  propertyIds: string[];
  /** First day (`yyyy-MM-dd`). */
  from: string;
  /** Last day, included. */
  to: string;
  /** The weekdays to touch: every one by default. */
  weekdays: Weekday[];
  /** What to do to each of the seven values: leave it, set it (the price as typed) or clear it. */
  rules: DayRulesValues;
}

/** The wizard of a host that has chosen nothing: today and the 30 days after it, every weekday, nothing changed. */
export function emptyBulkChange(today: string = todayInRome()): BulkChangeValues {
  return { propertyIds: [], from: today, to: addDays(today, 29), weekdays: [...WEEKDAYS], rules: emptyDayRules() };
}

/** The words of each problem of the first two steps, by key, written out so that the i18n test finds a missing translation. */
export const BULK_ERROR_KEYS = {
  propertiesRequired: 'booking.calendar.bulk.errors.propertiesRequired',
  propertiesTooMany: 'booking.calendar.bulk.errors.propertiesTooMany',
  fromInvalid: 'booking.calendar.bulk.errors.fromInvalid',
  toInvalid: 'booking.calendar.bulk.errors.toInvalid',
  toBeforeFrom: 'booking.calendar.bulk.errors.toBeforeFrom',
  tooLong: 'booking.calendar.bulk.errors.tooLong',
  allPast: 'booking.calendar.bulk.errors.allPast',
  weekdaysRequired: 'booking.calendar.bulk.errors.weekdaysRequired',
} as const;

/** The days of the period that a change covers, both ends included; 0 when the period is not a period. */
export function periodDays(from: string, to: string): number {
  return isStayDate(from) && isStayDate(to) && to >= from ? nightsBetween(from, addDays(to, 1)) : 0;
}

export const propertiesStepSchema: ZodType<unknown, FieldValues> = z.object({
  propertyIds: z.array(z.string()).min(1, BULK_ERROR_KEYS.propertiesRequired).max(BULK_MAX_PROPERTIES, BULK_ERROR_KEYS.propertiesTooMany),
});

/** From and to are days, in order, at most 366 days apart and not entirely over; at least one weekday. */
export const periodStepSchema: ZodType<unknown, FieldValues> = z
  .object({ from: z.string(), to: z.string(), weekdays: z.array(z.enum(WEEKDAYS)).min(1, BULK_ERROR_KEYS.weekdaysRequired) })
  .superRefine((period, context) => {
    if (!isStayDate(period.from)) context.addIssue({ code: 'custom', message: BULK_ERROR_KEYS.fromInvalid, path: ['from'] });
    if (!isStayDate(period.to)) context.addIssue({ code: 'custom', message: BULK_ERROR_KEYS.toInvalid, path: ['to'] });
    if (!isStayDate(period.from) || !isStayDate(period.to)) return;
    if (period.to < period.from) context.addIssue({ code: 'custom', message: BULK_ERROR_KEYS.toBeforeFrom, path: ['to'] });
    else if (periodDays(period.from, period.to) > BULK_MAX_DAYS) context.addIssue({ code: 'custom', message: BULK_ERROR_KEYS.tooLong, path: ['to'] });
    else if (period.to < todayInRome()) context.addIssue({ code: 'custom', message: BULK_ERROR_KEYS.allPast, path: ['to'] });
  });

/** The seven values, as the day panel checks them: what is set has to be valid, and at least one value has to change. */
export const changesStepSchema: ZodType<unknown, FieldValues> = z.object({ rules: dayRulesSchema });

/** The first step whose rules the values do not meet, or `null` when the summary can be built (a draft or an address can open the wizard on any step). */
export function firstInvalidStep(values: BulkChangeValues): BulkChangeStep | null {
  if (!propertiesStepSchema.safeParse(values).success) return BULK_CHANGE_STEP.properties;
  if (!periodStepSchema.safeParse(values).success) return BULK_CHANGE_STEP.period;
  if (!changesStepSchema.safeParse(values).success) return BULK_CHANGE_STEP.changes;
  return null;
}

/**
 * The request of the preview and of the application (the model of the day panel for the seven values): the properties and the period, the weekdays when they are not all seven
 * (every day is the default of the API, and an empty list would be refused, never read as "all"), and what to do to each value; the price is the number typed.
 */
export function toChangeRequest(values: BulkChangeValues): CalendarChangeRequest {
  const weekdays = WEEKDAYS.filter((weekday) => values.weekdays.includes(weekday));
  return {
    propertyIds: [...values.propertyIds],
    from: values.from,
    to: values.to,
    ...(weekdays.length === WEEKDAYS.length ? {} : { daysOfWeek: weekdays }),
    ...toFieldPatches(values.rules),
  };
}

/** The values the request changes, in the order the wizard shows them: what the summary says is being changed. */
export function changedFields(values: DayRulesValues): DayRuleField[] {
  return DAY_RULE_FIELDS.filter((field) => values[field].action !== 'Keep');
}
