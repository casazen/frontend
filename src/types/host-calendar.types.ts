import type { OtaReviewReason } from './calendar.types';

/**
 * `GET /api/calendar` (SR-02a): the calendar of every short-rent property of the host in one read. Days are calendar dates
 * (`yyyy-MM-dd`, Europe/Rome) that never move with the time zone, instants are UTC, money is in cents of euro and the enums
 * are written by name. An item carries only the fields of its `type`: the others are absent, never `null`.
 */

export type HostCalendarItemChannel = 'Direct' | 'Manual' | 'Airbnb' | 'BookingCom' | 'Expedia' | 'Vrbo' | 'TripAdvisor' | 'Agoda' | 'Other';

export interface HostCalendarProperty {
  id: string;
  name: string;
  city: string;
  rentalMode: string;
  status: 'Active' | 'Paused';
  minNights: number | null;
  baseRateCents: number;
  weekendSurchargePercent: number;
  cleaningFeeCents: number;
}

interface HostCalendarItemBase {
  id: string;
  propertyId: string;
  from: string;
  to: string;
}

interface HostCalendarBookingItem extends HostCalendarItemBase {
  type: 'Booking';
  status: 'Pending' | 'Confirmed' | 'CheckedIn' | 'CheckedOut';
  guestName?: string;
  numberOfGuests?: number;
  channel?: HostCalendarItemChannel;
  paymentOption?: string;
  onSiteRequestState?: string;
  requestExpiresAt?: string;
  paymentState?: 'None' | 'Partial' | 'Paid' | 'Refunded';
  totalCents?: number;
  icalFeedId?: string;
  channelLabel?: string;
  otaReviewReason?: OtaReviewReason;
}

export interface HostCalendarIcalItem extends HostCalendarItemBase {
  type: 'Ical';
  channel?: HostCalendarItemChannel;
  feedLabel?: string;
  convertible?: boolean;
  bookingId?: string;
  note?: string;
}

export interface HostCalendarBlockItem extends HostCalendarItemBase {
  type: 'Block';
  reason?: 'Owner' | 'Maintenance' | 'Other' | 'ModeChange';
  note?: string;
}

export interface HostCalendarServiceItem extends HostCalendarItemBase {
  type: 'Service';
  serviceKind?: 'Cleaning' | 'Maintenance' | 'Other';
  category?: string;
  serviceName?: string;
  serviceStatus?: string;
  supplierOrgId?: string;
  supplierName?: string;
  bookingId?: string;
  startAt?: string;
  endAt?: string;
}

export type HostCalendarItem = HostCalendarBookingItem | HostCalendarIcalItem | HostCalendarBlockItem | HostCalendarServiceItem;

export type HostCalendarStayItem = HostCalendarBookingItem | HostCalendarIcalItem | HostCalendarBlockItem;

export interface HostCalendarResponse {
  timezone: string;
  utcOffsetMinutes: number;
  today: string;
  from: string;
  to: string;
  propertiesTotal: number;
  properties: HostCalendarProperty[];
  items: HostCalendarItem[];
}

export interface HostCalendarQuery {
  from: string;
  to: string;
  propertyId?: string;
}
