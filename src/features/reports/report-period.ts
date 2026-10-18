import { FIRST_FISCAL_YEAR } from '@/features/fiscal/fiscal-format';
import type { ReportPeriod } from '@/api/reports.api';
import type { ReportSource } from '@/features/reports/report-catalog';
import { addDays, endOfMonth, isStayDate, nightsBetween, startOfMonth } from '@/lib/stay-dates';

/** The periods the host picks from (SR-10): the last one lets the host type the days. */
export const PERIOD_PRESETS = ['thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'lastYear', 'custom'] as const;
export type PeriodPresetId = (typeof PERIOD_PRESETS)[number];

/** The longest period a report covers, in calendar months: the backend answers 422 beyond it (`HostReportRules.MaxMonths`). */
const MAX_REPORT_MONTHS = 24;

/** The days a report may cover: the years the backend supports (`HostDashboardPeriod.MinCustomYear` to `MaxCustomYear`). */
const FIRST_DAY = '2000-01-01';
const LAST_DAY = '2100-12-31';

/** The tourist tax report covers a year at most (366 days, both ends included). */
const MAX_TOURIST_TAX_NIGHTS = 365;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/**
 * `date` (`YYYY-MM-DD`) moved by whole months. The day is kept or, where the month is shorter, it becomes the last day of the
 * month: 31 January plus one month is 28 (29) February, as `DateOnly.AddMonths` of the backend does.
 */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${pad(targetYear, 4)}-${pad(targetMonth)}-${pad(Math.min(day, lastDay))}`;
}

/**
 * The days of a period, both included (`today` is a day in Europe/Rome). "Ultimi 3 mesi" are the three whole months before the
 * current one, the way a quarter is. `custom` has no days of its own: the person types them.
 */
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

/** What is wrong with a period, as the key of `reports.error.*` that explains it. */
export type PeriodProblem = 'invalidDates' | 'tooLong' | 'fiscalYear' | 'fiscalSameYear' | 'fiscalTooLong';

/**
 * Why the report cannot be asked for these days, or null: the days are not two days in order (and in the years the backend
 * knows), the period is longer than 24 months, and for the fiscal reports the rules of their endpoints (a tax year from 2026 and
 * one only for the summary and the withholdings, at most a year for the tourist tax). The backend says the same with a problem
 * body; this tells it before the call.
 */
export function periodProblem(period: ReportPeriod, source: ReportSource): PeriodProblem | null {
  const { from, to } = period;
  if (!isStayDate(from) || !isStayDate(to) || to < from || from < FIRST_DAY || to > LAST_DAY) return 'invalidDates';
  if (to > addDays(addMonths(from, MAX_REPORT_MONTHS), -1)) return 'tooLong';

  if (source.kind === 'fiscal') {
    if (source.report === 'touristTax') return nightsBetween(from, to) > MAX_TOURIST_TAX_NIGHTS ? 'fiscalTooLong' : null;
    if (from.slice(0, 4) !== to.slice(0, 4)) return 'fiscalSameYear';
    if (Number(from.slice(0, 4)) < FIRST_FISCAL_YEAR) return 'fiscalYear';
  }
  return null;
}
