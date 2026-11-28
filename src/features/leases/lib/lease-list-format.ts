import type { TFunction } from 'i18next';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import { LEASE_DRAFT_PLACEHOLDER_DATE, type LeaseProgress, type LeaseSummary } from '@/types';

/**
 * What the list of leases and its drawer say about a row, in words (LR-02). Everything here reads what the API sends for the
 * list (`LeaseSummaryDto`) and never works a state out of raw fields: the status is the server's, and what is late is what the
 * rent ledger says. The only thing shown of a person is the name of the first tenant (never the fiscal code or the e-mail).
 */

const FULL_DAY = { day: 'numeric', month: 'short', year: 'numeric' } as const;
const SHORT_DAY = { day: 'numeric', month: 'short' } as const;

export function leaseTenantName(
  lease: Pick<LeaseSummary, 'tenantAnonymized' | 'tenantFirstName' | 'tenantLastName'>,
  t: TFunction,
): string {
  if (lease.tenantAnonymized) return t('leaseList.tenant.anonymized');
  const name = [lease.tenantFirstName, lease.tenantLastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name || t('leaseList.tenant.missing');
}

export function leasePropertyLine(lease: Pick<LeaseSummary, 'property'>, t: TFunction): string {
  if (!lease.property) return t('leaseList.property.unknown');
  return [lease.property.name, lease.property.city].filter(Boolean).join(' · ');
}

export function isLeasePlaceholderDate(date: string | null | undefined): boolean {
  return !!date && date.startsWith(LEASE_DRAFT_PLACEHOLDER_DATE);
}

export function leaseTermText(lease: Pick<LeaseSummary, 'startDate' | 'endDate'>, t: TFunction, language: string): string {
  if (isLeasePlaceholderDate(lease.startDate)) return t('leaseList.termToDefine');
  const from = formatStayDate(parseStayDate(lease.startDate), language, FULL_DAY);
  const to = formatStayDate(parseStayDate(lease.endDate), language, FULL_DAY);
  return from && to ? t('leaseList.term', { from, to }) : '—';
}

export function leaseRentText(lease: Pick<LeaseSummary, 'monthlyRent'>, t: TFunction): string {
  if (!(lease.monthlyRent > 0)) return t('leaseList.rentToDefine');
  return t('leases.monthlyRentValue', { amount: formatCurrency(lease.monthlyRent) });
}

export function leaseOverdueText(lease: LeaseSummary, t: TFunction): string | null {
  if (!lease.overdueRentCount || lease.overdueRentCount <= 0) return null;
  const amount = formatCurrency(lease.overdueRentAmount ?? 0);
  return lease.overdueDays && lease.overdueDays > 0
    ? t('leaseList.rent.overdue', { count: lease.overdueDays, amount })
    : t('leaseList.rent.overdueNoDays', { amount });
}

export function leaseNextRentText(lease: LeaseSummary, t: TFunction, language: string): string | null {
  const date = formatStayDate(parseStayDate(lease.nextRentDueDate), language, SHORT_DAY);
  return date ? t('leaseList.rent.next', { date }) : null;
}

export function leaseProgressText(progress: LeaseProgress, t: TFunction): string {
  if (progress.kind === 'End') return t('leaseList.progress.concluded');
  const values = { done: progress.done, total: progress.total };
  if (progress.unit === 'Years') return t('leaseList.progress.years', values);
  if (progress.unit === 'Months') return t('leaseList.progress.months', values);
  return t('leaseList.progress.steps', values);
}
