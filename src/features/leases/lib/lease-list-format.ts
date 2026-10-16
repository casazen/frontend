import type { TFunction } from 'i18next';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { LeaseSummary } from '@/types';

/**
 * What the list of leases and its drawer say about a row, in words (LR-02). Everything here reads what the API sends for the
 * list (`LeaseSummaryDto`) and never works a state out of raw fields: the status is the server's, and what is late is what the
 * rent ledger says. The only thing shown of a person is the name of the first tenant (never the fiscal code or the e-mail).
 */

const FULL_DAY = { day: 'numeric', month: 'short', year: 'numeric' } as const;
const SHORT_DAY = { day: 'numeric', month: 'short' } as const;

/** The name of the first tenant, or what stands in its place: no tenant yet, or one whose data were anonymized (LT-12). */
export function leaseTenantName(lease: LeaseSummary, t: TFunction): string {
  if (lease.tenantAnonymized) return t('leaseList.tenant.anonymized');
  const name = [lease.tenantFirstName, lease.tenantLastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name || t('leaseList.tenant.missing');
}

/** "Casa Trastevere · Roma". */
export function leasePropertyLine(lease: LeaseSummary, t: TFunction): string {
  if (!lease.property) return t('leaseList.property.unknown');
  return [lease.property.name, lease.property.city].filter(Boolean).join(' · ');
}

/** "dal 1 ott 2026 al 30 set 2030": the days as the API wrote them, never moved by the time zone of the browser. */
export function leaseTermText(lease: LeaseSummary, t: TFunction, language: string): string {
  const from = formatStayDate(parseStayDate(lease.startDate), language, FULL_DAY);
  const to = formatStayDate(parseStayDate(lease.endDate), language, FULL_DAY);
  return from && to ? t('leaseList.term', { from, to }) : '—';
}

/** "950,00 €/mese". */
export function leaseRentText(lease: LeaseSummary, t: TFunction): string {
  return t('leases.monthlyRentValue', { amount: formatCurrency(lease.monthlyRent) });
}

/** What is late about the rent ("In ritardo da 6 giorni · 720,00 €"); `null` when nothing is. */
export function leaseOverdueText(lease: LeaseSummary, t: TFunction): string | null {
  if (!lease.overdueRentCount || lease.overdueRentCount <= 0) return null;
  const amount = formatCurrency(lease.overdueRentAmount ?? 0);
  return lease.overdueDays && lease.overdueDays > 0
    ? t('leaseList.rent.overdue', { count: lease.overdueDays, amount })
    : t('leaseList.rent.overdueNoDays', { amount });
}

/** When the next rent is due ("Prossimo canone: 5 nov"); `null` without a rent schedule. */
export function leaseNextRentText(lease: LeaseSummary, t: TFunction, language: string): string | null {
  const date = formatStayDate(parseStayDate(lease.nextRentDueDate), language, SHORT_DAY);
  return date ? t('leaseList.rent.next', { date }) : null;
}
