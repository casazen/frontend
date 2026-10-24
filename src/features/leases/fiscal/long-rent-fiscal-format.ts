import type { TFunction } from 'i18next';
import type { LongRentFiscalRow } from '@/api/long-rent-fiscal.api';
import { formatStayDate, parseStayDate, todayInRome } from '@/lib/stay-dates';

/** The search parameter that holds the year of the report (`?anno=2025`); the current year has none. */
export const FISCAL_YEAR_PARAM = 'anno';

/** The years the report offers: this one and the one before, on the Europe/Rome calendar. */
export function fiscalReportYears(now: Date = new Date()): { current: number; previous: number } {
  const current = Number(todayInRome(now).slice(0, 4));
  return { current, previous: current - 1 };
}

/** The year the address asks for: the previous one when it says so, the current one for anything else. */
export function fiscalYearOfAddress(param: string | null, years: { current: number; previous: number }): number {
  return param === String(years.previous) ? years.previous : years.current;
}

/**
 * The notes of the tax advisory of a lease that this page can explain, in the order they are listed; their texts are the ones the
 * advisory of the lease shows (`leases.rli.advisory.note.<code>`), so a figure of the report and the same figure on the lease say
 * the same thing. A code that is not here is not shown raw.
 */
export const FISCAL_NOTE_CODES = [
  'ata_unverified',
  'ata_not_listed',
  'emergency_comuni_not_checked',
  'concordato_attestation_required',
  'transitorio_reliefs_to_confirm',
  'tax_regime_unknown',
] as const;

/** The notes of the rows, each once, in the order of {@link FISCAL_NOTE_CODES}. */
export function fiscalNotesOf(rows: readonly LongRentFiscalRow[]): string[] {
  const present = new Set(rows.flatMap((row) => row.notes));
  return FISCAL_NOTE_CODES.filter((code) => present.has(code));
}

/** The name of the first tenant, or what stands in its place when its data were anonymized (LT-12) or there is none. */
export function fiscalTenantName(row: Pick<LongRentFiscalRow, 'tenantAnonymized' | 'tenantFirstName' | 'tenantLastName'>, t: TFunction): string {
  if (row.tenantAnonymized) return t('leaseList.tenant.anonymized');
  const name = [row.tenantFirstName, row.tenantLastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name || t('leaseList.tenant.missing');
}

/** "mar 2026": the month of a day the API sent, as written (never moved by the time zone of the browser). */
export function fiscalMonthLabel(date: string | null, language: string): string {
  return formatStayDate(parseStayDate(date), language, { month: 'short', year: 'numeric' });
}

/** A rate given as a fraction (0.21) shown as a percentage. */
export function fiscalRateLabel(rate: number, language: string): string {
  return new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 2 }).format(rate);
}
