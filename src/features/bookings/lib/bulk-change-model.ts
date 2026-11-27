import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { addDays, isStayDate, nightsBetween, todayInRome } from '@/lib/stay-dates';
import { WEEKDAYS, type CalendarChangePreview, type CalendarChangeRequest, type Weekday } from '@/types/calendar-changes.types';
import { DAY_RULE_FIELDS, dayRulesSchema, emptyDayRules, toFieldPatches, type DayRuleField, type DayRulesValues } from './day-rules-model';

export const BULK_CHANGE_STEP = { properties: 'properties', period: 'period', changes: 'changes', summary: 'summary' } as const;
export type BulkChangeStep = (typeof BULK_CHANGE_STEP)[keyof typeof BULK_CHANGE_STEP];

export const BULK_MAX_PROPERTIES = 50;
export const BULK_MAX_DAYS = 366;

export interface BulkChangeValues {
  propertyIds: string[];
  from: string;
  to: string;
  weekdays: Weekday[];
  rules: DayRulesValues;
}

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

export function periodDays(from: string, to: string): number {
  return isStayDate(from) && isStayDate(to) && to >= from ? nightsBetween(from, addDays(to, 1)) : 0;
}

export const propertiesStepSchema: ZodType<unknown, FieldValues> = z.object({
  propertyIds: z.array(z.string()).min(1, BULK_ERROR_KEYS.propertiesRequired).max(BULK_MAX_PROPERTIES, BULK_ERROR_KEYS.propertiesTooMany),
});

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

export const changesStepSchema: ZodType<unknown, FieldValues> = z.object({ rules: dayRulesSchema });

export function firstInvalidStep(values: BulkChangeValues): BulkChangeStep | null {
  if (!propertiesStepSchema.safeParse(values).success) return BULK_CHANGE_STEP.properties;
  if (!periodStepSchema.safeParse(values).success) return BULK_CHANGE_STEP.period;
  if (!changesStepSchema.safeParse(values).success) return BULK_CHANGE_STEP.changes;
  return null;
}

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

export function changedDaysOf(preview: Pick<CalendarChangePreview, 'properties'>): number {
  return preview.properties.reduce((total, property) => total + property.changedDays, 0);
}

export function changedFields(values: DayRulesValues): DayRuleField[] {
  return DAY_RULE_FIELDS.filter((field) => values[field].action !== 'Keep');
}
