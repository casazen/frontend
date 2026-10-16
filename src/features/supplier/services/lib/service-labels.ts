import type { TFunction } from 'i18next';
import {
  SUPPLIER_SERVICE_WEEKDAYS,
  type SupplierServicePriceUnit,
  type SupplierServiceWeekday,
  type SupplierSupplementUnit,
} from '@/types/supplier-services';
import { formatMoney } from './service-money';

/** The part of a service the price line needs: a saved service has it, and so does the form once its values are read. */
export interface PriceInput {
  requiresQuote: boolean;
  priceFromCents: number | null;
  priceUnit: SupplierServicePriceUnit;
}

/** What the unit of a price says ("a intervento", "all'ora"). */
export function priceUnitLabel(unit: SupplierServicePriceUnit, t: TFunction): string {
  return t(`supplier.services.units.${unit}`);
}

/** What a supplement is counted by ("Per ogni bagno in più"). */
export function supplementUnitLabel(per: SupplierSupplementUnit, t: TFunction): string {
  return t(`supplier.services.supplementUnits.${per}`);
}

/**
 * The price as the customers read it: "da 45 € a intervento", "Su preventivo". A price that is the "from" one is always
 * written "da": the supplements add to it. Nothing says "IVA inclusa" here: that is only said when the supplier declared it.
 */
export function formatPrice(price: PriceInput, t: TFunction, locale: string): string {
  if (price.requiresQuote) return t('supplier.services.price.onQuote');
  if (price.priceFromCents === null) return t('supplier.services.price.notSet');
  return t('supplier.services.price.fromUnit', {
    amount: formatMoney(price.priceFromCents, locale),
    unit: priceUnitLabel(price.priceUnit, t),
  });
}

/** "30 min", "2 h", "1 h 30 min"; a service without a duration yet says so. */
export function formatDuration(minutes: number | null, t: TFunction): string {
  if (minutes === null) return t('supplier.services.duration.notSet');
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return t('supplier.services.duration.minutes', { minutes: rest });
  if (rest === 0) return t('supplier.services.duration.hours', { hours });
  return t('supplier.services.duration.hoursMinutes', { hours, minutes: rest });
}

/** The notice a service asks for: whole days are said in days. `null` is the notice of the availability rules. */
export function formatNotice(hours: number | null, t: TFunction): string {
  if (hours === null) return t('supplier.services.notice.default');
  if (hours === 0) return t('supplier.services.notice.none');
  if (hours % 24 === 0) return t('supplier.services.notice.days', { count: hours / 24 });
  return t('supplier.services.notice.hours', { count: hours });
}

/** A short name of a weekday in the language of the page ("lun", "Mon"): 1 January 2024 was a Monday. */
export function weekdayShort(day: SupplierServiceWeekday, locale: string): string {
  const index = SUPPLIER_SERVICE_WEEKDAYS.indexOf(day);
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + index)));
}
