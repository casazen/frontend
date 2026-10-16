import type { TFunction } from 'i18next';
import { getLeaseStatusLabel } from '@/lib/i18n-labels';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import type { LeaseSummary } from '@/types';
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

/**
 * Who is in the property and until when ("Fino al 29 feb 2028"), or who is coming and with what lease ("Contratto: Bozza · dal 1 nov
 * 2026"): the name and the line under it. `null` when the property has no lease to tell of.
 */
export function tenantOfRow(row: LongRentPropertyRow, t: TFunction, language: string): { name: string; note: string | null } | null {
  if (row.current) {
    const until = leaseDay(row.current.endDate, language);
    return { name: tenantNameOf(row.current, t), note: until ? t('longRentProperties.list.until', { date: until }) : null };
  }
  if (row.preparing) {
    const since = leaseDay(row.preparing.startDate, language);
    const status = getLeaseStatusLabel(row.preparing.status, t);
    return { name: tenantNameOf(row.preparing, t), note: since ? t('longRentProperties.list.preparing', { status, date: since }) : status };
  }
  return null;
}
