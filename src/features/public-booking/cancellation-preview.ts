import type { TFunction } from 'i18next';
import { formatMoney } from '@/lib/money-format';
import type { GuestCancellationPreview } from '@/types';

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
