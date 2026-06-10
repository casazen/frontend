import type { TFunction } from 'i18next';
import type { BookingStatus } from '@/types';
import { LOCALE_STORAGE_KEY, type AppLocale } from '@/i18n/config';

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
