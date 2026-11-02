import type { TFunction } from 'i18next';
import type { TenantLease, TenantPayment, TenantPunctuality, TenantRow } from '@/types';
import { fullDay } from '../lib/rent-register';

/**
 * What the tenants pages say about a person, in words (LR-09). It only reads what the API sends for a row (`TenantRow`): who is a
 * former tenant, the stage of each lease and the punctuality are the server's, and nothing here works them out from raw fields. The only
 * data of the person shown are the name, whether they are a citizen of the Union and the e-mail as the server masked it.
 */

/** "Giulia Verdi". */
export function tenantName(tenant: Pick<TenantRow, 'firstName' | 'lastName'>): string {
  return [tenant.firstName, tenant.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

/** "Cittadino UE" / "Cittadino non UE". */
export function tenantCitizenshipText(tenant: Pick<TenantRow, 'citizenship'>, t: TFunction): string {
  return t(`longRentTenants.citizenship.${tenant.citizenship}`);
}

/** The lease the person is described by (the newest) and how many others there are: "Casa Corso" or "Casa Corso · e altri 2 contratti". */
export function tenantLeaseLine(tenant: Pick<TenantRow, 'leases'>, t: TFunction): string {
  const [first, ...others] = tenant.leases;
  if (!first) return t('longRentTenants.noLease');
  return others.length > 0 ? t('longRentTenants.leaseAndOthers', { property: first.propertyName, count: others.length }) : first.propertyName;
}

/** "8 su 10 canoni in orario", or that nothing fell due yet. */
export function tenantPunctualityText(punctuality: TenantPunctuality, t: TFunction): string {
  if (punctuality.total <= 0) return t('longRentTenants.punctuality.none');
  return t('longRentTenants.punctuality.summary', { onTime: punctuality.onTime, total: punctuality.total });
}

/** The same, with what "on time" means ("entro 5 giorni dalla scadenza"): the sentence of the sheet. */
export function tenantPunctualityDetail(punctuality: TenantPunctuality, onTimeDays: number, t: TFunction): string {
  if (punctuality.total <= 0) return t('longRentTenants.punctuality.none');
  return t('longRentTenants.punctuality.detail', { onTime: punctuality.onTime, total: punctuality.total, days: onTimeDays });
}

/** "Fino al 30 set 2030" while a lease runs, "Finito il 30 giu 2026" once it has concluded: the end of the period the lease is in. */
export function tenantLeaseEndText(lease: Pick<TenantLease, 'currentTermEndDate' | 'stage'>, t: TFunction, language: string): string {
  const date = fullDay(lease.currentTermEndDate, language);
  if (!date) return '—';
  return t(lease.stage === 'Concluded' ? 'longRentTenants.end.former' : 'longRentTenants.end.running', { date });
}

/** The end of the newest lease of the person, for the list. */
export function tenantEndText(tenant: Pick<TenantRow, 'leases'>, t: TFunction, language: string): string {
  const first = tenant.leases[0];
  return first ? tenantLeaseEndText(first, t, language) : '—';
}

/** The line under an installment of the sheet: when it was paid, how late it is, or that it is due today. `late` is the one thing in red. */
export function tenantPaymentNote(payment: TenantPayment, t: TFunction, language: string): { text: string; late: boolean } {
  if (payment.status === 'Paid') {
    return { text: payment.paidOn ? t('longRentRents.row.paidOn', { date: fullDay(payment.paidOn, language) }) : t('longRentTenants.payments.paid'), late: false };
  }
  if (payment.status === 'Processing') return { text: t('longRentRents.row.processing'), late: false };
  if (payment.isOverdue) {
    const days = payment.daysOverdue ?? 0;
    return { text: days > 0 ? t('longRentRents.row.overdue', { count: days }) : t('longRentRents.row.overdueToday'), late: true };
  }
  if (payment.status === 'Failed') return { text: t('longRentRents.row.failed'), late: false };
  return { text: t('longRentRents.row.dueToday'), late: false };
}
