import { formatRomeDateTime } from '@/lib/stay-dates';
import type { SupplierClient } from '@/types/supplier-clients';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The requests of one customer in the inbox (all the tabs): the filter works for a host and for a private customer alike. */
export function clientRequestsPath(clientId: string): string {
  return `/app/supplier/inbox?chip=tutte&clientId=${encodeURIComponent(clientId)}`;
}

/** The earnings of one customer (the page of the earnings, behind `SupplierOnlinePayments`, filtered by `clientId`). */
export function clientEarningsPath(clientId: string): string {
  return `/app/supplier/earnings?clientId=${encodeURIComponent(clientId)}`;
}

/**
 * The name the supplier may see: what the API sends ("Nome C." for a private customer until a job of theirs is taken, then the full
 * name), "Cliente rimosso" for one removed by the retention of the personal data. Nothing is made up.
 */
export function clientName(client: Pick<SupplierClient, 'label' | 'anonymized'>, t: Translate): string {
  if (client.anonymized) return t('supplier.clients.removed');
  return client.label?.trim() || t('supplier.clients.unnamed');
}

/** The day of an instant in Europe/Rome, for a line ("12 ott 2026"); empty when there is none. */
export function clientDay(instant: string | null | undefined, locale: string): string {
  return instant ? formatRomeDateTime(instant, locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

/** True when a customer can be reached: the API sends a contact only after a job of theirs was taken. */
export function hasContact(client: Pick<SupplierClient, 'contact'>): boolean {
  const contact = client.contact;
  return Boolean(contact && (contact.name?.trim() || contact.email?.trim() || contact.phone?.trim()));
}
