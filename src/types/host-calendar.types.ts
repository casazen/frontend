import type { OtaReviewReason } from './calendar.types';

/**
 * `GET /api/calendar` (SR-02a): the calendar of every short-rent property of the host in one read. Days are calendar dates
 * (`yyyy-MM-dd`, Europe/Rome) that never move with the time zone, instants are UTC, money is in cents of euro and the enums
 * are written by name. An item carries only the fields of its `type`: the others are absent, never `null`.
 */

/** Where a stay or a portal's reservation came from (backend `BookingChannel`). */
export type HostCalendarItemChannel = 'Direct' | 'Manual' | 'Airbnb' | 'BookingCom' | 'Other';

/** The properties asked for and the days of the range, with what the screen needs to draw a row. */
export interface HostCalendarProperty {
  id: string;
  name: string;
  city: string;
  /** Always `Short`: a property in long-term mode has no place on this calendar. */
  rentalMode: string;
  /** `Paused`: the host paused it (hidden from the booking site, still on the host's calendar). */
  status: 'Active' | 'Paused';
  minNights: number | null;
  baseRateCents: number;
  weekendSurchargePercent: number;
  cleaningFeeCents: number;
}

interface HostCalendarItemBase {
  id: string;
  propertyId: string;
  /** First night (an intervention: the day of the work). */
  from: string;
  /** Departure day: the first day the item no longer takes a night (an intervention: the day after). */
  to: string;
}

/** A stay of CasaZen: the booking site, entered by the host, or a portal's reservation the host turned into a stay. */
export interface HostCalendarBookingItem extends HostCalendarItemBase {
  type: 'Booking';
  /** `Pending` is an unanswered "pay at the property" request or a checkout being paid. */
  status: 'Pending' | 'Confirmed' | 'CheckedIn' | 'CheckedOut';
  guestName?: string;
  numberOfGuests?: number;
  channel?: HostCalendarItemChannel;
  paymentOption?: string;
  /** For a "pay at the property" request only: where it stands. */
  onSiteRequestState?: string;
  /** For a request only: when it is cancelled if nobody answers (UTC). */
  requestExpiresAt?: string;
  paymentState?: 'None' | 'Partial' | 'Paid' | 'Refunded';
  totalCents?: number;
  icalFeedId?: string;
  channelLabel?: string;
  /** Why the portal's calendar asks to check the reservation again. */
  otaReviewReason?: OtaReviewReason;
}

/** A reservation of a portal as it arrives, a block of its calendar: dates only. */
export interface HostCalendarIcalItem extends HostCalendarItemBase {
  type: 'Ical';
  channel?: HostCalendarItemChannel;
  feedLabel?: string;
  convertible?: boolean;
  /** The stay the host turned it into, when that stay does not stand for it (its dates changed on the portal). */
  bookingId?: string;
  /** What the portal wrote on the event. */
  note?: string;
}

/** The host's own block: the dates are closed. */
export interface HostCalendarBlockItem extends HostCalendarItemBase {
  type: 'Block';
  /** `ModeChange` is CasaZen's, held while the property changes to long-term leases. */
  reason?: 'Owner' | 'Maintenance' | 'Other' | 'ModeChange';
  note?: string;
}

/** An intervention of a supplier, on the day of the work or, with no time, on the day its stay leaves. */
export interface HostCalendarServiceItem extends HostCalendarItemBase {
  type: 'Service';
  serviceKind?: 'Cleaning' | 'Maintenance' | 'Other';
  /** Category code (`cleaning`, `maintenance`, …): the client translates it. */
  category?: string;
  serviceName?: string;
  /** `Richiesto`, `PresoInCarico`, `InCorso`, `Completato` or `Pagato`. */
  serviceStatus?: string;
  supplierOrgId?: string;
  supplierName?: string;
  /** The stay the request is for. */
  bookingId?: string;
  startAt?: string;
  endAt?: string;
}

export type HostCalendarItem = HostCalendarBookingItem | HostCalendarIcalItem | HostCalendarBlockItem | HostCalendarServiceItem;

/** What takes nights of a property: the interventions do not. */
export type HostCalendarStayItem = HostCalendarBookingItem | HostCalendarIcalItem | HostCalendarBlockItem;

export interface HostCalendarResponse {
  timezone: string;
  utcOffsetMinutes: number;
  /** Today in Europe/Rome. */
  today: string;
  from: string;
  to: string;
  /** How many properties the caller reaches: more than `properties` when the list was cut to 50. */
  propertiesTotal: number;
  properties: HostCalendarProperty[];
  items: HostCalendarItem[];
}

/** The range asked to the calendar, both days included, and, optionally, one property. */
export interface HostCalendarQuery {
  from: string;
  to: string;
  propertyId?: string;
}
