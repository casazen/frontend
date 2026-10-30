import type { GuestCancellationPreview } from '@/types';

/**
 * Cancelling costs the guest nothing and returns nothing: a request withdrawn, a saved card released, a booking with nothing paid yet.
 * Those say «non paghi nulla», not «nessun rimborso», and have no refund policy to read (DB-08b).
 */
export function chargesNothing(preview: GuestCancellationPreview): boolean {
  return preview.kind !== 'cancel' || preview.paidAmount <= 0;
}
