import type { TFunction } from 'i18next';
import { formatPrice } from '@/features/supplier/services/lib/service-labels';
import { formatWorkDuration } from '@/lib/work-duration';
import type { SupplierPicker, SupplierPickerService } from '@/types/service-request';

/** The price of a service as a host reads it: "da 45 € a intervento", or "Su preventivo" when the supplier gave none. */
export function servicePriceLabel(
  service: Pick<SupplierPickerService, 'priceFromCents' | 'priceUnit'>,
  t: TFunction,
  locale: string,
): string {
  return formatPrice(
    { requiresQuote: service.priceFromCents === null, priceFromCents: service.priceFromCents, priceUnit: service.priceUnit },
    t,
    locale,
  );
}

/** The lowest "from" price of a supplier with its unit ("da 25 € all'ora"); nothing when none of its services has a price. */
export function supplierPriceLabel(supplier: SupplierPicker, t: TFunction, locale: string): string | null {
  if (supplier.priceFromCents == null || !supplier.priceFromUnit) return null;
  return formatPrice(
    { requiresQuote: false, priceFromCents: supplier.priceFromCents, priceUnit: supplier.priceFromUnit },
    t,
    locale,
  );
}

/**
 * "Risponde in genere entro 2 ore": only when the time is measured. A supplier whose response time is not measured says nothing
 * about it: no phrase is made up for it.
 */
export function responseLabel(supplier: SupplierPicker, t: TFunction): string | null {
  const minutes = supplier.medianResponseMinutes;
  if (minutes == null) return null;
  return t('marketplace.respondsWithin', { time: formatWorkDuration(Math.max(1, minutes), t) });
}
