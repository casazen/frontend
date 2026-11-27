import { formatRomeDateTime } from '@/lib/stay-dates';
import type { SupplierClient } from '@/types/supplier-clients';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function clientRequestsPath(clientId: string): string {
  return `/app/supplier/inbox?chip=tutte&clientId=${encodeURIComponent(clientId)}`;
}

export function clientEarningsPath(clientId: string): string {
  return `/app/supplier/earnings?clientId=${encodeURIComponent(clientId)}`;
}

export function clientName(client: Pick<SupplierClient, 'label' | 'anonymized'>, t: Translate): string {
  if (client.anonymized) return t('supplier.clients.removed');
  return client.label?.trim() || t('supplier.clients.unnamed');
}

export function clientDay(instant: string | null | undefined, locale: string): string {
  return instant ? formatRomeDateTime(instant, locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export function hasContact(client: Pick<SupplierClient, 'contact'>): boolean {
  const contact = client.contact;
  return Boolean(contact && (contact.name?.trim() || contact.email?.trim() || contact.phone?.trim()));
}
