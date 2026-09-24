import type { BookingStatus, RentalType } from '@/types';

type TranslateFn = (key: string) => string;
import { LOCALE_STORAGE_KEY, type AppLocale } from '@/i18n/config';
import i18n from '@/i18n/config';

/**
 * Label of an enum-like value coming from the API (`<prefix>.<value>`).
 * Values without a translation key (e.g. free-text categories typed by a supplier, or a
 * value added by a newer backend) are shown as they are instead of as a raw i18n key.
 */
function translateEnumValue(prefix: string, value: string | null | undefined, t: TranslateFn): string {
  if (!value) return '';
  const key = `${prefix}.${value}`;
  return i18n.exists(key) ? t(key) : value;
}

const BOOKING_STATUS_KEYS: Record<BookingStatus, string> = {
  Pending: 'booking.status.pending',
  Confirmed: 'booking.status.confirmed',
  CheckedIn: 'booking.status.checkedIn',
  CheckedOut: 'booking.status.checkedOut',
  Cancelled: 'booking.status.cancelled',
};

export type OtaConnectionStatus = 'connected' | 'warning' | 'disconnected';

export function getBookingStatusLabel(status: string, t: TranslateFn): string {
  const key = BOOKING_STATUS_KEYS[status as BookingStatus];
  return key ? t(key) : status;
}

/**
 * Label of the booking source (`Manual` for bookings entered by the host, `Direct` for the booking site,
 * OTA names otherwise). An unknown value is shown as it is.
 */
export function getBookingSourceLabel(source: string | null | undefined, t: TranslateFn): string {
  return translateEnumValue('booking.source', source, t);
}

export function getOtaConnectionStatusLabel(status: OtaConnectionStatus, t: TranslateFn): string {
  return t(`ota.status.${status}`);
}

export function getAmenityLabel(amenity: string, t: TranslateFn): string {
  return t(`amenity.${amenity}`);
}

export function getAlloggiatiStatusLabel(status: string, t: TranslateFn): string {
  return t(`alloggiati.statusLabel.${status}`);
}

export function getPaymentStatusLabel(status: string, t: TranslateFn): string {
  return t(`payment.status.${status}`);
}

export function getPaymentMethodLabel(method: string, t: TranslateFn): string {
  return t(`payment.method.${method}`);
}

export function getDocumentTypeLabel(type: string, t: TranslateFn): string {
  return t(`checkin.documentType.${type}`);
}

export function getGenderLabel(gender: string, t: TranslateFn): string {
  return t(`checkin.gender.${gender}`);
}

export function getCinStatusLabel(status: string, t: TranslateFn): string {
  return t(`cin.status.${status}`);
}

/** Italian end-user copy shown when a write is blocked by the org's plan limit (#202, AC8/AC12). */
export function getPlanLimitMessage(): string {
  return i18n.t('common.planLimitMessage');
}

/** Italian CTA label pointing at the (billing-spec-owned) upgrade route. */
export function getPlanUpgradeCta(): string {
  return i18n.t('common.planUpgradeCta');
}

export function persistLocale(locale: AppLocale): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function getFiscalRegimeLabel(regime: string, t: TranslateFn): string {
  return t(`leases.fiscalRegimeLabel.${regime}`);
}

export function getLeaseStatusLabel(status: string, t: TranslateFn): string {
  return translateEnumValue('leases.statusLabel', status, t);
}

/** Timeline entry of a lease (`LeaseEventType`). */
export function getLeaseEventTypeLabel(eventType: string, t: TranslateFn): string {
  return translateEnumValue('leases.eventType', eventType, t);
}

/**
 * RLI checklist item: the translation of its stable key in the UI language, or the label the server
 * localized from `Accept-Language` for a key this frontend does not know yet.
 */
export function getRliChecklistItemLabel(item: { key: string; label: string }, t: TranslateFn): string {
  const key = `leases.rli.checklistItem.${item.key}`;
  return i18n.exists(key) ? t(key) : item.label;
}

export function getRegistrationStatusLabel(status: string, t: TranslateFn): string {
  return t(`leases.registrationStatusLabel.${status}`);
}

export function getLeasePartyRoleLabel(role: string, t: TranslateFn): string {
  return translateEnumValue('leases.partyRole', role, t);
}

/** Label of an application role (`Admin`, `PropertyOwner`, ...). */
export function getRoleLabel(role: string, t: TranslateFn): string {
  return translateEnumValue('roles', role, t);
}

/** Label of a plan tier (`Starter`, `Pro`, `Scale`). */
export function getPlanTierLabel(tier: string, t: TranslateFn): string {
  return translateEnumValue('plan.tier', tier, t);
}

const RENTAL_TYPE_KEYS: Record<RentalType, string> = {
  ShortTerm: 'onboarding.shortTermTitle',
  LongTerm: 'onboarding.longTermTitle',
  Both: 'onboarding.bothTitle',
};

/** Label of the operator type chosen during onboarding. */
export function getRentalTypeLabel(rentalType: string, t: TranslateFn): string {
  const key = RENTAL_TYPE_KEYS[rentalType as RentalType];
  return key ? t(key) : rentalType;
}

export function getServiceCategoryLabel(category: string, t: TranslateFn): string {
  return translateEnumValue('serviceRequest.categories', category, t);
}

export function getServiceRequestStatusLabel(status: string, t: TranslateFn): string {
  return translateEnumValue('serviceRequest.status', status, t);
}

export function getSupplierStatusLabel(status: string, t: TranslateFn): string {
  return translateEnumValue('supplier.statusLabel', status, t);
}

export function getCheckInSessionStatusLabel(status: string, t: TranslateFn): string {
  return translateEnumValue('checkin.status', status, t);
}

export function getOtaPlatformLabel(platform: string, t: TranslateFn): string {
  return t(`ota.platform.${platform}`);
}

export function getSyncStatusLabel(status: string, t: TranslateFn): string {
  return t(`ota.syncStatus.${status}`);
}

export function readPersistedLocale(): AppLocale | null {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'it' || stored === 'en') {
    return stored;
  }
  return null;
}
