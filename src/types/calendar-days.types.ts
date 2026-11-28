/**
 * `GET /api/calendar/days` (E08/F05/US01/T02, NF-36, NF-78): the price and the rules of every night of the properties the caller reaches, in one read. Days are
 * calendar dates of the property (`yyyy-MM-dd`, read as written, never turned into an instant), money is in cents of the currency of the property and the enums
 * are written by name. A value that is not set is absent, never `null`.
 */

export type DayPriceSource = 'Base' | 'Weekend' | 'Seasonal' | 'DayRule';

export interface CalendarDayInfo {
  date: string;
  priceCents: number;
  priceSource: DayPriceSource;
  minNights: number;
  maxNights?: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  minAdvanceDays?: number;
  maxAdvanceDays?: number;
  hasRule: boolean;
  taken: boolean;
}

export interface CalendarDaysProperty {
  propertyId: string;
  timezone: string;
  currency: string;
  mirrored: boolean;
  days: CalendarDayInfo[];
}

export interface CalendarDaysResponse {
  today: string;
  properties: CalendarDaysProperty[];
}

export interface CalendarDaysQuery {
  from: string;
  to: string;
  propertyId?: string;
}
