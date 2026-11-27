import type { FiscalExportFormat, FiscalReportKind, FiscalReportPeriod, FiscalTaxNote } from '@/api/fiscal.api';
import { todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';

export const FIRST_FISCAL_YEAR = 2026;

export function currentFiscalYear(now: Date = new Date()): number {
  return Math.max(FIRST_FISCAL_YEAR, Number(todayInRome(now).slice(0, 4)));
}

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

export function periodOf(year: number, preset: FiscalPeriodPreset): FiscalReportPeriod {
  const [from, to] = preset === 'year' ? ['01-01', '12-31'] : QUARTER_BOUNDS[preset];
  return { from: `${year}-${from}`, to: `${year}-${to}` };
}

const REPORT_FILE_NAMES: Record<FiscalReportKind, string> = {
  annual: 'casazen-redditi',
  withholding: 'casazen-ritenute',
  touristTax: 'casazen-tassa-soggiorno',
};

export function fiscalReportFileName(kind: FiscalReportKind, period: FiscalReportPeriod, format: FiscalExportFormat): string {
  return `${REPORT_FILE_NAMES[kind]}-${period.from}-${period.to}.${format}`;
}

/**
 * The currency of the Italian tax reports (the annual income, the withholding and the tourist tax of the comuni): they are declared in euro by law, so their answers carry no currency field and
 * their screens name it here, once, instead of the formatter assuming it. A figure that has a currency in its data (a document, a statement, a payment) is shown in that one.
 */
export const FISCAL_REPORT_CURRENCY = 'EUR';

export function formatMoney(value: number, locale: string, currency: string): string {
  return formatCurrency(value, currency, locale);
}

export function formatRate(rate: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(rate);
}

export function formatMonth(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export const TAX_NOTE_KEYS: Record<FiscalTaxNote, string> = {
  irpef_ordinaria_not_computed: 'fiscal.taxNote.irpefOrdinariaNotComputed',
  short_stay_threshold_exceeded: 'fiscal.taxNote.thresholdExceeded',
  regime_not_assigned: 'fiscal.taxNote.regimeNotAssigned',
  impresa_not_computed: 'fiscal.taxNote.impresaNotComputed',
};
