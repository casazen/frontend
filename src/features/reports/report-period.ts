import { FIRST_FISCAL_YEAR } from '@/features/fiscal/fiscal-format';
import type { ReportPeriod } from '@/api/reports.api';
import type { ReportSource } from '@/features/reports/report-catalog';
import { addDays, endOfMonth, isStayDate, nightsBetween, startOfMonth } from '@/lib/stay-dates';

export const PERIOD_PRESETS = ['thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'lastYear', 'custom'] as const;
export type PeriodPresetId = (typeof PERIOD_PRESETS)[number];

const MAX_REPORT_MONTHS = 24;

const FIRST_DAY = '2000-01-01';
const LAST_DAY = '2100-12-31';

export function withinSupportedDays(day: string): string {
  return day < FIRST_DAY ? FIRST_DAY : day > LAST_DAY ? LAST_DAY : day;
}

const MAX_TOURIST_TAX_NIGHTS = 365;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${pad(targetYear, 4)}-${pad(targetMonth)}-${pad(Math.min(day, lastDay))}`;
}

export function presetPeriod(preset: Exclude<PeriodPresetId, 'custom'>, today: string): ReportPeriod {
  const thisMonth = startOfMonth(today);
  const year = Number(today.slice(0, 4));
  switch (preset) {
    case 'thisMonth':
      return { from: thisMonth, to: endOfMonth(today) };
    case 'lastMonth':
      return { from: addMonths(thisMonth, -1), to: addDays(thisMonth, -1) };
    case 'last3Months':
      return { from: addMonths(thisMonth, -3), to: addDays(thisMonth, -1) };
    case 'thisYear':
      return { from: `${pad(year, 4)}-01-01`, to: `${pad(year, 4)}-12-31` };
    case 'lastYear':
      return { from: `${pad(year - 1, 4)}-01-01`, to: `${pad(year - 1, 4)}-12-31` };
  }
}

export type PeriodProblem = 'invalidDates' | 'tooLong' | 'fiscalYear' | 'fiscalSameYear' | 'fiscalTooLong';

export function basicPeriodProblem(period: ReportPeriod): Extract<PeriodProblem, 'invalidDates' | 'tooLong'> | null {
  const { from, to } = period;
  if (!isStayDate(from) || !isStayDate(to) || to < from || from < FIRST_DAY || to > LAST_DAY) return 'invalidDates';
  if (to > addDays(addMonths(from, MAX_REPORT_MONTHS), -1)) return 'tooLong';
  return null;
}

export function periodProblem(period: ReportPeriod, source: ReportSource): PeriodProblem | null {
  const basic = basicPeriodProblem(period);
  if (basic) return basic;

  const { from, to } = period;

  if (source.kind === 'fiscal') {
    if (source.report === 'touristTax') return nightsBetween(from, to) > MAX_TOURIST_TAX_NIGHTS ? 'fiscalTooLong' : null;
    if (from.slice(0, 4) !== to.slice(0, 4)) return 'fiscalSameYear';
    if (Number(from.slice(0, 4)) < FIRST_FISCAL_YEAR) return 'fiscalYear';
  }
  return null;
}
