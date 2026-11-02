import type { TFunction } from 'i18next';
import { getLeaseStatusLabel } from '@/lib/i18n-labels';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import type { LeaseStage, LeaseSummary } from '@/types';
import type { LongRentPropertyRow } from './long-rent-property-rows';

/**
 * What the list of the properties of Affitti lunghi and its drawer say about a row, in words. Everything here reads what the API
 * sends for the lists; the only thing shown of a person is the name of the first tenant (never the fiscal code or the e-mail).
 */

const DAY = { day: 'numeric', month: 'short', year: 'numeric' } as const;

/** A day of a lease as the API wrote it ("1 ott 2026"): never moved by the time zone of the browser. Empty if it is not a date. */
export function leaseDay(value: string, language: string): string {
  return formatStayDate(parseStayDate(value), language, DAY);
}

/** "Mario Rossi", or what stands in its place: the data of the tenant were removed (LT-12), or the lease has no tenant yet. */
export function tenantNameOf(lease: LeaseSummary, t: TFunction): string {
  if (lease.tenantAnonymized) return t('longRentProperties.list.tenantAnonymized');
  const name = [lease.tenantFirstName, lease.tenantLastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name || t('longRentProperties.list.tenantMissing');
}

/** The lease that tells who is there: the one in force, or else the one being prepared. */
export const leaseOfRow = (row: LongRentPropertyRow): LeaseSummary | null => row.current ?? row.preparing;

/** Where the lease on its way stands, in a word: its stage on the path when the server says it, the status of the contract otherwise. */
function preparingLabel(row: LongRentPropertyRow, lease: LeaseSummary, t: TFunction): string {
  const stage: LeaseStage | null | undefined = row.aggregate?.preparingLease?.stage ?? lease.stage;
  return stage ? t(`status.leaseStage.${stage}.label`) : getLeaseStatusLabel(lease.status, t);
}

/**
 * Who is in the property and until when ("Fino al 29 feb 2028", or "Fino al 29 feb 2028, poi libero" when the lease does not go on), or who is
 * coming and with what lease ("Contratto: Bozza · dal 1 nov 2026"): the name and the line under it. `null` when the property has no lease to
 * tell of. The end is the one of the period the lease is in now when the server says it (a lease that renewed by itself goes on).
 */
export function tenantOfRow(row: LongRentPropertyRow, t: TFunction, language: string): { name: string; note: string | null } | null {
  if (row.current) {
    const current = row.aggregate?.currentLease;
    const until = leaseDay(current?.currentTermEndDate ?? row.current.endDate, language);
    const note = !until ? null : t(current?.freeFrom ? 'longRentProperties.list.untilThenFree' : 'longRentProperties.list.until', { date: until });
    return { name: tenantNameOf(row.current, t), note };
  }
  if (row.preparing) {
    const since = leaseDay(row.preparing.startDate, language);
    const status = preparingLabel(row, row.preparing, t);
    return { name: tenantNameOf(row.preparing, t), note: since ? t('longRentProperties.list.preparing', { status, date: since }) : status };
  }
  return null;
}

/** The first free day of a property whose lease does not go on ("1 mar 2027"); `null` when it does, or when the server did not say. */
export function freeFromOf(row: LongRentPropertyRow, language: string): string | null {
  const day = row.aggregate?.currentLease?.freeFrom;
  return day ? leaseDay(day, language) || null : null;
}

/** The APE as the contract needs it, in a few words; `warn` when something is missing. `null` when the server did not answer. */
export function apeOfRow(row: LongRentPropertyRow, t: TFunction): { text: string; warn: boolean } | null {
  const aggregate = row.aggregate;
  if (!aggregate) return null;
  if (aggregate.ape === 'Identified') {
    return {
      text: aggregate.apeClass ? t('longRentProperties.list.ape.identified', { class: aggregate.apeClass }) : t('longRentProperties.list.ape.identifiedNoClass'),
      warn: false,
    };
  }
  return { text: t(aggregate.ape === 'ToConfirm' ? 'longRentProperties.list.ape.toConfirm' : 'longRentProperties.list.ape.missing'), warn: true };
}

/** "Completi" / "Da completare": the cadastral data the contract prints. `null` when the server did not answer. */
export function cadastralOfRow(row: LongRentPropertyRow, t: TFunction): { text: string; warn: boolean } | null {
  const aggregate = row.aggregate;
  if (!aggregate) return null;
  return aggregate.cadastralComplete
    ? { text: t('longRentProperties.list.cadastral.complete'), warn: false }
    : { text: t('longRentProperties.list.cadastral.incomplete'), warn: true };
}

/** "Passa ad affitto breve il 1 dic 2026": the change of mode programmed for the property, if there is one. */
export function modeChangeOfRow(row: LongRentPropertyRow, t: TFunction, language: string): string | null {
  const change = row.aggregate?.scheduledModeChange;
  const date = change ? leaseDay(change.effectiveDate, language) : '';
  if (!change || !date) return null;
  return t(change.toMode === 'Short' ? 'longRentProperties.list.modeChangeToShort' : 'longRentProperties.list.modeChangeToLong', { date });
}
