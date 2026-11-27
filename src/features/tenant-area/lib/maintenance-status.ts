import type { TenantMaintenanceStatus } from '@/types';

const KNOWN: ReadonlySet<string> = new Set([
  'Sent',
  'InReview',
  'NeedsInfo',
  'Accepted',
  'InProgress',
  'Closed',
  'Rejected',
]);

/**
 * The status a tenant may read. Host and supplier states collapse to the same short list, so a commercial state
 * (`Pagato` of a supplier invoice) never reaches the screen under its own name.
 */
export function tenantMaintenanceStatus(status: string | null | undefined): TenantMaintenanceStatus {
  if (status && KNOWN.has(status)) return status as TenantMaintenanceStatus;
  switch (status) {
    case 'Richiesto':
      return 'Sent';
    case 'PresoInCarico':
      return 'Accepted';
    case 'InCorso':
      return 'InProgress';
    case 'Completato':
    case 'Pagato':
    case 'Annullato':
      return 'Closed';
    case 'Rifiutato':
      return 'Rejected';
    default:
      return 'Sent';
  }
}
