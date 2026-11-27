/**
 * `GET /api/calendar/days` (E08/F05/US01/T02, NF-36, NF-78): the price and the rules of every night of the properties the caller reaches, in one read. Days are
 * calendar dates of the property (`yyyy-MM-dd`, read as written, never turned into an instant), money is in cents of the currency of the property and the enums
 * are written by name. A value that is not set is absent, never `null`.
 */

/** Where the price of a night comes from (backend `DayPriceSource`): the host set it on the calendar, a seasonal price it confirmed, the weekend price or the usual one. */
export type DayPriceSource = 'Base' | 'Weekend' | 'Seasonal' | 'DayRule';

/** The night that starts on `date`. */
export interface CalendarDayInfo {
  date: string;
  /** What the night costs, in cents of the currency of the property. */
  priceCents: number;
  priceSource: DayPriceSource;
  /** The fewest nights of a stay that starts on this night. */
  minNights: number;
  /** The most nights of a stay that starts on this night; absent for no maximum. */
  maxNights?: number;
  /** A stay cannot start on this night. */
  closedToArrival: boolean;
  /** A stay cannot end on this day. */
  closedToDeparture: boolean;
  /** The fewest days ahead a stay may be booked; absent for no minimum. */
  minAdvanceDays?: number;
  /** The most days ahead a stay may be booked; absent for no maximum. */
  maxAdvanceDays?: number;
  /** The night has a rule of its own. */
  hasRule: boolean;
  /** A booking, a hold, a request or a block takes the night. */
  taken: boolean;
}

export interface CalendarDaysProperty {
  propertyId: string;
  /** The IANA time zone of the property: its "today" is read on this clock; a stay date is never converted. */
  timezone: string;
  /** ISO 4217 code of the property: `priceCents` is in cents of it. */
  currency: string;
  /** The property books into the channel manager: what the host changes here can be sent there. */
  mirrored: boolean;
  days: CalendarDayInfo[];
}

export interface CalendarDaysResponse {
  /** Today in Europe/Rome; each property says its own time zone. */
  today: string;
  properties: CalendarDaysProperty[];
}

/** The range asked to the days read, both days included (at most 92), and, optionally, one property. */
export interface CalendarDaysQuery {
  from: string;
  to: string;
  propertyId?: string;
}
