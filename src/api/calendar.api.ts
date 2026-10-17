import { ApiClient } from './client';
import type { HostCalendarQuery, HostCalendarResponse } from '@/types/host-calendar.types';

/** Query string of the calendar: the days (both included) and, for one property, its id (the API takes a list: one id is a list of one). */
function hostCalendarParams(query: HostCalendarQuery): Record<string, string> {
  const params: Record<string, string> = { from: query.from, to: query.to };
  if (query.propertyId) params.propertyIds = query.propertyId;
  return params;
}

/** A read that did not come back as an object (an answer of another kind) is an error to show, not data to draw. */
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
  /** The properties of the host and everything that has a day in the range, in one read (SR-02a): stays, portals, blocks and interventions. */
  getHostCalendar: async (query: HostCalendarQuery) => asHostCalendar(await ApiClient.get<unknown>('/calendar', hostCalendarParams(query))),
};
