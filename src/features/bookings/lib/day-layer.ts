import type { TFunction } from 'i18next';
import { formatStayDate } from '@/lib/stay-dates';
import type { CalendarDayInfo, CalendarDaysProperty, CalendarDaysResponse } from '@/types/calendar-days.types';

/**
 * The day layer of the host calendar (E08/F05/US03/T01): what each night costs and which rules it has, read from `GET /api/calendar/days` and set on the Timeline
 * and on the month, the week and the day. Everything here is plain arithmetic on calendar dates (`yyyy-MM-dd`, read as written, never turned into an instant, so
 * no time zone moves them) and on cents.
 */

export interface DayLayerProperty {
  currency: string;
  timezone: string;
  mirrored: boolean;
  days: ReadonlyMap<string, CalendarDayInfo>;
}

export type DayLayer = ReadonlyMap<string, DayLayerProperty>;

function layerProperty(property: CalendarDaysProperty): DayLayerProperty {
  const days = new Map<string, CalendarDayInfo>();
  for (const day of property.days) days.set(day.date, day);
  return { currency: property.currency, timezone: property.timezone, mirrored: property.mirrored, days };
}

export function toDayLayer(response: CalendarDaysResponse | undefined): DayLayer | undefined {
  if (!response) return undefined;
  return new Map(response.properties.map((property) => [property.propertyId, layerProperty(property)] as const));
}

const FORMATTERS = new Map<string, Intl.NumberFormat>();

function numberFormat(language: string, currency: string, whole: boolean, words: boolean): Intl.NumberFormat {
  const key = `${language}|${currency}|${whole ? 'w' : 'c'}|${words ? 'n' : 's'}`;
  let format = FORMATTERS.get(key);
  if (!format) {
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency,
      currencyDisplay: words ? 'name' : 'symbol',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    };
    try {
      format = new Intl.NumberFormat(language, options);
    } catch {
      // A code that is not a currency (the API sends EUR or CHF): the euro, rather than no price.
      format = new Intl.NumberFormat(language, { ...options, currency: 'EUR' });
    }
    FORMATTERS.set(key, format);
  }
  return format;
}

export function formatDayPrice(cents: number, currency: string, language: string): string {
  return numberFormat(language, currency, cents % 100 === 0, false).format(cents / 100);
}

export function dayPriceWords(cents: number, currency: string, language: string): string {
  return numberFormat(language, currency, cents % 100 === 0, true).format(cents / 100);
}

export const FULL_CELL_MAX_ZOOM = 14;

export interface DayCellText {
  price: string;
  minNights: number | null;
}

export function dayCellText(day: CalendarDayInfo, currency: string, language: string, zoom: number): DayCellText {
  return {
    price: formatDayPrice(day.priceCents, currency, language),
    minNights: zoom <= FULL_CELL_MAX_ZOOM && day.minNights >= 2 ? day.minNights : null,
  };
}

export const isPastDay = (day: string, today: string): boolean => day < today;

export function showsPrice(day: CalendarDayInfo | undefined, date: string, today: string): day is CalendarDayInfo {
  return day !== undefined && !isPastDay(date, today) && !day.taken;
}

interface DayLabelInput {
  date: string;
  propertyName: string;
  today: string;
  language: string;
  currency?: string;
  info?: CalendarDayInfo;
}

export function dayLabel({ date, propertyName, today, language, currency, info }: DayLabelInput, t: TFunction): string {
  const parts = [formatStayDate(date, language, { day: 'numeric', month: 'long' }), propertyName];
  if (isPastDay(date, today)) {
    parts.push(t('booking.calendar.day.past'));
  } else if (info?.taken) {
    parts.push(t('booking.calendar.day.taken'));
  } else if (info && currency) {
    parts.push(dayPriceWords(info.priceCents, currency, language));
    if (info.minNights >= 2) parts.push(t('booking.calendar.day.minNights', { count: info.minNights }));
    if (info.closedToArrival) parts.push(t('booking.calendar.day.closedToArrival'));
    if (info.closedToDeparture) parts.push(t('booking.calendar.day.closedToDeparture'));
    if (info.hasRule) parts.push(t('booking.calendar.day.hasRule'));
  }
  return parts.filter(Boolean).join(', ');
}
