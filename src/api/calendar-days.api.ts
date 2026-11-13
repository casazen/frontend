import { ApiClient } from './client';
import type { CalendarDaysQuery, CalendarDaysResponse } from '@/types/calendar-days.types';

/** Query string of the days read: the days (both included) and, for one property, its id (the API takes a list: one id is a list of one). */
function calendarDaysParams(query: CalendarDaysQuery): Record<string, string> {
  const params: Record<string, string> = { from: query.from, to: query.to };
  if (query.propertyId) params.propertyIds = query.propertyId;
  return params;
}

/** A read that did not come back as an object (an answer of another kind) is an error to show, not data to draw. */
function asCalendarDays(value: unknown): CalendarDaysResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Unexpected answer of the calendar days');
  const response = value as CalendarDaysResponse;
  return {
    ...response,
    properties: Array.isArray(response.properties)
      ? response.properties.map((property) => ({ ...property, days: Array.isArray(property.days) ? property.days : [] }))
      : [],
  };
}

export const calendarDaysApi = {
  /** The price and the rules of every night of the properties the caller reaches (E08/F05/US01/T02). A 403 means the caller may not read property data. */
  getDays: async (query: CalendarDaysQuery) => asCalendarDays(await ApiClient.get<unknown>('/calendar/days', calendarDaysParams(query))),
};
