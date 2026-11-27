import type { TFunction } from 'i18next';
import { accountantPackageTooLarge } from '@/api/accountant-package.api';
import { ReportAccessDeniedError } from '@/api/report-files';
import { defaultPeriod, parsePeriod, periodParam, shiftPeriod, shortId, type Period } from '@/features/owner-accounting/owner-accounting-model';
import i18n from '@/i18n/config';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';

/** A month (`2026-10`) or a year (`2026`): the two lengths of a package. */
export type PackagePeriod = ({ kind: 'month' } & Period) | { kind: 'year'; year: number };

/** The first and the last year a package may name: the years of the host reports, as the server takes them. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/** The months the choice of the period offers, counting back from the current one, and the years (the current one and the ones before it): an older period is still asked for by its address. */
const MONTHS_OFFERED = 24;
const YEARS_OFFERED = 6;

/** The words of the request and of the address: `2026-10` for a month, `2026` for a year. */
export function periodKey(period: PackagePeriod): string {
  return period.kind === 'year' ? String(period.year) : periodParam(period);
}

/** The period the words name, or `null` for anything else (a month that does not exist, a year out of range, a date, an empty or hand-made address): what the server would refuse is never asked. */
export function parsePackagePeriod(value: string | null | undefined): PackagePeriod | null {
  const word = value?.trim() ?? '';
  if (/^\d{4}$/.test(word)) {
    const year = Number(word);
    return year >= MIN_YEAR && year <= MAX_YEAR ? { kind: 'year', year } : null;
  }
  const month = parsePeriod(word, { year: 0, month: 0 });
  return month.year === 0 ? null : { kind: 'month', ...month };
}

/** The period of the page without an address: the month that is over, which is the one an accountant is given (the month before today, Europe/Rome). */
export function defaultPackagePeriod(today: string): PackagePeriod {
  return { kind: 'month', ...defaultPeriod(today) };
}

/**
 * The periods the choice offers, newest first: the last months and the last years. A period the address names that these do not hold is added to them, so the address wins and the choice
 * always shows what the page is about.
 */
export function periodChoices(today: string, selected: PackagePeriod): { months: string[]; years: string[] } {
  const thisMonth = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  const months = Array.from({ length: MONTHS_OFFERED }, (_, index) => periodParam(shiftPeriod(thisMonth, -index)));
  const years = Array.from({ length: YEARS_OFFERED }, (_, index) => String(thisMonth.year - index));
  const key = periodKey(selected);
  const newestFirst = (values: string[]) => [...new Set(values)].sort().reverse();
  return {
    months: selected.kind === 'month' ? newestFirst([key, ...months]) : months,
    years: selected.kind === 'year' ? newestFirst([key, ...years]) : years,
  };
}

/** The words of a code of the wire (`creditNote`, `bookingCom`): its translation, or the code as it came when the server is newer than this page. */
export function codeLabel(prefix: string, code: string | null | undefined, t: TFunction): string {
  if (!code) return '';
  const key = `${prefix}.${code}`;
  return i18n.exists(key) ? t(key) : code;
}

/** The name of a channel: the server writes the booking source in camel case (`bookingCom`), the words of the app are keyed by the name of the value (`BookingCom`). */
export function channelName(source: string | null | undefined, t: TFunction): string {
  return source ? getBookingSourceLabel(source.charAt(0).toUpperCase() + source.slice(1), t) : '';
}

/** Who an owner row is about: the name the agency keeps, or why there is none (the properties nobody owns, an owner whose data was erased, an owner with no name yet). */
export function ownerLabel(owner: { ownerId: string | null; ownerName: string | null; anonymized?: boolean }, t: TFunction): string {
  const name = owner.ownerName?.trim();
  if (name) return name;
  if (owner.ownerId === null) return t('accountantPackage.ownerName.nobody');
  if (owner.anonymized === false) return t('ownerAccounting.owner.unnamed', { id: shortId(owner.ownerId) });
  return t('accountantPackage.ownerName.anonymized');
}

/**
 * What a download that failed says, in words: a refusal of the role (403), the module being off (404), a package that is too large (422, with how many files it would hold and how many one
 * package allows, so that the person knows how much to narrow it) and, for anything else, what the server says or the generic sentence. The call the person stopped is not asked about here.
 */
export function downloadProblem(error: unknown, t: TFunction): string {
  if (error instanceof ReportAccessDeniedError) return t('accountantPackage.download.forbidden');
  if (getHttpStatus(error) === 404) return t('accountantPackage.unavailable');
  const large = accountantPackageTooLarge(error);
  if (large) {
    return large.fileCount === null || large.maxFiles === null
      ? t('apiErrors.codes.accountantPackageTooLarge')
      : t('accountantPackage.download.tooLarge', { files: large.fileCount, max: large.maxFiles });
  }
  return getProblemMessage(error, t) ?? t('accountantPackage.download.failed');
}
