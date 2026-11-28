import type { TFunction } from 'i18next';
import { formatPrice } from '@/features/supplier/services/lib/service-labels';
import { formatWorkDuration } from '@/lib/work-duration';
import type { SupplierPicker, SupplierPickerService } from '@/types/service-request';

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

export function supplierPriceLabel(supplier: SupplierPicker, t: TFunction, locale: string): string | null {
  if (supplier.priceFromCents == null || !supplier.priceFromUnit) return null;
  return formatPrice(
    { requiresQuote: false, priceFromCents: supplier.priceFromCents, priceUnit: supplier.priceFromUnit },
    t,
    locale,
  );
}

export function responseLabel(supplier: SupplierPicker, t: TFunction): string | null {
  const minutes = supplier.medianResponseMinutes;
  if (minutes == null) return null;
  return t('marketplace.respondsWithin', { time: formatWorkDuration(Math.max(1, minutes), t) });
}

export function supplierFacts(supplier: SupplierPicker, t: TFunction, locale: string): string | null {
  const parts = [supplierPriceLabel(supplier, t, locale), responseLabel(supplier, t)].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Which optional sections the cards of one list have: every card of a grid has the same rows, so that they line up. */
export interface SupplierCardRows {
  facts: boolean;
  bio: boolean;
}

export function supplierCardRows(suppliers: readonly SupplierPicker[], t: TFunction, locale: string): SupplierCardRows {
  return {
    facts: suppliers.some((supplier) => supplierFacts(supplier, t, locale) !== null),
    bio: suppliers.some((supplier) => !!supplier.bio),
  };
}

export const supplierCardRowCount = ({ facts, bio }: SupplierCardRows): 2 | 3 | 4 => (2 + (facts ? 1 : 0) + (bio ? 1 : 0)) as 2 | 3 | 4;
