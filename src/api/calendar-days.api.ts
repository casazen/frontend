import { ApiClient } from './client';
import type { CalendarDaysQuery, CalendarDaysResponse } from '@/types/calendar-days.types';

function calendarDaysParams(query: CalendarDaysQuery): Record<string, string> {
  const params: Record<string, string> = { from: query.from, to: query.to };
  if (query.propertyId) params.propertyIds = query.propertyId;
  return params;
}

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
  getDays: async (query: CalendarDaysQuery) => asCalendarDays(await ApiClient.get<unknown>('/calendar/days', calendarDaysParams(query))),
};
