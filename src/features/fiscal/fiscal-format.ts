import type { FiscalReportPeriod, FiscalTaxNote } from '@/api/fiscal.api';
import { todayInRome } from '@/lib/stay-dates';

/** First tax year of the fiscal area (the backend refuses earlier years). */
export const FIRST_FISCAL_YEAR = 2026;

/** Current tax year: the calendar year in Europe/Rome, never before {@link FIRST_FISCAL_YEAR}. */
export function currentFiscalYear(now: Date = new Date()): number {
  return Math.max(FIRST_FISCAL_YEAR, Number(todayInRome(now).slice(0, 4)));
}

/** Tax years offered by the reports: from the first one to the current one. */
export function fiscalYears(now: Date = new Date()): number[] {
  const current = currentFiscalYear(now);
  return Array.from({ length: current - FIRST_FISCAL_YEAR + 1 }, (_, i) => current - i);
}

export type FiscalPeriodPreset = 'year' | 'q1' | 'q2' | 'q3' | 'q4';

export const FISCAL_PERIOD_PRESETS: readonly FiscalPeriodPreset[] = ['year', 'q1', 'q2', 'q3', 'q4'];

const QUARTER_BOUNDS: Record<Exclude<FiscalPeriodPreset, 'year'>, [string, string]> = {
  q1: ['01-01', '03-31'],
  q2: ['04-01', '06-30'],
  q3: ['07-01', '09-30'],
  q4: ['10-01', '12-31'],
};

/** Calendar dates of a period of `year` (both included). */
export function periodOf(year: number, preset: FiscalPeriodPreset): FiscalReportPeriod {
  const [from, to] = preset === 'year' ? ['01-01', '12-31'] : QUARTER_BOUNDS[preset];
  return { from: `${year}-${from}`, to: `${year}-${to}` };
}

/** Euro amount in the UI locale. */
export function formatMoney(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);
}

/** Rate given as a fraction (0.21) shown as a percentage. */
export function formatRate(rate: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(rate);
}

/** Month of a report row (`month` is 1-12) in the UI locale. */
export function formatMonth(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/** i18n keys of the backend tax note codes. */
export const TAX_NOTE_KEYS: Record<FiscalTaxNote, string> = {
  irpef_ordinaria_not_computed: 'fiscal.taxNote.irpefOrdinariaNotComputed',
  short_stay_threshold_exceeded: 'fiscal.taxNote.thresholdExceeded',
  regime_not_assigned: 'fiscal.taxNote.regimeNotAssigned',
  impresa_not_computed: 'fiscal.taxNote.impresaNotComputed',
};
