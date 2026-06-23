import type { TFunction } from 'i18next';
import type { BookingStatus } from '@/types';
import { LOCALE_STORAGE_KEY, type AppLocale } from '@/i18n/config';
import i18n from '@/i18n/config';

const BOOKING_STATUS_KEYS: Record<BookingStatus, string> = {
  Pending: 'booking.status.pending',
  Confirmed: 'booking.status.confirmed',
  CheckedIn: 'booking.status.checkedIn',
  CheckedOut: 'booking.status.checkedOut',
  Cancelled: 'booking.status.cancelled',
};

export type OtaConnectionStatus = 'connected' | 'warning' | 'disconnected';

export function getBookingStatusLabel(status: string, t: TFunction): string {
  const key = BOOKING_STATUS_KEYS[status as BookingStatus];
  return key ? t(key) : status;
}

export function getOtaConnectionStatusLabel(status: OtaConnectionStatus, t: TFunction): string {
  return t(`ota.status.${status}`);
}

export function getAmenityLabel(amenity: string, t: TFunction): string {
  return t(`amenity.${amenity}`);
}

export function getAlloggiatiStatusLabel(status: string, t: TFunction): string {
  return t(`alloggiati.statusLabel.${status}`);
}

export function getPaymentStatusLabel(status: string, t: TFunction): string {
  return t(`payment.status.${status}`);
}

export function getPaymentMethodLabel(method: string, t: TFunction): string {
  return t(`payment.method.${method}`);
}

export function getDocumentTypeLabel(type: string, t: TFunction): string {
  return t(`checkin.documentType.${type}`);
}

export function getGenderLabel(gender: string, t: TFunction): string {
  return t(`checkin.gender.${gender}`);
}

export function getCinStatusLabel(status: string, t: TFunction): string {
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

export function readPersistedLocale(): AppLocale | null {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'it' || stored === 'en') {
    return stored;
  }
  return null;
}
