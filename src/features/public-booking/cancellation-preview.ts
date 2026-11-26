import type { TFunction } from 'i18next';
import { formatMoney } from '@/lib/money-format';
import type { GuestCancellationPreview } from '@/types';

/**
 * Cancelling costs the guest nothing and returns nothing: a request withdrawn, a saved card released, a booking with nothing paid yet.
 * Those say «non paghi nulla», not «nessun rimborso», and have no refund policy to read (DB-08b).
 */
export function chargesNothing(preview: GuestCancellationPreview): boolean {
  return preview.kind !== 'cancel' || preview.paidAmount <= 0;
}

/**
 * An amount of the cancellation, written the way these pages always wrote it: in the Italian number format, whatever the language of the page (the language
 * does not choose the format of money here yet). The currency is the one of the preview and never a default: a preview that says none has its amounts written
 * with no symbol and the phrase that says the currency is not available, and nothing throws.
 */
export function cancellationMoney(amount: number, currency: string | null | undefined, t: TFunction): string {
  return formatMoney(amount, currency, 'it-IT', t);
}
