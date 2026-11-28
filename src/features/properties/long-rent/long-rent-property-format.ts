import type { TFunction } from 'i18next';
import { getLeaseStatusLabel } from '@/lib/i18n-labels';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import type { LeaseStage, LeaseSummary } from '@/types';
import type { LongRentPropertyRow } from './long-rent-property-rows';

const DAY = { day: 'numeric', month: 'short', year: 'numeric' } as const;

export function leaseDay(value: string, language: string): string {
  return formatStayDate(parseStayDate(value), language, DAY);
}

export function tenantNameOf(lease: LeaseSummary, t: TFunction): string {
  if (lease.tenantAnonymized) return t('longRentProperties.list.tenantAnonymized');
  const name = [lease.tenantFirstName, lease.tenantLastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name || t('longRentProperties.list.tenantMissing');
}

export const leaseOfRow = (row: LongRentPropertyRow): LeaseSummary | null => row.current ?? row.preparing;

/** Where the lease on its way stands, in a word: its stage on the path when the server says it, the status of the contract otherwise. */
function preparingLabel(row: LongRentPropertyRow, lease: LeaseSummary, t: TFunction): string {
  const stage: LeaseStage | null | undefined = row.aggregate?.preparingLease?.stage ?? lease.stage;
  return stage ? t(`status.leaseStage.${stage}.label`) : getLeaseStatusLabel(lease.status, t);
}

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

export function freeFromOf(row: LongRentPropertyRow, language: string): string | null {
  const day = row.aggregate?.currentLease?.freeFrom;
  return day ? leaseDay(day, language) || null : null;
}

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

export function cadastralOfRow(row: LongRentPropertyRow, t: TFunction): { text: string; warn: boolean } | null {
  const aggregate = row.aggregate;
  if (!aggregate) return null;
  return aggregate.cadastralComplete
    ? { text: t('longRentProperties.list.cadastral.complete'), warn: false }
    : { text: t('longRentProperties.list.cadastral.incomplete'), warn: true };
}

export function modeChangeOfRow(row: LongRentPropertyRow, t: TFunction, language: string): string | null {
  const change = row.aggregate?.scheduledModeChange;
  const date = change ? leaseDay(change.effectiveDate, language) : '';
  if (!change || !date) return null;
  return t(change.toMode === 'Short' ? 'longRentProperties.list.modeChangeToShort' : 'longRentProperties.list.modeChangeToLong', { date });
}
