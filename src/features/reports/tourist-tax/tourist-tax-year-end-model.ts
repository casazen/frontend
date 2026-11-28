import type { TFunction } from 'i18next';
import type { YearEndAccountCut } from '@/api/tourist-tax-summary.api';
import type { ReportFileFormat } from '@/api/report-files';
import { formatMoney } from '@/features/fiscal/fiscal-format';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import type { TouristTaxAgentAccountRow } from '@/types';

const YEARS_OFFERED = 4;

export function yearEndYears(today: string = todayInRome()): number[] {
  const current = Number(today.slice(0, 4));
  return Array.from({ length: YEARS_OFFERED }, (_, index) => current - index);
}

export const YEAR_END_ACCOUNT_CUTS: readonly YearEndAccountCut[] = ['month', 'quarter'];

export type YearEndFileRequest =
  | { kind: 'declaration'; year: number; format: ReportFileFormat }
  | { kind: 'agentAccount'; year: number; by: YearEndAccountCut; format: ReportFileFormat }
  | { kind: 'ticino'; year: number; format: ReportFileFormat };

export type YearEndRow = YearEndFileRequest['kind'];

export function yearEndFallbackName(request: YearEndFileRequest): string {
  switch (request.kind) {
    case 'declaration':
      return `casazen-imposta-soggiorno-dichiarazione-${request.year}.${request.format}`;
    case 'agentAccount':
      return `casazen-imposta-soggiorno-conto-agente-${request.year}-${request.by === 'quarter' ? 'trimestrale' : 'mensile'}.${request.format}`;
    case 'ticino':
      return `casazen-imposta-soggiorno-ticino-${request.year}.${request.format}`;
  }
}

const CURRENCY_CODE = /^[A-Z]{3}$/;

export function hasYearEndCurrency(currency: string | null | undefined): currency is string {
  return typeof currency === 'string' && CURRENCY_CODE.test(currency.trim().toUpperCase());
}

export function yearEndAmount(amount: number, currency: string | null | undefined, locale: string): string {
  return hasYearEndCurrency(currency)
    ? formatMoney(amount, locale, currency.trim().toUpperCase())
    : new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function yearEndMoney(cents: number, currency: string | null | undefined, locale: string): string {
  return yearEndAmount(cents / 100, currency, locale);
}

interface AccountGroup {
  comune: string;
  rows: TouristTaxAgentAccountRow[];
}

export function accountGroups(rows: readonly TouristTaxAgentAccountRow[]): AccountGroup[] {
  const groups: AccountGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.comune === row.comune) last.rows.push(row);
    else groups.push({ comune: row.comune, rows: [row] });
  }
  return groups;
}

const MONTH_LABEL = /^\d{4}-\d{2}$/;
const QUARTER_LABEL = /^\d{4}-Q([1-4])$/;

export function accountPeriodLabel(row: Pick<TouristTaxAgentAccountRow, 'period' | 'from' | 'isYear'>, locale: string, t: TFunction): string {
  if (row.isYear) return t('reports.touristTax.yearEnd.account.period.year', { year: row.from.slice(0, 4) });
  if (MONTH_LABEL.test(row.period)) return formatStayDate(row.from, locale, { month: 'long', year: 'numeric' }) || row.period;
  const quarter = QUARTER_LABEL.exec(row.period);
  return quarter ? t('reports.touristTax.yearEnd.account.period.quarter', { quarter: quarter[1], year: row.period.slice(0, 4) }) : row.period;
}

/**
 * The words of the reasons the server names for an exempt guest: the catalogue the host chooses from (the words of the check-in), the age, the reason that went with the data of the guest and the single row that stands for every
 * reason a caller may not read (art. 9 GDPR). It is a table of words and never a rule: the reasons are the server's, and a reason the page has no words for is written as the server wrote it.
 */
const EXEMPTION_REASON_KEYS: Readonly<Record<string, string>> = {
  resident: 'touristTax.exemption.resident',
  health_care: 'touristTax.exemption.health_care',
  disability_companion: 'touristTax.exemption.disability_companion',
  public_service: 'touristTax.exemption.public_service',
  host_family: 'touristTax.exemption.host_family',
  other: 'touristTax.exemption.other',
  minor_age: 'reports.touristTax.yearEnd.declaration.exemptionReason.minor_age',
  erased: 'reports.touristTax.yearEnd.declaration.exemptionReason.erased',
  restricted: 'reports.touristTax.yearEnd.declaration.exemptionReason.restricted',
};

const STAY_REASON_KEYS: Readonly<Record<string, string>> = {
  exempt: 'reports.touristTax.yearEnd.declaration.stayReason.exempt',
  collected_by_channel: 'reports.touristTax.yearEnd.declaration.stayReason.collected_by_channel',
  not_calculated: 'reports.touristTax.yearEnd.declaration.stayReason.not_calculated',
  no_tax_due: 'reports.touristTax.yearEnd.declaration.stayReason.no_tax_due',
};

export function exemptionReasonLabel(reason: string, t: TFunction): string {
  return Object.hasOwn(EXEMPTION_REASON_KEYS, reason) ? t(EXEMPTION_REASON_KEYS[reason]) : reason;
}

export function stayReasonLabel(reason: string, t: TFunction): string {
  return Object.hasOwn(STAY_REASON_KEYS, reason) ? t(STAY_REASON_KEYS[reason]) : reason;
}
