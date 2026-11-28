import { ApiClient } from './client';
import type { HostCalendarQuery, HostCalendarResponse } from '@/types/host-calendar.types';

function hostCalendarParams(query: HostCalendarQuery): Record<string, string> {
  const params: Record<string, string> = { from: query.from, to: query.to };
  if (query.propertyId) params.propertyIds = query.propertyId;
  return params;
}

function asHostCalendar(value: unknown): HostCalendarResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Unexpected answer of the calendar');
  const calendar = value as HostCalendarResponse;
  return {
    ...calendar,
    properties: Array.isArray(calendar.properties) ? calendar.properties : [],
    items: Array.isArray(calendar.items) ? calendar.items : [],
  };
}

export const calendarApi = {
  getHostCalendar: async (query: HostCalendarQuery) => asHostCalendar(await ApiClient.get<unknown>('/calendar', hostCalendarParams(query))),
};
